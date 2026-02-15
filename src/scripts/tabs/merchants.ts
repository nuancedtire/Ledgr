import type { ClientData, ClientTransaction } from '../types';
import { el, fmtGBP, fmtGBP2, fmtDate } from '../utils';
import { createChart, destroyChart, CHART_GRID, CHART_TICK } from '../charts';

let drilldown: string | null = null;
let search = '';
let dataRef: ClientData;

export function renderMerchants(data: ClientData): void {
  dataRef = data;
  const panel = document.getElementById('tab-merchants')!;
  panel.innerHTML = '';
  ['chart-merch-top10', 'chart-merch-trend'].forEach(destroyChart);

  if (drilldown) { renderDrilldown(panel); return; }

  const { merchants } = data;

  // Search
  const bar = el('div', { className: 'tx-filters' });
  const input = el('input', { type: 'text', placeholder: 'Search merchants\u2026', className: 'filter-input', value: search }) as HTMLInputElement;
  input.addEventListener('input', () => { search = input.value; renderList(); });
  bar.appendChild(input);
  panel.appendChild(bar);

  // Top 10 chart
  const sec = el('div', { className: 'chart-section' });
  sec.appendChild(el('h3', { className: 'chart-title' }, 'Top 10 Merchants'));
  sec.appendChild(el('div', { className: 'chart-wrap' }, [el('canvas', { id: 'chart-merch-top10' })]));
  panel.appendChild(sec);

  const top10 = merchants.slice(0, 10);
  createChart('chart-merch-top10', {
    type: 'bar',
    data: {
      labels: top10.map(m => m.name.slice(0, 25)),
      datasets: [{ label: 'Total Spent', data: top10.map(m => m.total), backgroundColor: 'rgba(251,191,36,0.7)', borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: v => fmtGBP(v as number) } }, y: { ticks: { font: { size: 11 } } } },
    },
  });

  panel.appendChild(el('div', { id: 'merch-list-wrap' }));
  renderList();
}

function renderList(): void {
  const wrap = document.getElementById('merch-list-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  let list = dataRef.merchants.slice(0, 30);
  if (search) {
    const q = search.toLowerCase();
    list = dataRef.merchants.filter(m => m.name.toLowerCase().includes(q)).slice(0, 30);
  }

  if (list.length === 0) { wrap.appendChild(el('div', { className: 'empty-state' }, 'No merchants found.')); return; }

  const grid = el('div', { className: 'merch-grid' });
  for (const m of list) {
    const card = el('div', { className: 'merch-card' });
    card.appendChild(el('div', { className: 'merch-name' }, m.name));
    const meta = el('div', { className: 'merch-meta' });
    meta.appendChild(el('span', null, fmtGBP(m.total)));
    meta.appendChild(el('span', { className: 'merch-count' }, `${m.count} transactions`));
    meta.appendChild(el('span', null, `Avg: ${fmtGBP2(m.avgTransaction)}`));
    card.appendChild(meta);
    card.addEventListener('click', () => { drilldown = m.name; renderMerchants(dataRef); });
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
}

function renderDrilldown(panel: HTMLElement): void {
  const name = drilldown!;
  const info = dataRef.merchants.find(m => m.name === name);
  const mtx = dataRef.transactions.filter(t => t.desc === name).sort((a, b) => b.date.localeCompare(a.date));

  // Header
  const hdr = el('div', { className: 'drill-header' });
  hdr.appendChild(el('button', { className: 'btn btn-back', onClick: () => { drilldown = null; renderMerchants(dataRef); } }, '\u2190 Back'));
  hdr.appendChild(el('h2', { className: 'drill-title' }, name));
  panel.appendChild(hdr);

  // Stats
  const totalAmt = mtx.reduce((s, t) => s + Math.abs(t.amt), 0);
  const avg = mtx.length > 0 ? totalAmt / mtx.length : 0;
  let frequency = '\u2014';
  if (mtx.length > 1) {
    const first = mtx[mtx.length - 1].date;
    const last = mtx[0].date;
    const days = (new Date(last).getTime() - new Date(first).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 0) frequency = `${(days / mtx.length).toFixed(0)} days apart`;
  }

  const strip = el('div', { className: 'kpi-strip' });
  for (const k of [
    { label: 'Total Spent', value: fmtGBP(info?.total ?? totalAmt) },
    { label: 'Transactions', value: String(mtx.length) },
    { label: 'Avg Transaction', value: fmtGBP2(avg) },
    { label: 'Frequency', value: frequency },
  ]) {
    const c = el('div', { className: 'kpi-card' });
    c.appendChild(el('div', { className: 'kpi-label' }, k.label));
    c.appendChild(el('div', { className: 'kpi-value' }, k.value));
    strip.appendChild(c);
  }
  panel.appendChild(strip);

  // Monthly trend
  const monthMap: Record<string, number> = {};
  for (const t of mtx) {
    const m = t.date.slice(0, 7);
    monthMap[m] = (monthMap[m] ?? 0) + Math.abs(t.amt);
  }
  const months = Object.keys(monthMap).sort();
  if (months.length > 0) {
    const sec = el('div', { className: 'chart-section' });
    sec.appendChild(el('h3', { className: 'chart-title' }, 'Monthly Trend'));
    sec.appendChild(el('div', { className: 'chart-wrap' }, [el('canvas', { id: 'chart-merch-trend' })]));
    panel.appendChild(sec);
    createChart('chart-merch-trend', {
      type: 'bar',
      data: { labels: months, datasets: [{ label: name, data: months.map(m => monthMap[m]), backgroundColor: 'rgba(251,191,36,0.7)', borderRadius: 4 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45 } }, y: { ticks: { callback: v => fmtGBP(v as number) } } } },
    });
  }

  // Transactions
  panel.appendChild(el('h3', { className: 'chart-title', style: 'margin-top:1.5rem' }, 'Transactions'));
  const table = el('table', { className: 'tx-table' });
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['Date', 'Description', 'Amount', 'Balance']) hr.appendChild(el('th', null, h));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  for (const t of mtx.slice(0, 100)) {
    const tr = el('tr', { className: t.amt >= 0 ? 'income' : 'expense' });
    tr.appendChild(el('td', null, fmtDate(t.date)));
    tr.appendChild(el('td', { className: 'tx-desc' }, t.desc));
    tr.appendChild(el('td', { className: t.amt >= 0 ? 'amt-positive' : 'amt-negative' }, fmtGBP2(t.amt)));
    tr.appendChild(el('td', null, t.bal != null ? fmtGBP2(t.bal) : '\u2014'));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  panel.appendChild(table);
}
