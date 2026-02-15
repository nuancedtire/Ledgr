import { useState, useMemo } from 'react';
import type { ClientData } from '../../lib/process-csv';
import ChartWrapper from './ChartWrapper';
import { fmtGBP, fmtGBP2, fmtDate } from './utils';

export default function CategoriesTab({ data }: { data: ClientData }) {
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const { categories, transactions } = data;
  const totalSpend = categories.reduce((s, c) => s + c.total, 0);
  const sorted = categories.filter((c) => c.total > 0);

  if (drilldown) {
    const catInfo = categories.find((c) => c.category === drilldown);
    const catTx = transactions.filter((t) => t.category === drilldown);
    const avg = catTx.length > 0 ? catTx.reduce((s, t) => s + Math.abs(t.amount), 0) / catTx.length : 0;
    const pct = totalSpend > 0 && catInfo ? ((catInfo.total / totalSpend) * 100).toFixed(1) : '0.0';

    const monthMap: Record<string, number> = {};
    for (const t of catTx) { const m = t.startedDate.slice(0, 7); monthMap[m] = (monthMap[m] ?? 0) + Math.abs(t.amount); }
    const months = Object.keys(monthMap).sort();

    const merchMap: Record<string, { total: number; count: number }> = {};
    for (const t of catTx) {
      if (!merchMap[t.description]) merchMap[t.description] = { total: 0, count: 0 };
      merchMap[t.description].total += Math.abs(t.amount);
      merchMap[t.description].count++;
    }
    const topMerch = Object.entries(merchMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total).slice(0, 10);

    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setDrilldown(null)} className="text-accent-sky hover:text-text-primary font-medium transition-colors">\u2190 Back</button>
          <h2 className="font-serif italic text-2xl">{drilldown}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle rounded-2xl overflow-hidden mb-6">
          {[{ label: 'Total', value: fmtGBP(catInfo?.total ?? 0) }, { label: 'Transactions', value: String(catInfo?.count ?? 0) }, { label: 'Avg Transaction', value: fmtGBP2(avg) }, { label: '% of Spending', value: pct + '%' }].map((k) => (
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
              data: { labels: months, datasets: [{ label: drilldown, data: months.map((m) => monthMap[m]), backgroundColor: catInfo?.color || '#9ca3af', borderRadius: 4 }] },
              options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45 } }, y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } } } },
            }} />
          </section>
        )}
        {topMerch.length > 0 && (
          <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6">
            <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Top Merchants</h3>
            <ChartWrapper config={{
              type: 'bar',
              data: { labels: topMerch.map((m) => m.name.slice(0, 30)), datasets: [{ label: 'Spent', data: topMerch.map((m) => m.total), backgroundColor: 'rgba(139,92,246,0.7)', borderRadius: 4 }] },
              options: { indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } }, y: { ticks: { font: { size: 10 } } } } },
            }} />
          </section>
        )}
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Recent Transactions</h3>
        <TxTable txns={catTx.sort((a, b) => b.startedDate.localeCompare(a.startedDate)).slice(0, 100)} />
      </div>
    );
  }

  const donutConfig = useMemo(() => ({
    type: 'doughnut' as const,
    data: {
      labels: sorted.map((c) => c.category),
      datasets: [{ data: sorted.map((c) => c.total), backgroundColor: sorted.map((c) => c.color), borderWidth: 0 }],
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { position: 'right' as const, labels: { color: '#b0b0c0', padding: 8, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${fmtGBP(ctx.parsed)} (${((ctx.parsed / totalSpend) * 100).toFixed(1)}%)` } },
      },
    },
  }), [sorted, totalSpend]);

  return (
    <div>
      <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Spending by Category</h3>
        <ChartWrapper config={donutConfig} />
      </section>
      <div className="flex flex-col gap-2">
        {sorted.map((c) => {
          const pct = totalSpend > 0 ? ((c.total / totalSpend) * 100).toFixed(1) : '0.0';
          const avg = c.count > 0 ? c.total / c.count : 0;
          return (
            <div
              key={c.category}
              onClick={() => setDrilldown(c.category)}
              className="flex items-center gap-3 px-4 py-3 bg-bg-card border border-border-subtle rounded-lg cursor-pointer hover:border-border-default hover:bg-bg-card-hover hover:translate-x-0.5 transition-all"
            >
              <div className="w-1 h-9 rounded-sm flex-shrink-0" style={{ backgroundColor: c.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary">{c.category}</div>
                <div className="text-xs text-text-muted">{c.count} transactions \u00b7 Avg {fmtGBP2(avg)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-sm font-medium text-text-primary">{fmtGBP(c.total)}</div>
                <div className="text-xs text-text-muted">{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TxTable({ txns }: { txns: ClientData['transactions'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {['Date', 'Description', 'Amount', 'Balance'].map((h) => (
              <th key={h} className="text-left px-2 py-2 text-text-muted text-[0.7rem] uppercase tracking-wider font-semibold border-b border-border-default">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txns.length === 0 ? (
            <tr><td colSpan={4} className="text-center py-8 text-text-muted">No transactions.</td></tr>
          ) : (
            txns.map((t) => (
              <tr key={t.id} className="hover:bg-white/[0.015]">
                <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{fmtDate(t.startedDate)}</td>
                <td className="px-2 py-2 border-b border-border-subtle font-medium text-text-primary">{t.description}</td>
                <td className={`px-2 py-2 border-b border-border-subtle font-mono font-medium text-right whitespace-nowrap ${t.amount >= 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>{fmtGBP2(t.amount)}</td>
                <td className="px-2 py-2 border-b border-border-subtle text-text-secondary">{t.balance != null ? fmtGBP2(t.balance) : '\u2014'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
