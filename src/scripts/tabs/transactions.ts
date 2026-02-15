import type { ClientData, ClientTransaction } from '../types';
import { el, fmtGBP2, fmtDate, paginate, escapeCSV } from '../utils';

const PER_PAGE = 50;

interface TxState {
  page: number;
  sort: string;
  dir: 'asc' | 'desc';
  search: string;
  cat: string;
  type: string;
  monthFrom: string;
  monthTo: string;
  amtMin: string;
  amtMax: string;
}

const state: TxState = {
  page: 1, sort: 'date', dir: 'desc',
  search: '', cat: '', type: '',
  monthFrom: '', monthTo: '', amtMin: '', amtMax: '',
};

let allTx: ClientTransaction[] = [];

function getFiltered(): ClientTransaction[] {
  let list = allTx.slice();
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(t => t.desc.toLowerCase().includes(q));
  }
  if (state.cat) list = list.filter(t => t.cat === state.cat);
  if (state.type) list = list.filter(t => t.type === state.type);
  if (state.monthFrom) list = list.filter(t => t.date.slice(0, 7) >= state.monthFrom);
  if (state.monthTo) list = list.filter(t => t.date.slice(0, 7) <= state.monthTo);
  if (state.amtMin) list = list.filter(t => Math.abs(t.amt) >= Number(state.amtMin));
  if (state.amtMax) list = list.filter(t => Math.abs(t.amt) <= Number(state.amtMax));

  const dir = state.dir === 'asc' ? 1 : -1;
  const sortFns: Record<string, (a: ClientTransaction, b: ClientTransaction) => number> = {
    date: (a, b) => (a.date + a.time).localeCompare(b.date + b.time) * dir,
    amount: (a, b) => (a.amt - b.amt) * dir,
    desc: (a, b) => a.desc.localeCompare(b.desc) * dir,
    cat: (a, b) => a.cat.localeCompare(b.cat) * dir,
    bal: (a, b) => ((a.bal ?? 0) - (b.bal ?? 0)) * dir,
  };
  list.sort(sortFns[state.sort] ?? sortFns.date);
  return list;
}

