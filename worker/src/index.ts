import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';

interface Env {
  CSV_WORKFLOW: Workflow;
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

interface StepResult {
  steps: Record<string, string>;
  newRows: number;
  totalRows: number;
}

// ─── Workflow ─────────────────────────────────────────────────────

export class CSVIngestWorkflow extends WorkflowEntrypoint<Env, CSVPayload> {
  async run(event: WorkflowEvent<CSVPayload>, step: WorkflowStep) {
    const { csvData, filename } = event.payload;

    // Step 1: Validate & parse uploaded CSV
    const newRows = await step.do('validate-csv', async () => {
      const lines = csvData.trim().split('\n');
      const header = lines[0];
      if (!header.includes('Type') || !header.includes('Amount') || !header.includes('Started Date')) {
        throw new Error('Invalid CSV format. Expected Revolut statement with Type, Amount, Started Date columns.');
      }
      return lines.slice(1).filter(l => l.trim().length > 0);
    });

    // Step 2: Fetch existing CSV from GitHub
    const existingCSV = await step.do('fetch-existing', { retries: { limit: 3, delay: '2 seconds', backoff: 'linear' } }, async () => {
      const url = `https://api.github.com/repos/${this.env.GITHUB_REPO}/contents/${this.env.CSV_PATH}?ref=${this.env.GITHUB_BRANCH}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ledgr-workflow',
        },
      });

      if (resp.status === 404) {
        return { content: '', sha: null };
      }
      if (!resp.ok) {
        throw new Error(`GitHub API error: ${resp.status} ${await resp.text()}`);
      }

      const data = await resp.json() as { content: string; sha: string };
      const decoded = atob(data.content.replace(/\n/g, ''));
      return { content: decoded, sha: data.sha };
    });

    // Step 3: Deduplicate & merge
    const merged = await step.do('deduplicate-merge', async () => {
      const existingLines = existingCSV.content
        ? existingCSV.content.trim().split('\n')
        : [];

      const header = csvData.trim().split('\n')[0];
      const existingHeader = existingLines.length > 0 ? existingLines[0] : header;
      const existingDataLines = existingLines.slice(1);

      // Create a set of existing transaction fingerprints for dedup
      // Fingerprint = Type + Started Date + Description + Amount (first 4 meaningful fields)
      function fingerprint(line: string): string {
        const fields = parseCsvLine(line);
        // Type, Product, Started Date, Completed Date, Description, Amount
        return [fields[0], fields[2], fields[4], fields[5]].join('|');
      }

      const existingFingerprints = new Set(existingDataLines.map(fingerprint));
      const newDataLines = newRows.filter(line => {
        const fp = fingerprint(line);
        return !existingFingerprints.has(fp);
      });

      // Combine: existing + new (both are data lines, no header)
      const allDataLines = [...existingDataLines, ...newDataLines];

      // Sort by date descending (Started Date is field index 2)
      allDataLines.sort((a, b) => {
        const fa = parseCsvLine(a);
        const fb = parseCsvLine(b);
        return fa[2].localeCompare(fb[2]); // ascending chronological
      });

      const mergedCSV = [existingHeader || header, ...allDataLines].join('\n') + '\n';

      return {
        csv: mergedCSV,
        newRowCount: newDataLines.length,
        totalRowCount: allDataLines.length,
        sha: existingCSV.sha,
      };
    });

    // Step 4: Commit to GitHub
    await step.do('commit-to-github', { retries: { limit: 3, delay: '3 seconds', backoff: 'linear' } }, async () => {
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
          'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ledgr-workflow',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        throw new Error(`GitHub commit failed: ${resp.status} ${await resp.text()}`);
      }
      return { committed: true };
    });

    // Step 5: Trigger rebuild (Cloudflare Pages rebuilds automatically on push)
    // This step just confirms the push triggered a build
    await step.do('trigger-rebuild', async () => {
      // Cloudflare Pages auto-rebuilds on push to the connected branch.
      // We just add a small delay and return success.
      return { triggered: true, note: 'Cloudflare Pages will auto-rebuild from the new commit.' };
    });

    return {
      newRows: merged.newRowCount,
      totalRows: merged.totalRowCount,
    };
  }
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

// ─── HTTP handler ────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /upload — start workflow
    if (url.pathname === '/upload' && request.method === 'POST') {
      try {
        const csvData = await request.text();
        const lines = csvData.trim().split('\n');
        const rowCount = lines.length - 1;

        if (rowCount < 1) {
          return Response.json({ error: 'CSV is empty' }, { status: 400, headers: corsHeaders });
        }

        const instance = await env.CSV_WORKFLOW.create({
          params: {
            csvData,
            filename: 'upload-' + Date.now() + '.csv',
            rowCount,
          },
        });

        return Response.json(
          { instanceId: instance.id, rowCount },
          { headers: corsHeaders },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500, headers: corsHeaders });
      }
    }

    // GET /status/:id — poll workflow status
    const statusMatch = url.pathname.match(/^\/status\/(.+)$/);
    if (statusMatch && request.method === 'GET') {
      try {
        const instance = await env.CSV_WORKFLOW.get(statusMatch[1]);
        const status = await instance.status();

        // Build step status map from workflow output
        const steps: Record<string, string> = {};
        const stepOrder = ['validate-csv', 'fetch-existing', 'deduplicate-merge', 'commit-to-github', 'trigger-rebuild'];

        // The status object has a `steps` array with name + status
        if (status.output && typeof status.output === 'object') {
          // Final result available
          stepOrder.forEach(s => steps[s] = 'complete');
        }

        return Response.json(
          {
            status: status.status,
            steps,
            output: status.output,
            error: status.error,
          },
          { headers: corsHeaders },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return Response.json({ error: message }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;
