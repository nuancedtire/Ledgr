// CSV parsing and data processing — shared between server and client

export interface Transaction {
  id: string;
  type: string;
  product: string;
  startedDate: string;
  completedDate: string | null;
  description: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: number | null;
  category: string;
  fingerprint: string;
}

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

export interface ClientData {
  transactions: Transaction[];
  categories: CategoryData[];
  merchants: MerchantData[];
  monthly: MonthlyData[];
  weekday: WeekdayData[];
  balanceHistory: BalancePoint[];
  savingsHistory: BalancePoint[];
  stats: SummaryStats;
  insights: AIInsight[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food Delivery': '#ef4444',
  Transport: '#f97316',
  Healthcare: '#ec4899',
  'Dining Out': '#f59e0b',
  Groceries: '#22c55e',
  Shopping: '#8b5cf6',
  Travel: '#06b6d4',
  Housing: '#6366f1',
  Subscriptions: '#14b8a6',
  'Transfers Out': '#64748b',
  Utilities: '#a855f7',
  Cash: '#78716c',
  Fees: '#94a3b8',
  'Currency Exchange': '#71717a',
  Other: '#9ca3af',
};

export function categorize(desc: string, type: string): string {
  const d = desc.toLowerCase();

  if (['deliveroo', 'just eat', 'uber eats'].some((x) => d.includes(x))) return 'Food Delivery';
  if (['transport for london', 'tfl'].some((x) => d.includes(x))) return 'Transport';
  if (['uber', 'bolt'].some((x) => d === x || d.startsWith(x + ' '))) return 'Transport';
  if (['trainline', 'trainpal'].some((x) => d.includes(x))) return 'Transport';
  if (['whipps cross', 'hospital', 'pharmacy'].some((x) => d.includes(x))) return 'Healthcare';
  if (
    [
      'the raj', 'wetherspoon', 'gokyuzu', 'sirac kebab', 'nando', 'mcdonald',
      'kfc', 'greggs', 'subway', 'pizza', 'burger king', 'pret',
    ].some((x) => d.includes(x))
  )
    return 'Dining Out';
  if (['elior'].some((x) => d.includes(x))) return 'Dining Out';
  if (
    [
      'tesco', 'sainsbury', 'lidl', 'aldi', 'asda', 'morrisons', 'co-op',
      'waitrose', 'iceland', '7 star', 'brading food', 'glade food', 'tariq halal',
    ].some((x) => d.includes(x))
  )
    return 'Groceries';
  if (['marks & spencer', 'm&s'].some((x) => d.includes(x))) return 'Groceries';
  if (
    [
      'etihad', 'virgin atlantic', 'air canada', 'air india', 'pegasus',
      'trip.com', 'trip ', 'airbnb', 'booking.com', 'resident hotel',
    ].some((x) => d.includes(x))
  )
    return 'Travel';
  if (
    [
      'amazon', 'argos', 'uniqlo', 'deichmann', 'boots', 'superdrug',
      'poundland', 'primark', 'beauty base', 'h&m', 'tk maxx', 'john lewis',
    ].some((x) => d.includes(x))
  )
    return 'Shopping';
  if (['stow residential', 'goodlord'].some((x) => d.includes(x))) return 'Housing';
  if (['octopus energy'].some((x) => d.includes(x))) return 'Utilities';
  if (
    [
      'netflix', 'spotify', 'apple.com', 'youtube', 'disney', 'vodafone',
      'cerebras', 'exe.dev', 'bold software', 'cloudflare', 'homelet',
      'openai', 'chatgpt',
    ].some((x) => d.includes(x))
  )
    return 'Subscriptions';
  if (['bma association', 'general medical'].some((x) => d.includes(x))) return 'Subscriptions';
  if (['to revolut', 'to kochans'].some((x) => d.includes(x))) return 'Transfers Out';
  if (d.includes('transfer to revolut') || d.includes('to revolut')) return 'Transfers Out';
  if (type === 'ATM') return 'Cash';
  if (type === 'Fee' || type === 'Charge') return 'Fees';
  if (type === 'Exchange') return 'Currency Exchange';
  if (type === 'Transfer') return 'Transfers Out';
  if (type === 'Rev Payment') return 'Transfers Out';

  return 'Other';
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split('\n');
  const txns: Transaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 10) continue;

    const type = fields[0];
    const description = fields[4];
    const amount = parseFloat(fields[5]) || 0;
    const startedDate = fields[2];

    txns.push({
      id: crypto.randomUUID(),
      type,
      product: fields[1],
      startedDate,
      completedDate: fields[3] || null,
      description,
      amount,
      fee: parseFloat(fields[6]) || 0,
      currency: fields[7],
      state: fields[8],
      balance: fields[9] ? parseFloat(fields[9]) : null,
      category: categorize(description, type),
      fingerprint: `${type}|${startedDate}|${description}|${amount}`,
    });
  }

  return txns;
}