function renderTable(): void {
  const filtered = getFiltered();
  const paged = paginate(filtered, state.page, PER_PAGE);
  const total = filtered.reduce((s, t) => s + t.amt, 0);

  const summary = document.getElementById('tx-summary');
  if (summary) summary.textContent = `Showing ${filtered.length} of ${allTx.length} transactions \u00b7 Total: ${fmtGBP2(total)}`;

  const wrap = document.getElementById('tx-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (filtered.length === 0) {
    wrap.appendChild(el('div', { className: 'empty-state' }, 'No transactions match your filters.'));
    return;
  }

  const table = el('table', { className: 'tx-table' });
  const thead = el('thead');
  const hr = el('tr');
  const cols = [
    { key: 'date', label: 'Date' },
    { key: 'desc', label: 'Description' },
    { key: 'cat', label: 'Category' },
    { key: 'amount', label: 'Amount' },
    { key: 'bal', label: 'Balance' },
  ];

  for (const c of cols) {
    const arrow = state.sort === c.key ? (state.dir === 'asc' ? ' \u25b2' : ' \u25bc') : '';
    const th = el('th', { className: 'sortable' }, c.label + arrow);
    th.addEventListener('click', () => {
      if (state.sort === c.key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort = c.key; state.dir = 'asc'; }
      renderTable();
    });
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const t of paged.items) {
    const tr = el('tr', { className: `tx-row${t.amt > 0 ? ' income' : ' expense'}` });
    tr.appendChild(el('td', null, fmtDate(t.date)));
    tr.appendChild(el('td', { className: 'tx-desc' }, t.desc));
    tr.appendChild(el('td', null, t.cat));
    tr.appendChild(el('td', { className: t.amt >= 0 ? 'amt-positive' : 'amt-negative' }, fmtGBP2(t.amt)));
    tr.appendChild(el('td', null, t.bal != null ? fmtGBP2(t.bal) : '\u2014'));
    tr.addEventListener('click', () => toggleDetail(t, tr));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  renderPager(paged.currentPage, paged.totalPages);
}

function toggleDetail(t: ClientTransaction, tr: HTMLElement): void {
  const next = tr.nextElementSibling;
  if (next?.classList.contains('tx-detail-row')) { next.remove(); return; }
  document.querySelectorAll('.tx-detail-row').forEach(r => r.remove());

  const detail = el('tr', { className: 'tx-detail-row' });
  const td = el('td', { colSpan: '5' });
  const grid = el('div', { className: 'tx-detail-grid' });

  const fields: [string, string][] = [
    ['Date', fmtDate(t.date)], ['Time', t.time || '\u2014'],
    ['Type', t.type], ['Product', t.product || '\u2014'],
    ['State', t.state || '\u2014'], ['Fee', fmtGBP2(t.fee)],
    ['Balance', t.bal != null ? fmtGBP2(t.bal) : '\u2014'], ['Category', t.cat],
  ];
  for (const [lbl, val] of fields) {
    grid.appendChild(el('span', { className: 'detail-label' }, lbl + ':'));
    grid.appendChild(el('span', { className: 'detail-value' }, val));
  }
  td.appendChild(grid);
  detail.appendChild(td);
  tr.after(detail);
}

function renderPager(current: number, total: number): void {
  const wrap = document.getElementById('tx-pager');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (total <= 1) return;

  const addBtn = (label: string | number, page: number, disabled: boolean) => {
    const btn = el('button', {
      className: `pager-btn${page === current ? ' active' : ''}${disabled ? ' disabled' : ''}`,
    }, String(label));
    if (!disabled && page !== current) {
      btn.addEventListener('click', () => { state.page = page; renderTable(); });
    }
    wrap.appendChild(btn);
  };

  addBtn('\u2039', current - 1, current === 1);
  const pages: (number | string)[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  for (const p of pages) {
    if (p === '...') wrap.appendChild(el('span', { className: 'pager-dots' }, '\u2026'));
    else addBtn(p, p as number, false);
  }
  addBtn('\u203a', current + 1, current === total);
}

function exportCSV(): void {
  const filtered = getFiltered();
  const headers = ['Date', 'Time', 'Description', 'Category', 'Type', 'Amount', 'Fee', 'Balance', 'State', 'Product'];
  const rows = filtered.map(t =>
    [t.date, t.time, t.desc, t.cat, t.type, t.amt, t.fee, t.bal, t.state, t.product]
      .map(escapeCSV).join(',')
  );
  const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderTransactions(data: ClientData): void {
  allTx = data.transactions;
  const panel = document.getElementById('tab-transactions')!;
  panel.innerHTML = '';

  const allCats = [...new Set(allTx.map(t => t.cat))].sort();
  const allTypes = [...new Set(allTx.map(t => t.type))].sort();

  // ── Filter bar ──
  const bar = el('div', { className: 'tx-filters' });

  const searchInput = el('input', { type: 'text', placeholder: 'Search description\u2026', className: 'filter-input', value: state.search }) as HTMLInputElement;
  searchInput.addEventListener('input', () => { state.search = searchInput.value; state.page = 1; renderTable(); });
  bar.appendChild(searchInput);

  const catSel = el('select', { className: 'filter-select' }) as HTMLSelectElement;
  catSel.appendChild(el('option', { value: '' }, 'All Categories'));
  for (const c of allCats) {
    const o = el('option', { value: c }, c) as HTMLOptionElement;
    if (c === state.cat) o.selected = true;
    catSel.appendChild(o);
  }
  catSel.addEventListener('change', () => { state.cat = catSel.value; state.page = 1; renderTable(); });
  bar.appendChild(catSel);

  const typeSel = el('select', { className: 'filter-select' }) as HTMLSelectElement;
  typeSel.appendChild(el('option', { value: '' }, 'All Types'));
  for (const t of allTypes) {
    const o = el('option', { value: t }, t) as HTMLOptionElement;
    if (t === state.type) o.selected = true;
    typeSel.appendChild(o);
  }
  typeSel.addEventListener('change', () => { state.type = typeSel.value; state.page = 1; renderTable(); });
  bar.appendChild(typeSel);

  bar.appendChild(el('label', { className: 'filter-label' }, 'From'));
  const mfrom = el('input', { type: 'month', className: 'filter-input filter-month', value: state.monthFrom }) as HTMLInputElement;
  mfrom.addEventListener('change', () => { state.monthFrom = mfrom.value; state.page = 1; renderTable(); });
  bar.appendChild(mfrom);

  bar.appendChild(el('label', { className: 'filter-label' }, 'To'));
  const mto = el('input', { type: 'month', className: 'filter-input filter-month', value: state.monthTo }) as HTMLInputElement;
  mto.addEventListener('change', () => { state.monthTo = mto.value; state.page = 1; renderTable(); });
  bar.appendChild(mto);

  const amtMin = el('input', { type: 'number', placeholder: 'Min \u00a3', className: 'filter-input filter-amt', value: state.amtMin }) as HTMLInputElement;
  amtMin.addEventListener('input', () => { state.amtMin = amtMin.value; state.page = 1; renderTable(); });
  bar.appendChild(amtMin);

  const amtMax = el('input', { type: 'number', placeholder: 'Max \u00a3', className: 'filter-input filter-amt', value: state.amtMax }) as HTMLInputElement;
  amtMax.addEventListener('input', () => { state.amtMax = amtMax.value; state.page = 1; renderTable(); });
  bar.appendChild(amtMax);

  bar.appendChild(el('button', { className: 'btn btn-export', onClick: exportCSV }, '\u21e9 CSV'));
  panel.appendChild(bar);

  panel.appendChild(el('div', { className: 'tx-summary', id: 'tx-summary' }));
  panel.appendChild(el('div', { className: 'tx-table-wrap', id: 'tx-table-wrap' }));
  panel.appendChild(el('div', { className: 'tx-pager', id: 'tx-pager' }));

  renderTable();
}
