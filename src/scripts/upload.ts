import type { WorkflowStatus } from './types';
import { el } from './utils';

declare global {
  interface Window {
    LEDGR_API?: string;
  }
}

const STEPS = [
  { id: 'upload', label: 'Uploading CSV' },
  { id: 'validate', label: 'Validating & parsing' },
  { id: 'fetch', label: 'Fetching existing data' },
  { id: 'deduplicate', label: 'Deduplicating & merging' },
  { id: 'commit', label: 'Committing to repository' },
  { id: 'rebuild', label: 'Triggering site rebuild' },
] as const;

type StepId = typeof STEPS[number]['id'];
type StepStatus = 'done' | 'active' | 'error' | '';

function renderSteps(activeIdx: number, statuses: Record<string, StepStatus>): void {
  const container = document.getElementById('progress-steps');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const status = statuses[step.id] || (i < activeIdx ? 'done' : i === activeIdx ? 'active' : '');
    const div = el('div', { className: `progress-step ${status}` });
    const icon = el('div', { className: 'progress-step-icon' });
    if (status === 'done') icon.textContent = '\u2713';
    else if (status === 'error') icon.textContent = '\u2717';
    else if (status === 'active') icon.textContent = '\u2026';
    else icon.textContent = String(i + 1);
    div.appendChild(icon);
    div.appendChild(el('span', null, step.label));
    container.appendChild(div);
  }
}

function setStatus(text: string): void {
  const s = document.getElementById('progress-status');
  if (s) s.textContent = text;
}

function reset(): void {
  const dz = document.getElementById('upload-dropzone');
  const pg = document.getElementById('upload-progress');
  if (dz) dz.style.display = '';
  if (pg) pg.style.display = 'none';
}

async function startUpload(file: File): Promise<void> {
  const dz = document.getElementById('upload-dropzone');
  const pg = document.getElementById('upload-progress');
  if (dz) dz.style.display = 'none';
  if (pg) pg.style.display = '';

  const statuses: Record<string, StepStatus> = {};
  renderSteps(0, statuses);
  setStatus('Reading file\u2026');

  try {
    const csvText = await file.text();
    const lines = csvText.trim().split('\n');
    setStatus(`Read ${lines.length - 1} rows`);
    statuses.upload = 'done';
    renderSteps(1, statuses);

    const api = window.LEDGR_API;
    if (!api) {
      // No API configured — show all done with info
      for (const s of STEPS) statuses[s.id] = 'done';
      renderSteps(STEPS.length, statuses);
      setStatus(`\u2139 No workflow API configured. Set window.LEDGR_API to your Worker URL. File has ${lines.length - 1} transactions ready.`);
      return;
    }

    setStatus('Sending to server\u2026');
    const resp = await fetch(`${api}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: csvText,
    });
    const { instanceId } = await resp.json() as { instanceId?: string };
    if (!instanceId) throw new Error('No instance ID returned');

    statuses.validate = 'active';
    renderSteps(1, statuses);
    await pollWorkflow(api, instanceId, statuses);
  } catch (err) {
    setStatus(`\u274c Error: ${err instanceof Error ? err.message : 'Unknown'}`);
  }
}

const STEP_MAPPING: Record<string, StepId> = {
  'validate-csv': 'validate',
  'fetch-existing': 'fetch',
  'deduplicate-merge': 'deduplicate',
  'commit-to-github': 'commit',
  'trigger-rebuild': 'rebuild',
};

async function pollWorkflow(api: string, instanceId: string, statuses: Record<string, StepStatus>): Promise<void> {
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const resp = await fetch(`${api}/status/${instanceId}`);
      const data = await resp.json() as WorkflowStatus;

      if (data.steps) {
        for (const [stepName, stepStatus] of Object.entries(data.steps)) {
          const mapped = STEP_MAPPING[stepName] ?? stepName;
          if (stepStatus === 'complete') statuses[mapped] = 'done';
          else if (stepStatus === 'running') statuses[mapped] = 'active';
          else if (stepStatus === 'error') statuses[mapped] = 'error';
        }
      }

      let activeIdx = STEPS.findIndex(s => statuses[s.id] === 'active');
      if (activeIdx === -1) activeIdx = STEPS.findIndex(s => !statuses[s.id]);
      renderSteps(activeIdx >= 0 ? activeIdx : STEPS.length, statuses);

      if (data.status === 'complete') {
        for (const s of STEPS) statuses[s.id] = 'done';
        renderSteps(STEPS.length, statuses);
        setStatus('\u2705 Done! New data committed. Site will rebuild in ~1 minute.');
        return;
      }
      if (data.status === 'errored') {
        setStatus(`\u274c Workflow failed: ${data.error ?? 'Unknown error'}`);
        return;
      }
      setStatus(`Processing\u2026 (${data.status ?? 'running'})`);
    } catch {
      // Polling error, retry
    }
  }
  setStatus('\u26a0 Timed out waiting. Check back later.');
}

export function initUpload(): void {
  const btn = document.getElementById('upload-btn');
  const modal = document.getElementById('upload-modal');
  const close = document.getElementById('upload-close');
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('upload-file') as HTMLInputElement | null;
  if (!btn || !modal || !dropzone || !fileInput) return;

  btn.addEventListener('click', () => { reset(); modal.classList.add('open'); });
  close?.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file?.name.endsWith('.csv')) startUpload(file);
  });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) startUpload(fileInput.files[0]);
  });
}
