import { useMemo } from 'react';
import type { ClientData } from '../../lib/process-csv';
import ChartWrapper from './ChartWrapper';
import { fmtGBP } from './utils';

export default function OverviewTab({ data }: { data: ClientData }) {
  const { stats, monthly, balanceHistory, savingsHistory, categories, weekday } = data;

  const kpis = [
    { label: 'Current Balance', value: fmtGBP(stats.currentBalance), color: 'text-text-primary' },
    { label: 'Savings', value: fmtGBP(stats.savingsBalance), color: 'text-accent-sky' },
    { label: 'Total Income', value: fmtGBP(stats.totalIncome), color: 'text-accent-emerald' },
    { label: 'Total Spending', value: fmtGBP(stats.totalSpending), color: 'text-accent-rose' },
    { label: 'Savings Rate', value: stats.savingsRate.toFixed(1) + '%', color: 'text-accent-amber' },
    { label: 'Transactions', value: stats.totalTransactions.toLocaleString(), color: 'text-accent-violet' },
  ];

  const last18 = monthly.slice(-18);
  const spendCats = categories.filter((c) => c.total > 0);
  const maxSpend = Math.max(...weekday.map((w) => w.avgSpend), 1);

  const cashFlowConfig = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: last18.map((m) => m.month),
      datasets: [
        { label: 'Income', data: last18.map((m) => m.income), backgroundColor: 'rgba(52,211,153,0.75)', borderRadius: 4 },
        { label: 'Spending', data: last18.map((m) => m.spending), backgroundColor: 'rgba(251,113,133,0.75)', borderRadius: 4 },
      ],
    },
    options: {
      plugins: { legend: { position: 'top' as const, labels: { color: '#b0b0c0' } } },
      scales: {
        x: { ticks: { maxRotation: 45 } },
        y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } },
      },
    },
  }), [last18]);

  const balanceConfig = useMemo(() => ({
    type: 'line' as const,
    data: {
      labels: balanceHistory.map((b) => b.date),
      datasets: [{
        label: 'Balance', data: balanceHistory.map((b) => b.balance),
        borderColor: 'rgba(96,165,250,0.9)', backgroundColor: 'rgba(96,165,250,0.08)',
        fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } },
      },
    },
  }), [balanceHistory]);

  const savingsConfig = useMemo(() => ({
    type: 'line' as const,
    data: {
      labels: savingsHistory.map((b) => b.date),
      datasets: [{
        label: 'Savings', data: savingsHistory.map((b) => b.balance),
        borderColor: 'rgba(52,211,153,0.9)', backgroundColor: 'rgba(52,211,153,0.08)',
        fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } },
      },
    },
  }), [savingsHistory]);

  const donutConfig = useMemo(() => ({
    type: 'doughnut' as const,
    data: {
      labels: spendCats.map((c) => c.category),
      datasets: [{
        data: spendCats.map((c) => c.total),
        backgroundColor: spendCats.map((c) => c.color),
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { position: 'right' as const, labels: { color: '#b0b0c0', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${fmtGBP(ctx.parsed)}` } },
      },
    },
  }), [spendCats]);

  const weekdayConfig = useMemo(() => ({
    type: 'bar' as const,
    data: {
      labels: weekday.map((w) => w.day),
      datasets: [{
        label: 'Avg Daily Spend',
        data: weekday.map((w) => w.avgSpend),
        backgroundColor: weekday.map((w) => {
          const i = 0.3 + 0.7 * (w.avgSpend / maxSpend);
          return `rgba(251,113,133,${i.toFixed(2)})`;
        }),
        borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: (v: unknown) => fmtGBP(v as number) } } },
    },
  }), [weekday, maxSpend]);

  return (
    <div>
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-border-subtle rounded-2xl overflow-hidden mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="bg-bg-card p-5 flex flex-col gap-1">
            <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-text-muted">
              {k.label}
            </span>
            <span className={`font-mono text-2xl font-semibold leading-tight ${k.color}`}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Monthly Cash Flow */}
      <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6 hover:border-border-default transition-colors">
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Monthly Cash Flow</h3>
        <ChartWrapper config={cashFlowConfig} />
      </section>

      {/* Balance + Savings */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 hover:border-border-default transition-colors">
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Balance History</h3>
          <ChartWrapper config={balanceConfig} />
        </section>
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 hover:border-border-default transition-colors">
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Savings History</h3>
          <ChartWrapper config={savingsConfig} />
        </section>
      </div>

      {/* Category + Weekday */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 hover:border-border-default transition-colors">
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Spending by Category</h3>
          <ChartWrapper config={donutConfig} className="chart-wrap-sq" />
        </section>
        <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 hover:border-border-default transition-colors">
          <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Spending by Weekday</h3>
          <ChartWrapper config={weekdayConfig} className="chart-wrap-sq" />
        </section>
      </div>
    </div>
  );
}
