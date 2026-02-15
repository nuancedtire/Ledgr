/**
 * Real insights engine — replaces the hardcoded getAIInsights().
 * Computes insights from actual transaction data in D1.
 */

import type { DecryptedTransaction } from './transactions';
import { CATEGORY_COLORS } from './transactions';

// ─── Types (matching existing UI contracts) ──────────────────────

export interface MonthlyData {
  month: string;
  income: number;
  spending: number;
  net: number;
}

export interface CategoryData {
  category: string;
  total: number;
  count: number;
  color: string;
}

export interface MerchantData {
  name: string;
  total: number;
  count: number;
  avgTransaction: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface WeekdayData {
  day: string;
  avgSpend: number;
  totalSpend: number;
  count: number;
}

export interface SummaryStats {
  totalIncome: number;
  totalSpending: number;
  totalFees: number;
  currentBalance: number;
  savingsBalance: number;
  avgMonthlyIncome: number;
  avgMonthlySpending: number;
  savingsRate: number;
  totalTransactions: number;
  dateRange: { from: string; to: string };
  topIncomeSource: string;
  biggestExpenseCategory: string;
}

export interface AIInsight {
  type: 'warning' | 'success' | 'tip' | 'info';
  title: string;
  description: string;
  metric?: string;
}

export interface ClientTransaction {
  id: string;
  date: string;
  time: string;
  desc: string;
  amt: number;
  fee: number;
  cat: string;
  type: string;
  bal: number | null;
  state: string;
  product: string;
}

export interface DashboardData {
  transactions: ClientTransaction[];
  categories: CategoryData[];
  merchants: MerchantData[];
  monthly: MonthlyData[];
  weekday: WeekdayData[];
  balanceHistory: BalancePoint[];
  savingsHistory: BalancePoint[];
  stats: SummaryStats;
  insights: AIInsight[];
}

// ─── Compute dashboard data from decrypted transactions ──────────

export function computeDashboardData(txns: DecryptedTransaction[]): DashboardData {
  const activeTxns = txns.filter(t => t.state !== 'REVERTED');

  // Client transactions (sorted by date desc)
  const sorted = [...activeTxns].sort((a, b) => b.startedDate.getTime() - a.startedDate.getTime());
  const clientTransactions: ClientTransaction[] = sorted.map(t => {
    const iso = t.startedDate.toISOString();
    return {
      id: t.id,
      date: iso.slice(0, 10),
      time: iso.slice(11, 16),
      desc: t.description,
      amt: Math.round(t.amount * 100) / 100,
      fee: Math.round(t.fee * 100) / 100,
      cat: t.category,
      type: t.type,
      bal: t.balance !== null ? Math.round(t.balance * 100) / 100 : null,
      state: t.state,
      product: t.product,
    };
  });

  const categories = computeCategories(activeTxns);
  const merchants = computeMerchants(activeTxns);
  const monthly = computeMonthly(activeTxns);
  const weekday = computeWeekday(activeTxns);
  const balanceHistory = computeBalanceHistory(activeTxns, 'Current');
  const savingsHistory = computeBalanceHistory(activeTxns, 'Savings');
  const stats = computeStats(activeTxns, categories, monthly);
  const insights = computeInsights(stats, categories, monthly);

  return {
    transactions: clientTransactions,
    categories,
    merchants,
    monthly,
    weekday,
    balanceHistory,
    savingsHistory,
    stats,
    insights,
  };
}

function computeMonthly(txns: DecryptedTransaction[]): MonthlyData[] {
  const months: Record<string, { income: number; spending: number }> = {};

  for (const t of txns) {
    if (t.product === 'Savings') continue;
    const m = t.startedDate.toISOString().slice(0, 7);
    if (!months[m]) months[m] = { income: 0, spending: 0 };

    if (t.amount > 0 && !t.description.toLowerCase().includes('withdrawing savings')) {
      if (t.type === 'Topup' || (t.type === 'Transfer' && t.amount > 0 && !t.description.includes('pocket') && !t.description.includes('savings'))) {
        months[m].income += t.amount;
      }
    } else if (t.amount < 0) {
      if (!t.description.toLowerCase().includes('depositing savings') && !t.description.toLowerCase().includes('to pocket')) {
        months[m].spending += Math.abs(t.amount);
      }
    }
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income * 100) / 100,
      spending: Math.round(data.spending * 100) / 100,
      net: Math.round((data.income - data.spending) * 100) / 100,
    }));
}

