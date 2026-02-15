import type { ClientData, AIInsight } from '../types';
import { el } from '../utils';

let rendered = false;

const ICON_MAP: Record<string, string> = {
  warning: '\u26a0', success: '\u2713', tip: '\ud83d\udca1', info: '\u2139',
};

const COLOR_MAP: Record<string, string> = {
  warning: 'insight-warning', success: 'insight-success',
  tip: 'insight-tip', info: 'insight-info',
};

export function renderInsights(data: ClientData): void {
  if (rendered) return;
  rendered = true;

  const panel = document.getElementById('tab-insights')!;
  panel.innerHTML = '';

  if (!data.insights.length) {
    panel.appendChild(el('div', { className: 'empty-state' }, 'No insights available.'));
    return;
  }

  const grid = el('div', { className: 'insights-grid' });
  for (const ins of data.insights) {
    const card = el('div', { className: `insight-card ${COLOR_MAP[ins.type] ?? 'insight-info'}` });

    const header = el('div', { className: 'insight-header' });
    header.appendChild(el('span', { className: 'insight-icon' }, ICON_MAP[ins.type] ?? '\u2139'));
    header.appendChild(el('span', { className: 'insight-title' }, ins.title));
    if (ins.metric) header.appendChild(el('span', { className: 'insight-metric' }, ins.metric));
    card.appendChild(header);

    card.appendChild(el('p', { className: 'insight-desc' }, ins.description));
    grid.appendChild(card);
  }
  panel.appendChild(grid);
}
