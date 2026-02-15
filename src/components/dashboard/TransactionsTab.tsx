import { useState, useMemo } from 'react';
import type { ClientData, Transaction } from '../../lib/process-csv';
import { fmtGBP2, fmtDate, escapeCSV } from './utils';

const PER_PAGE = 50;

export default function TransactionsTab({ data }: { data: ClientData }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [amtMin, setAmtMin] = useState('');
  const [amtMax, setAmtMax] = useState('');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allCats = useMemo(() => [...new Set(data.transactions.map((t) => t.category))].sort(), [data]);
  const allTypes = useMemo(() => [...new Set(data.transactions.map((t) => t.type))].sort(), [data]);

  const filtered = useMemo(() => {
    let list = data.transactions.slice();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.description.toLowerCase().includes(q));
    }
    if (catFilter) list = list.filter((t) => t.category === catFilter);
    if (typeFilter) list = list.filter((t) => t.type === typeFilter);
    if (monthFrom) list = list.filter((t) => t.startedDate.slice(0, 7) >= monthFrom);
    if (monthTo) list = list.filter((t) => t.startedDate.slice(0, 7) <= monthTo);
    if (amtMin) list = list.filter((t) => Math.abs(t.amount) >= Number(amtMin));
    if (amtMax) list = list.filter((t) => Math.abs(t.amount) <= Number(amtMax));

    const dir = sortDir === 'asc' ? 1 : -1;
    const fns: Record<string, (a: Transaction, b: Transaction) => number> = {
      date: (a, b) => a.startedDate.localeCompare(b.startedDate) * dir,
      amount: (a, b) => (a.amount - b.amount) * dir,
      desc: (a, b) => a.description.localeCompare(b.description) * dir,
      cat: (a, b) => a.category.localeCompare(b.category) * dir,
      bal: (a, b) => ((a.balance ?? 0) - (b.balance ?? 0)) * dir,
    };
    list.sort(fns[sortKey] ?? fns.date);
    return list;
  }, [data, search, catFilter, typeFilter, monthFrom, monthTo, amtMin, amtMax, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.max(1, Math.min(page, totalPages));
  const paged = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function exportCSV() {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Fee', 'Balance', 'State', 'Product'];
    const rows = filtered.map((t) =>
      [t.startedDate.slice(0, 10), t.description, t.category, t.type, t.amount, t.fee, t.balance, t.state, t.product].map(escapeCSV).join(','),
    );
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortArrow = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' \u25b2' : ' \u25bc') : '';

  const selectClass = 'bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm cursor-pointer appearance-none min-w-[130px]';
  const inputClass = 'bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-accent-emerald placeholder:text-text-muted transition-colors';

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input className={`${inputClass} flex-1 min-w-[180px]`} placeholder="Search description\u2026" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className={selectClass} value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectClass} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-[0.7rem] text-text-muted uppercase tracking-wider">From</span>
        <input type="month" className={`${inputClass} min-w-[130px] flex-0`} value={monthFrom} onChange={(e) => { setMonthFrom(e.target.value); setPage(1); }} />
        <span className="text-[0.7rem] text-text-muted uppercase tracking-wider">To</span>
        <input type="month" className={`${inputClass} min-w-[130px] flex-0`} value={monthTo} onChange={(e) => { setMonthTo(e.target.value); setPage(1); }} />
        <input type="number" className={`${inputClass} min-w-[80px] max-w-[100px] flex-0`} placeholder="Min \u00a3" value={amtMin} onChange={(e) => { setAmtMin(e.target.value); setPage(1); }} />
        <input type="number" className={`${inputClass} min-w-[80px] max-w-[100px] flex-0`} placeholder="Max \u00a3" value={amtMax} onChange={(e) => { setAmtMax(e.target.value); setPage(1); }} />
        <button onClick={exportCSV} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium border border-accent-violet/25 bg-accent-violet/10 text-accent-violet hover:bg-accent-violet/[0.18] transition-colors whitespace-nowrap">
          \u21e9 CSV
        </button>
      </div>

      {/* Summary */}
      <p className="text-sm text-text-muted mb-3">
        Showing {filtered.length} of {data.transactions.length} transactions \u00b7 Total: {fmtGBP2(total)}
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[{ key: 'date', label: 'Date' }, { key: 'desc', label: 'Description' }, { key: 'cat', label: 'Category' }, { key: 'amount', label: 'Amount' }, { key: 'bal', label: 'Balance' }].map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-left px-2 py-2 text-text-muted text-[0.7rem] uppercase tracking-wider font-semibold border-b border-border-default cursor-pointer hover:text-text-primary whitespace-nowrap select-none"
                >
                  {col.label}{sortArrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-text-muted">No transactions match your filters.</td></tr>
            ) : (
              paged.map((t) => (
                <>
                  <tr
                    key={t.id}
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                    className="cursor-pointer hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{fmtDate(t.startedDate)}</td>
                    <td className="px-2 py-2 border-b border-border-subtle font-medium text-text-primary max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap">{t.description}</td>
                    <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{t.category}</td>
                    <td className={`px-2 py-2 border-b border-border-subtle font-mono font-medium text-right whitespace-nowrap ${t.amount >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                      {fmtGBP2(t.amount)}
                    </td>
                    <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{t.balance != null ? fmtGBP2(t.balance) : '\u2014'}</td>
                  </tr>
                  {expandedId === t.id && (
                    <tr key={`${t.id}-detail`}>
                      <td colSpan={5} className="bg-bg-elevated px-4 py-3 border-b border-border-default">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          {[
                            ['Date', fmtDate(t.startedDate)],
                            ['Time', t.startedDate.slice(11, 16) || '\u2014'],
                            ['Type', t.type],
                            ['Product', t.product || '\u2014'],
                            ['State', t.state || '\u2014'],
                            ['Fee', fmtGBP2(t.fee)],
                            ['Balance', t.balance != null ? fmtGBP2(t.balance) : '\u2014'],
                            ['Category', t.category],
                          ].map(([lbl, val]) => (
                            <div key={lbl}>
                              <span className="text-text-muted font-medium">{lbl}:</span>{' '}
                              <span className="text-text-primary">{val}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4 flex-wrap">
          <PagerBtn label="\u2039" onClick={() => setPage(curPage - 1)} disabled={curPage === 1} />
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) p = i + 1;
            else if (curPage <= 4) p = i + 1;
            else if (curPage >= totalPages - 3) p = totalPages - 6 + i;
            else p = curPage - 3 + i;
            return <PagerBtn key={p} label={p} onClick={() => setPage(p)} active={p === curPage} />;
          })}
          <PagerBtn label="\u203a" onClick={() => setPage(curPage + 1)} disabled={curPage === totalPages} />
        </div>
      )}
    </div>
  );
}

function PagerBtn({ label, onClick, disabled, active }: {
  label: string | number; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`min-w-[32px] h-8 flex items-center justify-center rounded-md border text-sm font-sans transition-all ${
        active
          ? 'bg-accent-emerald border-accent-emerald text-bg-primary font-semibold'
          : disabled
            ? 'border-border-subtle bg-bg-card text-text-secondary opacity-30 cursor-not-allowed'
            : 'border-border-subtle bg-bg-card text-text-secondary hover:border-border-default hover:text-text-primary cursor-pointer'
      }`}
    >
      {label}
    </button>
  );
}