function computeCategories(txns: DecryptedTransaction[]): CategoryData[] {
  const currentTxns = txns.filter(t => t.product === 'Current');
  const cats: Record<string, { total: number; count: number }> = {};

  for (const t of currentTxns) {
    if (t.amount >= 0) continue;
    const desc = t.description.toLowerCase();
    if (desc.includes('depositing savings') || desc.includes('to pocket')) continue;
    if (t.category === 'Currency Exchange') continue;

    if (!cats[t.category]) cats[t.category] = { total: 0, count: 0 };
    cats[t.category].total += Math.abs(t.amount);
    cats[t.category].count += 1;
  }

  return Object.entries(cats)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([category, data]) => ({
      category,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      color: CATEGORY_COLORS[category] || '#9ca3af',
    }));
}

function computeMerchants(txns: DecryptedTransaction[], n = 20): MerchantData[] {
  const cardTxns = txns.filter(t => t.type === 'Card Payment' && t.amount < 0);
  const merchants: Record<string, { total: number; count: number }> = {};

  for (const t of cardTxns) {
    if (!merchants[t.description]) merchants[t.description] = { total: 0, count: 0 };
    merchants[t.description].total += Math.abs(t.amount);
    merchants[t.description].count += 1;
  }

  return Object.entries(merchants)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, n)
    .map(([name, data]) => ({
      name,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      avgTransaction: Math.round((data.total / data.count) * 100) / 100,
    }));
}

function computeBalanceHistory(txns: DecryptedTransaction[], product: string): BalancePoint[] {
  const filtered = txns.filter(t => t.product === product && t.balance !== null && t.state === 'COMPLETED');
  const daily: Record<string, number> = {};

  for (const t of filtered) {
    const d = t.startedDate.toISOString().slice(0, 10);
    daily[d] = t.balance!;
  }

  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

function computeWeekday(txns: DecryptedTransaction[]): WeekdayData[] {
  const cardTxns = txns.filter(t => t.type === 'Card Payment' && t.amount < 0);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data: Record<number, { total: number; count: number; weeks: Set<string> }> = {};

  for (let i = 0; i < 7; i++) data[i] = { total: 0, count: 0, weeks: new Set() };

  for (const t of cardTxns) {
    const dow = t.startedDate.getDay();
    data[dow].total += Math.abs(t.amount);
    data[dow].count += 1;
    data[dow].weeks.add(t.startedDate.toISOString().slice(0, 10));
  }

  return days.map((day, i) => ({
    day,
    totalSpend: Math.round(data[i].total * 100) / 100,
    avgSpend: data[i].weeks.size > 0 ? Math.round((data[i].total / data[i].weeks.size) * 100) / 100 : 0,
    count: data[i].count,
  }));
}

function computeStats(
  txns: DecryptedTransaction[],
  cats: CategoryData[],
  monthly: MonthlyData[],
): SummaryStats {
  const currentTxns = txns.filter(t => t.product === 'Current');

  let totalIncome = 0;
  let totalSpending = 0;
  let totalFees = 0;

  for (const t of currentTxns) {
    if (t.type === 'Topup') totalIncome += t.amount;
    if (t.amount < 0 && t.type === 'Card Payment') totalSpending += Math.abs(t.amount);
    totalFees += t.fee;
  }

  for (const t of currentTxns) {
    if (t.type === 'Transfer' && t.amount > 0 && t.description.startsWith('Payment from')) {
      totalIncome += t.amount;
    }
  }

  for (const t of currentTxns) {
    if (t.type === 'Transfer' && t.amount < 0 && !t.description.toLowerCase().includes('depositing savings') && !t.description.toLowerCase().includes('to pocket')) {
      totalSpending += Math.abs(t.amount);
    }
  }

  const savingsTxns = txns.filter(t => t.product === 'Savings' && t.balance !== null);
  const lastSavings = savingsTxns.length > 0 ? savingsTxns[savingsTxns.length - 1].balance! : 0;

  const lastCurrent = currentTxns.filter(t => t.balance !== null);
  const currentBalance = lastCurrent.length > 0 ? lastCurrent[lastCurrent.length - 1].balance! : 0;

  const dates = txns.map(t => t.startedDate.getTime());
  const monthSpan = dates.length > 0
    ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.44))
    : 1;

  const biggestCat = cats.length > 0 ? cats[0].category : 'Unknown';

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalSpending: Math.round(totalSpending * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
    savingsBalance: Math.round(lastSavings * 100) / 100,
    avgMonthlyIncome: Math.round((totalIncome / monthSpan) * 100) / 100,
    avgMonthlySpending: Math.round((totalSpending / monthSpan) * 100) / 100,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalSpending) / totalIncome) * 10000) / 100 : 0,
    totalTransactions: txns.length,
    dateRange: dates.length > 0 ? {
      from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
    } : { from: '', to: '' },
    topIncomeSource: 'Salary',
    biggestExpenseCategory: biggestCat,
  };
}

