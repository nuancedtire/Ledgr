import type { ClientData, ClientTransaction } from '../types';
import { el, fmtGBP, fmtGBP2, fmtDate, defaultColor } from '../utils';
import { createChart, destroyChart, CHART_GRID, CHART_TICK } from '../charts';

let drilldown: string | null = null;
let dataRef: ClientData;

export function renderCategories(data: ClientData): void {
  dataRef = data;
  const panel = document.getElementById('tab-categories')!;
  panel.innerHTML = '';
  ['chart-cat-donut', 'chart-cat-trend', 'chart-cat-merchants'].forEach(destroyChart);

  if (drilldown) { renderDrilldown(panel); return; }

  const { categories } = data;
  const totalSpend = categories.reduce((s, c) => s + c.total, 0);
  const sorted = categories.filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  // Donut
  const sec = el('div', { className: 'chart-section' });
  sec.appendChild(el('h3', { className: 'chart-title' }, 'Spending by Category'));
  const canvas = el('canvas', { id: 'chart-cat-donut' });
  sec.appendChild(el('div', { className: 'chart-wrap' }, [canvas]));
  panel.appendChild(sec);

  createChart('chart-cat-donut', {
    type: 'doughnut',
    data: {
      labels: sorted.map(c => c.category),
      datasets: [{ data: sorted.map(c => c.total), backgroundColor: sorted.map(c => c.color || defaultColor(c.category)), borderWidth: 0 }],
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { color: '#b0b0c0', padding: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtGBP(ctx.parsed)} (${((ctx.parsed / totalSpend) * 100).toFixed(1)}%)` } },
      },
      onClick: (_: unknown, elems: { index: number }[]) => {
        if (elems.length) { drilldown = sorted[elems[0].index].category; renderCategories(dataRef); }
      },
    },
  });

  // Cards
  const list = el('div', { className: 'cat-list' });
  for (const c of sorted) {
    const pct = totalSpend > 0 ? ((c.total / totalSpend) * 100).toFixed(1) : '0.0';
    const avg = c.count > 0 ? c.total / c.count : 0;
    const card = el('div', { className: 'cat-card' });
    const bar = el('div', { className: 'cat-color-bar' });
    bar.style.backgroundColor = c.color || defaultColor(c.category);
    card.appendChild(bar);
    const info = el('div', { className: 'cat-info' });
    info.appendChild(el('div', { className: 'cat-name' }, c.category));
    info.appendChild(el('div', { className: 'cat-meta' }, `${c.count} transactions \u00b7 Avg ${fmtGBP2(avg)}`));
    card.appendChild(info);
    const right = el('div', { className: 'cat-right' });
    right.appendChild(el('div', { className: 'cat-total' }, fmtGBP(c.total)));
    right.appendChild(el('div', { className: 'cat-pct' }, pct + '%'));
    card.appendChild(right);
    card.addEventListener('click', () => { drilldown = c.category; renderCategories(dataRef); });
    list.appendChild(card);
  }
  panel.appendChild(list);
}

function renderDrilldown(panel: HTMLElement): void {
  const catName = drilldown!;
  const catInfo = dataRef.categories.find(c => c.category === catName);
  const catTx = dataRef.transactions.filter(t => t.cat === catName);
  const totalSpend = dataRef.categories.reduce((s, c) => s + c.total, 0);

  // Header
  const hdr = el('div', { className: 'drill-header' });
  hdr.appendChild(el('button', { className: 'btn btn-back', onClick: () => { drilldown = null; renderCategories(dataRef); } }, '\u2190 Back'));
  hdr.appendChild(el('h2', { className: 'drill-title' }, catName));
  panel.appendChild(hdr);

  // Stats
  const avg = catTx.length > 0 ? catTx.reduce((s, t) => s + Math.abs(t.amt), 0) / catTx.length : 0;
  const pct = totalSpend > 0 && catInfo ? ((catInfo.total / totalSpend) * 100).toFixed(1) : '0.0';
  const strip = el('div', { className: 'kpi-strip' });
  for (const k of [
    { label: 'Total', value: fmtGBP(catInfo?.total ?? 0) },
    { label: 'Transactions', value: String(catInfo?.count ?? 0) },
    { label: 'Avg Transaction', value: fmtGBP2(avg) },
    { label: '% of Spending', value: pct + '%' },
  ]) {
    const c = el('div', { className: 'kpi-card' });
    c.appendChild(el('div', { className: 'kpi-label' }, k.label));
    c.appendChild(el('div', { className: 'kpi-value' }, k.value));
    strip.appendChild(c);
  }
  panel.appendChild(strip);

  // Monthly trend
  const monthMap: Record<string, number> = {};
  for (const t of catTx) {
    const m = t.date.slice(0, 7);
    monthMap[m] = (monthMap[m] ?? 0) + Math.abs(t.amt);
  }
  const months = Object.keys(monthMap).sort();
  const sec1 = el('div', { className: 'chart-section' });
  sec1.appendChild(el('h3', { className: 'chart-title' }, 'Monthly Trend'));
  sec1.appendChild(el('div', { className: 'chart-wrap' }, [el('canvas', { id: 'chart-cat-trend' })]));
  panel.appendChild(sec1);
  createChart('chart-cat-trend', {
    type: 'bar',
    data: { labels: months, datasets: [{ label: catName, data: months.map(m => monthMap[m]), backgroundColor: catInfo?.color || defaultColor(catName), borderRadius: 4 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45 } }, y: { ticks: { callback: v => fmtGBP(v as number) } } } },
  });

  // Top merchants
  const merchMap: Record<string, { total: number; count: number }> = {};
  for (const t of catTx) {
    if (!merchMap[t.desc]) merchMap[t.desc] = { total: 0, count: 0 };
    merchMap[t.desc].total += Math.abs(t.amt);
    merchMap[t.desc].count++;
  }
  const topMerch = Object.entries(merchMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total).slice(0, 10);
  const sec2 = el('div', { className: 'chart-section' });
  sec2.appendChild(el('h3', { className: 'chart-title' }, 'Top Merchants'));
  sec2.appendChild(el('div', { className: 'chart-wrap' }, [el('canvas', { id: 'chart-cat-merchants' })]));
  panel.appendChild(sec2);
  createChart('chart-cat-merchants', {
    type: 'bar',
    data: { labels: topMerch.map(m => m.name.slice(0, 30)), datasets: [{ label: 'Spent', data: topMerch.map(m => m.total), backgroundColor: 'rgba(139,92,246,0.7)', borderRadius: 4 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => fmtGBP(v as number) } }, y: { ticks: { font: { size: 10 } } } } },
  });

  // Transaction list
  panel.appendChild(el('h3', { className: 'chart-title', style: 'margin-top:1.5rem' }, 'Recent Transactions'));
  panel.appendChild(buildTable(catTx.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100)));
}

function buildTable(txList: ClientTransaction[]): HTMLElement {
  const table = el('table', { className: 'tx-table' });
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['Date', 'Description', 'Amount', 'Balance']) hr.appendChild(el('th', null, h));
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el('tbody');
  if (txList.length === 0) {
    const tr = el('tr');
    tr.appendChild(el('td', { colSpan: '4', className: 'empty-state' }, 'No transactions.'));
    tbody.appendChild(tr);
  } else {
    for (const t of txList) {
      const tr = el('tr', { className: t.amt >= 0 ? 'income' : 'expense' });
      tr.appendChild(el('td', null, fmtDate(t.date)));
      tr.appendChild(el('td', { className: 'tx-desc' }, t.desc));
      tr.appendChild(el('td', { className: t.amt >= 0 ? 'amt-positive' : 'amt-negative' }, fmtGBP2(t.amt)));
      tr.appendChild(el('td', null, t.bal != null ? fmtGBP2(t.bal) : '\u2014'));
      tbody.appendChild(tr);
    }
  }
  table.appendChild(tbody);
  return table;
}
