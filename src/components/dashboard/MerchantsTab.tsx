import { useState, useMemo } from 'react';
import type { ClientData } from '../../lib/process-csv';
import ChartWrapper from './ChartWrapper';
import { fmtGBP, fmtGBP2, fmtDate } from './utils';

export default function MerchantsTab({ data }: { data: ClientData }) {
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { merchants, transactions } = data;

  if (drilldown) {
    const info = merchants.find((m) => m.name === drilldown);
    const mtx = transactions.filter((t) => t.description === drilldown).sort((a, b) => b.startedDate.localeCompare(a.startedDate));
    const totalAmt = mtx.reduce((s, t) => s + Math.abs(t.amount), 0);
    const avg = mtx.length > 0 ? totalAmt / mtx.length : 0;
    let frequency = '\u2014';
    if (mtx.length > 1) {
      const first = mtx[mtx.length - 1].startedDate;
      const last = mtx[0].startedDate;
      const days = (new Date(last).getTime() - new Date(first).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0) frequency = `${(days / mtx.length).toFixed(0)} days apart`;
    }

    const monthMap: Record<string, number> = {};
    for (const t of mtx) { const m = t.startedDate.slice(0, 7); monthMap[m] = (monthMap[m] ?? 0) + Math.abs(t.amount); }
    const months = Object.keys(monthMap).sort();

    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setDrilldown(null)} className="text-accent-sky hover:text-text-primary font-medium transition-colors">\u2190 Back</button>
          <h2 className="font-serif italic text-2xl">{drilldown}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle rounded-2xl overflow-hidden mb-6">
          {[{ label: 'Total Spent', value: fmtGBP(info?.total ?? totalAmt) }, { label: 'Transactions', value: String(mtx.length) }, { label: 'Avg Transaction', value: fmtGBP2(avg) }, { label: 'Frequency', value: frequency }].map((k) => (
            <div key={k.label} className="bg-bg-card p-4 flex flex-col gap-1">
              <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-text-muted">{k.label}</span>
              <span className="font-mono text-lg font-semibold text-text-primary">{k.value}</span>
            </div>
          ))}
        </div>
        {months.length > 0 && (
          <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6">
            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Monthly Trend</h3>
            <ChartWrapper config={{
              type: 'bar',
              data: { labels: months, datasets: [{ label: drilldown, data: months.map((m) => monthMap[m]), backgroundColor: 'rgba(251,191,36,0.7)', borderRadius: 4 }] },
              options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45 } }, y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } } } },
            }} />
          </section>
        )}
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{['Date', 'Description', 'Amount', 'Balance'].map((h) => <th key={h} className="text-left px-2 py-2 text-text-muted text-[0.7rem] uppercase tracking-wider font-semibold border-b border-border-default">{h}</th>)}</tr></thead>
            <tbody>
              {mtx.slice(0, 100).map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.015]">
                  <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{fmtDate(t.startedDate)}</td>
                  <td className="px-2 py-2 border-b border-border-subtle font-medium text-text-primary">{t.description}</td>
                  <td className={`px-2 py-2 border-b border-border-subtle font-mono font-medium text-right whitespace-nowrap ${t.amount >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>{fmtGBP2(t.amount)}</td>
                  <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{t.balance != null ? fmtGBP2(t.balance) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const top10 = merchants.slice(0, 10);
  const filteredMerchants = search
    ? merchants.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : merchants.slice(0, 30);

  const barConfig = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: top10.map((m) => m.name.slice(0, 25)),
      datasets: [{ label: 'Total Spent', data: top10.map((m) => m.total), backgroundColor: 'rgba(251,191,36,0.7)', borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y' as const,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } }, y: { ticks: { font: { size: 11 } } } },
    },
  }), [top10]);

  return (
    <div>
      <input
        className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm outline-none focus:border-accent-emerald placeholder:text-text-muted mb-4"
        placeholder="Search merchants\u2026"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Top 10 Merchants</h3>
        <ChartWrapper config={barConfig} />
      </section>
      {filteredMerchants.length === 0 ? (
        <div className="text-center py-8 text-text-muted">No merchants found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMerchants.map((m) => (
            <div
              key={m.name}
              onClick={() => setDrilldown(m.name)}
              className="bg-bg-card border border-border-subtle rounded-lg px-4 py-3 cursor-pointer hover:border-border-default hover:bg-bg-card-hover hover:-translate-y-px transition-all"
            >
              <div className="text-sm font-semibold text-text-primary mb-1 overflow-hidden text-ellipsis whitespace-nowrap">{m.name}</div>
              <div className="flex gap-3 text-xs text-text-muted">
                <span className="text-accent-rose font-mono font-medium">{fmtGBP(m.total)}</span>
                <span>{m.count} transactions</span>
                <span>Avg: {fmtGBP2(m.avgTransaction)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