export function computeMonthlyBreakdown(txns: Transaction[]): MonthlyData[] {
  const active = txns.filter((t) => t.state !== 'REVERTED');
  const months: Record<string, { income: number; spending: number }> = {};

  for (const t of active) {
    if (t.product === 'Savings') continue;
    const m = t.startedDate.slice(0, 7);
    if (!months[m]) months[m] = { income: 0, spending: 0 };
    if (t.amount > 0 && !t.description.toLowerCase().includes('withdrawing savings')) {
      if (
        t.type === 'Topup' ||
        (t.type === 'Transfer' &&
          t.amount > 0 &&
          !t.description.includes('pocket') &&
          !t.description.includes('savings'))
      ) {
        months[m].income += t.amount;
      }
    } else if (t.amount < 0) {
      if (
        !t.description.toLowerCase().includes('depositing savings') &&
        !t.description.toLowerCase().includes('to pocket')
      ) {
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

export function computeCategoryBreakdown(txns: Transaction[]): CategoryData[] {
  const active = txns.filter((t) => t.state !== 'REVERTED' && t.product === 'Current');
  const cats: Record<string, { total: number; count: number }> = {};

  for (const t of active) {
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

export function computeTopMerchants(txns: Transaction[], n = 15): MerchantData[] {
  const active = txns.filter(
    (t) => t.state !== 'REVERTED' && t.type === 'Card Payment' && t.amount < 0,
  );
  const merchants: Record<string, { total: number; count: number }> = {};

  for (const t of active) {
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

export function computeBalanceHistory(txns: Transaction[]): BalancePoint[] {
  const filtered = txns.filter(
    (t) => t.product === 'Current' && t.balance !== null && t.state === 'COMPLETED',
  );
  const daily: Record<string, number> = {};
  for (const t of filtered) {
    const d = t.startedDate.slice(0, 10);
    daily[d] = t.balance!;
  }
  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

export function computeSavingsHistory(txns: Transaction[]): BalancePoint[] {
  const filtered = txns.filter(
    (t) => t.product === 'Savings' && t.balance !== null && t.state === 'COMPLETED',
  );
  const daily: Record<string, number> = {};
  for (const t of filtered) {
    const d = t.startedDate.slice(0, 10);
    daily[d] = t.balance!;
  }
  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

export function computeWeekdaySpending(txns: Transaction[]): WeekdayData[] {
  const active = txns.filter(
    (t) => t.state !== 'REVERTED' && t.type === 'Card Payment' && t.amount < 0,
  );
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data: Record<number, { total: number; count: number; weeks: Set<string> }> = {};
  for (let i = 0; i < 7; i++) data[i] = { total: 0, count: 0, weeks: new Set() };

  for (const t of active) {
    const dow = new Date(t.startedDate).getDay();
    data[dow].total += Math.abs(t.amount);
    data[dow].count += 1;
    data[dow].weeks.add(t.startedDate.slice(0, 10));
  }

  return days.map((day, i) => ({
    day,
    totalSpend: Math.round(data[i].total * 100) / 100,
    avgSpend:
      data[i].weeks.size > 0
        ? Math.round((data[i].total / data[i].weeks.size) * 100) / 100
        : 0,
    count: data[i].count,
  }));
}

export function computeSummaryStats(
  txns: Transaction[],
  categories: CategoryData[],
): SummaryStats {
  const active = txns.filter((t) => t.state !== 'REVERTED');
  const currentTxns = active.filter((t) => t.product === 'Current');

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

  const savingsTxns = active.filter((t) => t.product === 'Savings' && t.balance !== null);
  const lastSavings = savingsTxns.length > 0 ? savingsTxns[savingsTxns.length - 1].balance! : 0;

  const lastCurrent = currentTxns.filter((t) => t.balance !== null);
  const currentBalance =
    lastCurrent.length > 0 ? lastCurrent[lastCurrent.length - 1].balance! : 0;

  const dates = active.map((t) => new Date(t.startedDate).getTime());
  const monthSpan = Math.max(
    1,
    (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.44),
  );

  const biggestCat = categories.length > 0 ? categories[0].category : 'Unknown';

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalSpending: Math.round(totalSpending * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
    savingsBalance: Math.round(lastSavings * 100) / 100,
    avgMonthlyIncome: Math.round((totalIncome / monthSpan) * 100) / 100,
    avgMonthlySpending: Math.round((totalSpending / monthSpan) * 100) / 100,
    savingsRate:
      totalIncome > 0
        ? Math.round(((totalIncome - totalSpending) / totalIncome) * 10000) / 100
        : 0,
    totalTransactions: active.length,
    dateRange: {
      from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
    },
    topIncomeSource: 'Salary',
    biggestExpenseCategory: biggestCat,
  };
}

export function computeClientData(txns: Transaction[], insights: AIInsight[] = []): ClientData {
  const sorted = txns
    .filter((t) => t.state !== 'REVERTED')
    .sort((a, b) => b.startedDate.localeCompare(a.startedDate));

  const categories = computeCategoryBreakdown(sorted);
  const stats = computeSummaryStats(sorted, categories);

  return {
    transactions: sorted,
    categories,
    merchants: computeTopMerchants(sorted, 20),
    monthly: computeMonthlyBreakdown(sorted),
    weekday: computeWeekdaySpending(sorted),
    balanceHistory: computeBalanceHistory(sorted),
    savingsHistory: computeSavingsHistory(sorted),
    stats,
    insights,
  };
}