function computeInsights(
  stats: SummaryStats,
  cats: CategoryData[],
  monthly: MonthlyData[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  const foodDelivery = cats.find(c => c.category === 'Food Delivery');
  const diningOut = cats.find(c => c.category === 'Dining Out');
  const transport = cats.find(c => c.category === 'Transport');
  const groceries = cats.find(c => c.category === 'Groceries');

  // Food delivery warning
  if (foodDelivery && foodDelivery.total > 500) {
    const monthlyDelivery = stats.totalTransactions > 0
      ? Math.round(foodDelivery.total / Math.max(1, monthly.length) * 100) / 100
      : 0;
    insights.push({
      type: 'warning',
      title: 'Food delivery spending is high',
      description: `You've spent £${foodDelivery.total.toLocaleString()} on food delivery across ${foodDelivery.count} orders — about £${monthlyDelivery}/month. Cooking more meals at home could save significantly.`,
      metric: `£${monthlyDelivery}/mo`,
    });
  }

  // Combined eating out
  const totalEatingOut = (foodDelivery?.total ?? 0) + (diningOut?.total ?? 0);
  if (totalEatingOut > 1000) {
    insights.push({
      type: 'warning',
      title: 'Food away from home dominates spending',
      description: `Combined food delivery + dining out totals £${Math.round(totalEatingOut).toLocaleString()}, which is ${Math.round(totalEatingOut / Math.max(1, stats.totalSpending) * 100)}% of your spending. Grocery bill is only £${groceries?.total.toLocaleString() ?? '0'}.`,
      metric: `£${Math.round(totalEatingOut).toLocaleString()}`,
    });
  }

  // Savings rate
  if (stats.savingsRate < 15) {
    insights.push({
      type: 'warning',
      title: 'Savings rate needs improvement',
      description: `Your effective savings rate is around ${stats.savingsRate}%. Financial advisors recommend saving at least 20% of income.`,
      metric: `${stats.savingsRate}%`,
    });
  } else if (stats.savingsRate >= 20) {
    insights.push({
      type: 'success',
      title: 'Healthy savings rate',
      description: `Your savings rate of ${stats.savingsRate}% is above the recommended 20% minimum. Keep this momentum going.`,
      metric: `${stats.savingsRate}%`,
    });
  }

  // Transport
  if (transport && transport.total > 500) {
    insights.push({
      type: 'tip',
      title: 'Review transport spending',
      description: `You've spent £${transport.total.toLocaleString()} on transport (${transport.count} journeys). Consider whether a travelcard or cycling could reduce costs.`,
      metric: `${transport.count} trips`,
    });
  }

  // Emergency fund
  if (stats.avgMonthlySpending > 0) {
    insights.push({
      type: 'tip',
      title: 'Build a 3-month emergency fund',
      description: `Your average monthly spending is ~£${Math.round(stats.avgMonthlySpending).toLocaleString()}. An ideal emergency fund would be £${Math.round(stats.avgMonthlySpending * 3).toLocaleString()}.`,
      metric: `£${Math.round(stats.avgMonthlySpending * 3).toLocaleString()} target`,
    });
  }

  // Spending volatility
  if (monthly.length >= 3) {
    const recentMonths = monthly.slice(-6);
    const spendingValues = recentMonths.filter(m => m.spending > 0).map(m => m.spending);
    if (spendingValues.length >= 2) {
      const maxSpend = Math.max(...spendingValues);
      const minSpend = Math.min(...spendingValues);
      if (maxSpend > minSpend * 2.5) {
        insights.push({
          type: 'info',
          title: 'Spending varies significantly month to month',
          description: `In recent months, spending ranged from £${Math.round(minSpend).toLocaleString()} to £${Math.round(maxSpend).toLocaleString()}. A monthly budget could help smooth out these peaks.`,
          metric: `${Math.round(maxSpend / minSpend)}x variance`,
        });
      }
    }
  }

  // Top spending category insight
  if (cats.length > 0) {
    const topCat = cats[0];
    const pct = stats.totalSpending > 0 ? Math.round(topCat.total / stats.totalSpending * 100) : 0;
    insights.push({
      type: 'info',
      title: `${topCat.category} is your biggest expense`,
      description: `${topCat.category} accounts for ${pct}% of your total spending (£${topCat.total.toLocaleString()} across ${topCat.count} transactions).`,
      metric: `${pct}%`,
    });
  }

  return insights;
}
