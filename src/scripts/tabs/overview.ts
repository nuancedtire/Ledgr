import type { ClientData } from '../types';
import { el, fmtGBP, defaultColor } from '../utils';
import { createChart, CHART_GRID, CHART_TICK } from '../charts';

let rendered = false;

export function renderOverview(data: ClientData): void {
  if (rendered) return;
  rendered = true;

  const panel = document.getElementById('tab-overview')!;
  panel.innerHTML = '';
  const { stats, monthly, balanceHistory, savingsHistory, categories, weekday } = data;

  // ── KPI Strip ──
  const kpis: { label: string; value: string; cls: string }[] = [
    { label: 'Current Balance', value: fmtGBP(stats.currentBalance), cls: 'kpi-balance' },
    { label: 'Savings', value: fmtGBP(stats.savingsBalance), cls: 'kpi-savings' },
    { label: 'Total Income', value: fmtGBP(stats.totalIncome), cls: 'kpi-income' },
    { label: 'Total Spending', value: fmtGBP(stats.totalSpending), cls: 'kpi-spending' },
    { label: 'Savings Rate', value: stats.savingsRate.toFixed(1) + '%', cls: 'kpi-rate' },
    { label: 'Transactions', value: stats.totalTransactions.toLocaleString(), cls: 'kpi-count' },
  ];

  const strip = el('div', { className: 'kpi-strip' });
  for (const k of kpis) {
    const card = el('div', { className: 'kpi-card ' + k.cls });
    card.appendChild(el('div', { className: 'kpi-label' }, k.label));
    card.appendChild(el('div', { className: 'kpi-value' }, k.value));
    strip.appendChild(card);
  }
  panel.appendChild(strip);

  // ── Monthly Cash Flow ──
  const last18 = monthly.slice(-18);
  const sec1 = el('div', { className: 'chart-section' });
  sec1.appendChild(el('h3', { className: 'chart-title' }, 'Monthly Cash Flow'));
  const c1 = el('canvas', { id: 'chart-monthly' });
  sec1.appendChild(el('div', { className: 'chart-wrap' }, [c1]));
  panel.appendChild(sec1);

  createChart('chart-monthly', {
    type: 'bar',
    data: {
      labels: last18.map(m => m.month),
      datasets: [
        { label: 'Income', data: last18.map(m => m.income), backgroundColor: 'rgba(52,211,153,0.75)', borderRadius: 4 },
        { label: 'Spending', data: last18.map(m => m.spending), backgroundColor: 'rgba(251,113,133,0.75)', borderRadius: 4 },
      ],
    },
    options: {
      plugins: { legend: { position: 'top', labels: { color: '#b0b0c0' } } },
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, maxRotation: 45 } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, callback: v => fmtGBP(v as number) } },
      },
    },
  });

  // ── Balance + Savings row ──
  const row1 = el('div', { className: 'chart-row' });

  const secBal = el('div', { className: 'chart-section chart-half' });
  secBal.appendChild(el('h3', { className: 'chart-title' }, 'Balance History'));
  const cBal = el('canvas', { id: 'chart-balance' });
  secBal.appendChild(el('div', { className: 'chart-wrap' }, [cBal]));
  row1.appendChild(secBal);

  const secSav = el('div', { className: 'chart-section chart-half' });
  secSav.appendChild(el('h3', { className: 'chart-title' }, 'Savings History'));
  const cSav = el('canvas', { id: 'chart-savings' });
  secSav.appendChild(el('div', { className: 'chart-wrap' }, [cSav]));
  row1.appendChild(secSav);
  panel.appendChild(row1);

  createChart('chart-balance', {
    type: 'line',
    data: {
      labels: balanceHistory.map(b => b.date),
      datasets: [{
        label: 'Balance', data: balanceHistory.map(b => b.balance),
        borderColor: 'rgba(96,165,250,0.9)', backgroundColor: 'rgba(96,165,250,0.08)',
        fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, maxTicksLimit: 8 } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, callback: v => fmtGBP(v as number) } },
      },
    },
  });

  createChart('chart-savings', {
    type: 'line',
    data: {
      labels: savingsHistory.map(b => b.date),
      datasets: [{
        label: 'Savings', data: savingsHistory.map(b => b.balance),
        borderColor: 'rgba(52,211,153,0.9)', backgroundColor: 'rgba(52,211,153,0.08)',
        fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, maxTicksLimit: 8 } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, callback: v => fmtGBP(v as number) } },
      },
    },
  });

  // ── Category donut + Weekday row ──
  const row2 = el('div', { className: 'chart-row' });

  const secCat = el('div', { className: 'chart-section chart-half' });
  secCat.appendChild(el('h3', { className: 'chart-title' }, 'Spending by Category'));
  const cCat = el('canvas', { id: 'chart-overview-donut' });
  secCat.appendChild(el('div', { className: 'chart-wrap chart-wrap-sq' }, [cCat]));
  row2.appendChild(secCat);

  const secWeek = el('div', { className: 'chart-section chart-half' });
  secWeek.appendChild(el('h3', { className: 'chart-title' }, 'Spending by Weekday'));
  const cWeek = el('canvas', { id: 'chart-weekday' });
  secWeek.appendChild(el('div', { className: 'chart-wrap chart-wrap-sq' }, [cWeek]));
  row2.appendChild(secWeek);
  panel.appendChild(row2);

  const spendCats = categories.filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  createChart('chart-overview-donut', {
    type: 'doughnut',
    data: {
      labels: spendCats.map(c => c.category),
      datasets: [{
        data: spendCats.map(c => c.total),
        backgroundColor: spendCats.map(c => c.color || defaultColor(c.category)),
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { position: 'right', labels: { color: '#b0b0c0', padding: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmtGBP(ctx.parsed)}` } },
      },
    },
  });

  const maxSpend = Math.max(...weekday.map(w => w.avgSpend));
  createChart('chart-weekday', {
    type: 'bar',
    data: {
      labels: weekday.map(w => w.day),
      datasets: [{
        label: 'Avg Daily Spend',
        data: weekday.map(w => w.avgSpend),
        backgroundColor: weekday.map(w => {
          const intensity = 0.3 + 0.7 * (w.avgSpend / (maxSpend || 1));
          return `rgba(251,113,133,${intensity.toFixed(2)})`;
        }),
        borderRadius: 4,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK } },
        y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, callback: v => fmtGBP(v as number) } },
      },
    },
  });
}
