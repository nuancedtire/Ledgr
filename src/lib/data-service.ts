/**
 * Data service: queries D1, decrypts transaction data, and computes
 * dashboard aggregations (replaces the old static getClientData).
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { AppDatabase } from '../db';
import { transactions, uploads, categories } from '../db/schema';
import { decrypt, decryptNumber } from './crypto';
import { CATEGORY_COLORS } from './categories';

// ─── Types (shared with client) ──────────────────────────────────

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

export interface MonthlyData {
  month: string;
  income: number;
  spending: number;
  net: number;
}

export interface WeekdayData {
  day: string;
  avgSpend: number;
  totalSpend: number;
  count: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
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

export interface ClientData {
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

// ─── Decrypted transaction (internal) ───────────────────────────

interface DecryptedTxn {
  id: string;
  description: string;
  amount: number;
  fee: number;
  balance: number | null;
  type: string;
  product: string;
  currency: string;
  state: string;
  categoryName: string;
  startedAt: Date;
  completedAt: Date | null;
}

// ─── Main data loader ───────────────────────────────────────────

export async function getClientData(
  db: AppDatabase,
  userId: string,
  masterSecret: string,
  userSalt: string,
): Promise<ClientData> {
  // Fetch all user transactions
  const rawTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.startedAt))
    .all();

  // Fetch user categories
  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .all();

  const catMap = new Map(userCats.map((c) => [c.id, c]));

  // Decrypt all transactions in parallel
  const decrypted: DecryptedTxn[] = await Promise.all(
    rawTxns.map(async (t) => {
      const [description, amount, fee, balance] = await Promise.all([
        decrypt(t.encDescription, masterSecret, userSalt),
        decryptNumber(t.encAmount, masterSecret, userSalt),
        decryptNumber(t.encFee, masterSecret, userSalt),
        t.encBalance ? decryptNumber(t.encBalance, masterSecret, userSalt) : null,
      ]);

      const cat = t.categoryId ? catMap.get(t.categoryId) : null;

      return {
        id: t.id,
        description,
        amount,
        fee,
        balance,
        type: t.type,
        product: t.product,
        currency: t.currency,
        state: t.state,
        categoryName: cat?.name ?? 'Other',
        startedAt: t.startedAt,
        completedAt: t.completedAt ?? null,
      };
    }),
  );

  const active = decrypted.filter((t) => t.state !== 'REVERTED');

  return {
    transactions: buildClientTransactions(active),
    categories: buildCategoryBreakdown(active),
    merchants: buildMerchantBreakdown(active),
    monthly: buildMonthlyBreakdown(active),
    weekday: buildWeekdaySpending(active),
    balanceHistory: buildBalanceHistory(active, 'Current'),
    savingsHistory: buildBalanceHistory(active, 'Savings'),
    stats: buildSummaryStats(active),
    insights: buildInsights(active),
  };
}

// ─── Builders ───────────────────────────────────────────────────

function buildClientTransactions(txns: DecryptedTxn[]): ClientTransaction[] {
  return txns.map((t) => {
    const iso = t.startedAt.toISOString();
    return {
      id: t.id,
      date: iso.slice(0, 10),
      time: iso.slice(11, 16),
      desc: t.description,
      amt: round2(t.amount),
      fee: round2(t.fee),
      cat: t.categoryName,
      type: t.type,
      bal: t.balance !== null ? round2(t.balance) : null,
      state: t.state,
      product: t.product,
    };
  });
}

function buildCategoryBreakdown(txns: DecryptedTxn[]): CategoryData[] {
  const cats: Record<string, { total: number; count: number }> = {};

  for (const t of txns) {
    if (t.amount >= 0 || t.product !== 'Current') continue;
    const d = t.description.toLowerCase();
    if (d.includes('depositing savings') || d.includes('to pocket')) continue;
    if (t.categoryName === 'Currency Exchange') continue;

    if (!cats[t.categoryName]) cats[t.categoryName] = { total: 0, count: 0 };
    cats[t.categoryName].total += Math.abs(t.amount);
    cats[t.categoryName].count += 1;
  }

  return Object.entries(cats)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([category, data]) => ({
      category,
      total: round2(data.total),
      count: data.count,
      color: CATEGORY_COLORS[category] || '#9ca3af',
    }));
}

function buildMerchantBreakdown(txns: DecryptedTxn[], n = 20): MerchantData[] {
  const merchants: Record<string, { total: number; count: number }> = {};

  for (const t of txns) {
    if (t.type !== 'Card Payment' || t.amount >= 0) continue;
    if (!merchants[t.description]) merchants[t.description] = { total: 0, count: 0 };
    merchants[t.description].total += Math.abs(t.amount);
    merchants[t.description].count += 1;
  }

  return Object.entries(merchants)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, n)
    .map(([name, data]) => ({
      name,
      total: round2(data.total),
      count: data.count,
      avgTransaction: round2(data.total / data.count),
    }));
}

function buildMonthlyBreakdown(txns: DecryptedTxn[]): MonthlyData[] {
  const months: Record<string, { income: number; spending: number }> = {};

  for (const t of txns) {
    if (t.product === 'Savings') continue;
    const m = t.startedAt.toISOString().slice(0, 7);
    if (!months[m]) months[m] = { income: 0, spending: 0 };

    if (t.amount > 0 && !t.description.toLowerCase().includes('withdrawing savings')) {
      if (
        t.type === 'Topup' ||
        (t.type === 'Transfer' && t.amount > 0 && !t.description.includes('pocket') && !t.description.includes('savings'))
      ) {
        months[m].income += t.amount;
      }
    } else if (t.amount < 0) {
      const d = t.description.toLowerCase();
      if (!d.includes('depositing savings') && !d.includes('to pocket')) {
        months[m].spending += Math.abs(t.amount);
      }
    }
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      income: round2(data.income),
      spending: round2(data.spending),
      net: round2(data.income - data.spending),
    }));
}

function buildWeekdaySpending(txns: DecryptedTxn[]): WeekdayData[] {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data: Record<number, { total: number; count: number; weeks: Set<string> }> = {};
  for (let i = 0; i < 7; i++) data[i] = { total: 0, count: 0, weeks: new Set() };

  for (const t of txns) {
    if (t.type !== 'Card Payment' || t.amount >= 0) continue;
    const dow = t.startedAt.getDay();
    data[dow].total += Math.abs(t.amount);
    data[dow].count += 1;
    data[dow].weeks.add(t.startedAt.toISOString().slice(0, 10));
  }

  return days.map((day, i) => ({
    day,
    totalSpend: round2(data[i].total),
    avgSpend: data[i].weeks.size > 0 ? round2(data[i].total / data[i].weeks.size) : 0,
    count: data[i].count,
  }));
}

function buildBalanceHistory(txns: DecryptedTxn[], product: string): BalancePoint[] {
  const daily: Record<string, number> = {};

  for (const t of txns) {
    if (t.product !== product || t.balance === null || t.state !== 'COMPLETED') continue;
    const d = t.startedAt.toISOString().slice(0, 10);
    daily[d] = t.balance;
  }

  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

function buildSummaryStats(txns: DecryptedTxn[]): SummaryStats {
  const currentTxns = txns.filter((t) => t.product === 'Current');

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
    if (
      t.type === 'Transfer' &&
      t.amount < 0 &&
      !t.description.toLowerCase().includes('depositing savings') &&
      !t.description.toLowerCase().includes('to pocket')
    ) {
      totalSpending += Math.abs(t.amount);
    }
  }

  const savingsTxns = txns.filter((t) => t.product === 'Savings' && t.balance !== null);
  const lastSavings = savingsTxns.length > 0 ? savingsTxns[0].balance! : 0;

  const lastCurrent = currentTxns.filter((t) => t.balance !== null);
  const currentBalance = lastCurrent.length > 0 ? lastCurrent[0].balance! : 0;

  const dates = txns.map((t) => t.startedAt.getTime());
  const monthSpan = dates.length > 0
    ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.44))
    : 1;

  const cats = buildCategoryBreakdown(txns);
  const biggestCat = cats.length > 0 ? cats[0].category : 'Unknown';

  return {
    totalIncome: round2(totalIncome),
    totalSpending: round2(totalSpending),
    totalFees: round2(totalFees),
    currentBalance: round2(currentBalance),
    savingsBalance: round2(lastSavings),
    avgMonthlyIncome: round2(totalIncome / monthSpan),
    avgMonthlySpending: round2(totalSpending / monthSpan),
    savingsRate: totalIncome > 0 ? round2(((totalIncome - totalSpending) / totalIncome) * 100) : 0,
    totalTransactions: txns.length,
    dateRange: {
      from: dates.length > 0 ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : '',
      to: dates.length > 0 ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : '',
    },
    topIncomeSource: 'Salary',
    biggestExpenseCategory: biggestCat,
  };
}

// ─── Real insights from actual data ─────────────────────────────

function buildInsights(txns: DecryptedTxn[]): AIInsight[] {
  const stats = buildSummaryStats(txns);
  const cats = buildCategoryBreakdown(txns);
  const monthly = buildMonthlyBreakdown(txns);

  const foodDelivery = cats.find((c) => c.category === 'Food Delivery');
  const diningOut = cats.find((c) => c.category === 'Dining Out');
  const transport = cats.find((c) => c.category === 'Transport');
  const groceries = cats.find((c) => c.category === 'Groceries');

  const insights: AIInsight[] = [];

  // No data yet
  if (txns.length === 0) {
    insights.push({
      type: 'info',
      title: 'Upload your first statement',
      description: 'Upload a Revolut CSV export to get personalised financial insights based on your actual spending data.',
    });
    return insights;
  }

  // Food delivery warning
  if (foodDelivery && foodDelivery.total > 500) {
    const months = monthly.length || 1;
    const monthlyDelivery = round2(foodDelivery.total / months);
    insights.push({
      type: 'warning',
      title: 'Food delivery spending is high',
      description: `You've spent £${foodDelivery.total.toLocaleString()} on food delivery across ${foodDelivery.count} orders — about £${monthlyDelivery}/month. Cooking just 2 more meals per week could save ~£150/month.`,
      metric: `£${monthlyDelivery}/mo`,
    });
  }

  // Combined eating out
  const totalEatingOut = (foodDelivery?.total ?? 0) + (diningOut?.total ?? 0);
  if (totalEatingOut > 1000) {
    insights.push({
      type: 'warning',
      title: 'Food away from home dominates spending',
      description: `Combined food delivery + dining out totals £${Math.round(totalEatingOut).toLocaleString()}, which is ${Math.round((totalEatingOut / stats.totalSpending) * 100)}% of your spending. Groceries are only £${groceries?.total.toLocaleString() ?? '0'}.`,
      metric: `£${Math.round(totalEatingOut).toLocaleString()}`,
    });
  }

  // Savings rate
  if (stats.savingsRate < 15) {
    insights.push({
      type: 'warning',
      title: 'Savings rate needs improvement',
      description: `Your effective savings rate is around ${stats.savingsRate}%. Financial advisors recommend saving at least 20% of income. Consider setting up automatic transfers to savings.`,
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
      description: `You've spent £${transport.total.toLocaleString()} on transport (${transport.count} journeys). Consider whether a monthly travelcard or cycling could reduce costs.`,
      metric: `${transport.count} trips`,
    });
  }

  // Emergency fund
  if (stats.avgMonthlySpending > 0) {
    const target = Math.round(stats.avgMonthlySpending * 3);
    insights.push({
      type: 'tip',
      title: 'Build a 3-month emergency fund',
      description: `Your average monthly spending is ~£${Math.round(stats.avgMonthlySpending).toLocaleString()}. An ideal emergency fund would be £${target.toLocaleString()}. Consider a high-yield savings account.`,
      metric: `£${target.toLocaleString()} target`,
    });
  }

  // Spending volatility
  const recentMonths = monthly.slice(-6);
  if (recentMonths.length >= 3) {
    const spends = recentMonths.filter((m) => m.spending > 0).map((m) => m.spending);
    if (spends.length >= 2) {
      const maxSpend = Math.max(...spends);
      const minSpend = Math.min(...spends);
      if (maxSpend > minSpend * 2.5) {
        insights.push({
          type: 'info',
          title: 'Spending varies significantly month to month',
          description: `In the last ${recentMonths.length} months, monthly spending ranged from £${Math.round(minSpend).toLocaleString()} to £${Math.round(maxSpend).toLocaleString()}. A monthly budget could help smooth out these peaks.`,
          metric: `${Math.round(maxSpend / minSpend)}x variance`,
        });
      }
    }
  }

  // Top spending category insight
  if (cats.length > 0) {
    const top = cats[0];
    const pct = stats.totalSpending > 0 ? Math.round((top.total / stats.totalSpending) * 100) : 0;
    insights.push({
      type: 'info',
      title: `${top.category} is your biggest expense`,
      description: `${top.category} accounts for £${top.total.toLocaleString()} (${pct}% of total spending) across ${top.count} transactions.`,
      metric: `${pct}%`,
    });
  }

  return insights;
}

// ─── Upload info ────────────────────────────────────────────────

export async function getUserUploads(db: AppDatabase, userId: string) {
  return db
    .select()
    .from(uploads)
    .where(eq(uploads.userId, userId))
    .orderBy(desc(uploads.uploadedAt))
    .all();
}

export async function getTransactionCount(db: AppDatabase, userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .get();
  return result?.count ?? 0;
}

// ─── Helpers ────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
