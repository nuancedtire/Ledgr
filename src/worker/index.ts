import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';

// ─── Types ────────────────────────────────────────────────────────

interface Env {
  CSV_WORKFLOW: Workflow;
  ASSETS: Fetcher;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  CSV_PATH: string;
}

interface CSVPayload {
  csvData: string;
  filename: string;
  rowCount: number;
}

// ─── CSV line parser (handles quoted fields) ─────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ─── Workflow: Durable CSV Ingestion ─────────────────────────────

export class CSVIngestWorkflow extends WorkflowEntrypoint<Env, CSVPayload> {
  async run(event: WorkflowEvent<CSVPayload>, step: WorkflowStep) {
    const { csvData } = event.payload;

    // Step 1: Validate & parse uploaded CSV
    const newRows = await step.do('validate-csv', async () => {
      const lines = csvData.trim().split('\n');
      const header = lines[0];
      if (
        !header.includes('Type') ||
        !header.includes('Amount') ||
        !header.includes('Started Date')
      ) {
        throw new Error(
          'Invalid CSV format. Expected Revolut statement with Type, Amount, Started Date columns.',
        );
      }
      return lines.slice(1).filter((l) => l.trim().length > 0);
    });

    // Step 2: Fetch existing CSV from GitHub
    const existingCSV = await step.do(
      'fetch-existing',
      { retries: { limit: 3, delay: '2 seconds', backoff: 'linear' } },
      async () => {
        const url = `https://api.github.com/repos/${this.env.GITHUB_REPO}/contents/${this.env.CSV_PATH}?ref=${this.env.GITHUB_BRANCH}`;
        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'ledgr-workflow',
          },
        });

        if (resp.status === 404) {
          return { content: '', sha: null as string | null };
        }
        if (!resp.ok) {
          throw new Error(`GitHub API error: ${resp.status} ${await resp.text()}`);
        }

        const data = (await resp.json()) as { content: string; sha: string };
        const decoded = atob(data.content.replace(/\n/g, ''));
        return { content: decoded, sha: data.sha as string | null };
      },
    );

    // Step 3: Deduplicate & merge
    const merged = await step.do('deduplicate-merge', async () => {
      const existingLines = existingCSV.content
        ? existingCSV.content.trim().split('\n')
        : [];

      const header = csvData.trim().split('\n')[0];
      const existingHeader = existingLines.length > 0 ? existingLines[0] : header;
      const existingDataLines = existingLines.slice(1);

      // Fingerprint: Type | Started Date | Description | Amount
      function fingerprint(line: string): string {
        const fields = parseCsvLine(line);
        return [fields[0], fields[2], fields[4], fields[5]].join('|');
      }

      const existingFingerprints = new Set(existingDataLines.map(fingerprint));
      const newDataLines = newRows.filter(
        (line) => !existingFingerprints.has(fingerprint(line)),
      );

      const allDataLines = [...existingDataLines, ...newDataLines];

      // Sort chronologically by Started Date (field index 2)
      allDataLines.sort((a, b) => {
        const fa = parseCsvLine(a);
        const fb = parseCsvLine(b);
        return fa[2].localeCompare(fb[2]);
      });

      const mergedCSV =
        [existingHeader || header, ...allDataLines].join('\n') + '\n';

      return {
        csv: mergedCSV,
        newRowCount: newDataLines.length,
        totalRowCount: allDataLines.length,
        sha: existingCSV.sha,
      };
    });

    // Step 4: Commit merged CSV to GitHub
    await step.do(
      'commit-to-github',
      { retries: { limit: 3, delay: '3 seconds', backoff: 'linear' } },
      async () => {
        const url = `https://api.github.com/repos/${this.env.GITHUB_REPO}/contents/${this.env.CSV_PATH}`;
        const body: Record<string, unknown> = {
          message: `Update statement: +${merged.newRowCount} new transactions (${merged.totalRowCount} total)`,
          content: btoa(unescape(encodeURIComponent(merged.csv))),
          branch: this.env.GITHUB_BRANCH,
        };
        if (merged.sha) {
          body.sha = merged.sha;
        }

        const resp = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'ledgr-workflow',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          throw new Error(
            `GitHub commit failed: ${resp.status} ${await resp.text()}`,
          );
        }
        return { committed: true };
      },
    );

    // Step 5: Confirm rebuild triggered
    await step.do('trigger-rebuild', async () => {
      return {
        triggered: true,
        note: 'Cloudflare Workers Builds will auto-rebuild from the new commit.',
      };
    });

    return {
      newRows: merged.newRowCount,
      totalRows: merged.totalRowCount,
    };
  }
}

// ─── HTTP handler: API routes + static asset fallback ────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // POST /upload — start CSV ingest workflow
    if (url.pathname === '/upload' && request.method === 'POST') {
      try {
        const csvData = await request.text();
        const lines = csvData.trim().split('\n');
        const rowCount = lines.length - 1;

        if (rowCount < 1) {
          return Response.json({ error: 'CSV is empty' }, { status: 400 });
        }

        const instance = await env.CSV_WORKFLOW.create({
          params: {
            csvData,
            filename: `upload-${Date.now()}.csv`,
            rowCount,
          },
        });

        return Response.json({ instanceId: instance.id, rowCount });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500 });
      }
    }

    // GET /status/:id — poll workflow status
    const statusMatch = url.pathname.match(/^\/status\/(.+)$/);
    if (statusMatch && request.method === 'GET') {
      try {
        const instance = await env.CSV_WORKFLOW.get(statusMatch[1]);
        const status = await instance.status();

        return Response.json({
          status: status.status,
          output: status.output,
          error: status.error,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500 });
      }
    }

    // Everything else → static assets
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
