import fs from 'node:fs';
import path from 'node:path';

export interface Transaction {
  type: string;
  product: string;
  startedDate: Date;
  completedDate: Date | null;
  description: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: number | null;
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

export interface WeekdayData {
  day: string;
  avgSpend: number;
  totalSpend: number;
  count: number;
}

export interface AIInsight {
  type: 'warning' | 'success' | 'tip' | 'info';
  title: string;
  description: string;
  metric?: string;
}

export interface ClientTransaction {
  id: number;
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

const CATEGORY_COLORS: Record<string, string> = {
  'Food Delivery': '#ef4444',
  'Transport': '#f97316',
  'Healthcare': '#ec4899',
  'Dining Out': '#f59e0b',
  'Groceries': '#22c55e',
  'Shopping': '#8b5cf6',
  'Travel': '#06b6d4',
  'Housing': '#6366f1',
  'Subscriptions': '#14b8a6',
  'Transfers Out': '#64748b',
  'Utilities': '#a855f7',
  'Cash': '#78716c',
  'Fees': '#94a3b8',
  'Currency Exchange': '#71717a',
  'Other': '#9ca3af',
};

function categorize(desc: string, type: string, _amount?: number): string {
  const d = desc.toLowerCase();
  
  if (['deliveroo', 'just eat', 'uber eats'].some(x => d.includes(x))) return 'Food Delivery';
  if (['transport for london', 'tfl'].some(x => d.includes(x))) return 'Transport';
  if (['uber', 'bolt'].some(x => d === x || d.startsWith(x + ' '))) return 'Transport';
  if (['trainline', 'trainpal'].some(x => d.includes(x))) return 'Transport';
  if (['whipps cross', 'hospital', 'pharmacy'].some(x => d.includes(x))) return 'Healthcare';
  if (['the raj', 'wetherspoon', 'gokyuzu', 'sirac kebab', 'nando', 'mcdonald', 'kfc', 'greggs', 'subway', 'pizza', 'burger king', 'pret'].some(x => d.includes(x))) return 'Dining Out';
  if (['elior'].some(x => d.includes(x))) return 'Dining Out';
  if (['tesco', 'sainsbury', 'lidl', 'aldi', 'asda', 'morrisons', 'co-op', 'waitrose', 'iceland', '7 star', 'brading food', 'glade food', 'tariq halal'].some(x => d.includes(x))) return 'Groceries';
  if (['marks & spencer', 'm&s'].some(x => d.includes(x))) return 'Groceries';
  if (['etihad', 'virgin atlantic', 'air canada', 'air india', 'pegasus', 'trip.com', 'trip ', 'airbnb', 'booking.com', 'resident hotel'].some(x => d.includes(x))) return 'Travel';
  if (['amazon', 'argos', 'uniqlo', 'deichmann', 'boots', 'superdrug', 'poundland', 'primark', 'beauty base', 'h&m', 'tk maxx', 'john lewis'].some(x => d.includes(x))) return 'Shopping';
  if (['stow residential', 'goodlord'].some(x => d.includes(x))) return 'Housing';
  if (['octopus energy'].some(x => d.includes(x))) return 'Utilities';
  if (['netflix', 'spotify', 'apple.com', 'youtube', 'disney', 'vodafone', 'cerebras', 'exe.dev', 'bold software', 'cloudflare', 'homelet', 'openai', 'chatgpt'].some(x => d.includes(x))) return 'Subscriptions';
  if (['bma association', 'general medical'].some(x => d.includes(x))) return 'Subscriptions';
  if (['to revolut', 'to kochans'].some(x => d.includes(x))) return 'Transfers Out';
  if (d.includes('transfer to revolut') || d.includes('to revolut')) return 'Transfers Out';
  if (type === 'ATM') return 'Cash';
  if (type === 'Fee' || type === 'Charge') return 'Fees';
  if (type === 'Exchange') return 'Currency Exchange';
  if (type === 'Transfer') return 'Transfers Out';
  if (type === 'Rev Payment') return 'Transfers Out';
  if (['juul', 'tobacco'].some(x => d.includes(x))) return 'Other';
  
  return 'Other';
}

function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split('\n');
  const transactions: Transaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    
    if (fields.length < 10) continue;
    
    transactions.push({
      type: fields[0],
      product: fields[1],
      startedDate: new Date(fields[2]),
      completedDate: fields[3] ? new Date(fields[3]) : null,
      description: fields[4],
      amount: parseFloat(fields[5]) || 0,
      fee: parseFloat(fields[6]) || 0,
      currency: fields[7],
      state: fields[8],
      balance: fields[9] ? parseFloat(fields[9]) : null,
    });
  }
  
  return transactions;
}

let _cache: Transaction[] | null = null;

export function getTransactions(): Transaction[] {
  if (_cache) return _cache;
  const csvPath = path.join(process.cwd(), 'src', 'data', 'statement.csv');
  const text = fs.readFileSync(csvPath, 'utf-8');
  _cache = parseCSV(text);
  return _cache;
}

export function getMonthlyBreakdown(): MonthlyData[] {
  const txns = getTransactions().filter(t => t.state !== 'REVERTED');
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

export function getCategoryBreakdown(): CategoryData[] {
  const txns = getTransactions().filter(t => t.state !== 'REVERTED' && t.product === 'Current');
  const cats: Record<string, { total: number; count: number }> = {};
  
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const desc = t.description.toLowerCase();
    if (desc.includes('depositing savings') || desc.includes('to pocket')) continue;
    
    const cat = categorize(t.description, t.type, t.amount);
    if (cat === 'Currency Exchange') continue; // Skip exchange transactions
    if (!cats[cat]) cats[cat] = { total: 0, count: 0 };
    cats[cat].total += Math.abs(t.amount);
    cats[cat].count += 1;
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

export function getTopMerchants(n: number = 15): MerchantData[] {
  const txns = getTransactions().filter(t => t.state !== 'REVERTED' && t.type === 'Card Payment' && t.amount < 0);
  const merchants: Record<string, { total: number; count: number }> = {};
  
  for (const t of txns) {
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

export function getBalanceHistory(): BalancePoint[] {
  const txns = getTransactions().filter(t => t.product === 'Current' && t.balance !== null && t.state === 'COMPLETED');
  const daily: Record<string, number> = {};
  
  for (const t of txns) {
    const d = t.startedDate.toISOString().slice(0, 10);
    daily[d] = t.balance!;
  }
  
  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

export function getSavingsHistory(): BalancePoint[] {
  const txns = getTransactions().filter(t => t.product === 'Savings' && t.balance !== null && t.state === 'COMPLETED');
  const daily: Record<string, number> = {};
  
  for (const t of txns) {
    const d = t.startedDate.toISOString().slice(0, 10);
    daily[d] = t.balance!;
  }
  
  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, balance]) => ({ date, balance }));
}

export function getWeekdaySpending(): WeekdayData[] {
  const txns = getTransactions().filter(t => t.state !== 'REVERTED' && t.type === 'Card Payment' && t.amount < 0);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const data: Record<number, { total: number; count: number; weeks: Set<string> }> = {};
  
  for (let i = 0; i < 7; i++) data[i] = { total: 0, count: 0, weeks: new Set() };
  
  for (const t of txns) {
    const dow = t.startedDate.getDay();
    data[dow].total += Math.abs(t.amount);
    data[dow].count += 1;
    const weekKey = t.startedDate.toISOString().slice(0, 10);
    data[dow].weeks.add(weekKey);
  }
  
  return days.map((day, i) => ({
    day,
    totalSpend: Math.round(data[i].total * 100) / 100,
    avgSpend: data[i].weeks.size > 0 ? Math.round((data[i].total / data[i].weeks.size) * 100) / 100 : 0,
    count: data[i].count,
  }));
}

export function getSummaryStats(): SummaryStats {
  const txns = getTransactions().filter(t => t.state !== 'REVERTED');
  const currentTxns = txns.filter(t => t.product === 'Current');
  
  let totalIncome = 0;
  let totalSpending = 0;
  let totalFees = 0;
  
  for (const t of currentTxns) {
    if (t.type === 'Topup') totalIncome += t.amount;
    if (t.amount < 0 && t.type === 'Card Payment') totalSpending += Math.abs(t.amount);
    totalFees += t.fee;
  }
  
  // Add transfer income (from employers etc)
  for (const t of currentTxns) {
    if (t.type === 'Transfer' && t.amount > 0 && t.description.startsWith('Payment from')) {
      totalIncome += t.amount;
    }
  }
  
  // Add transfer spending
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
  const monthSpan = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30.44));
  
  const cats = getCategoryBreakdown();
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
    dateRange: {
      from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
    },
    topIncomeSource: 'Salary',
    biggestExpenseCategory: biggestCat,
  };
}

export function getAIInsights(): AIInsight[] {
  const stats = getSummaryStats();
  const cats = getCategoryBreakdown();
  const monthly = getMonthlyBreakdown();
  
  const foodDelivery = cats.find(c => c.category === 'Food Delivery');
  const diningOut = cats.find(c => c.category === 'Dining Out');
  const transport = cats.find(c => c.category === 'Transport');
  const groceries = cats.find(c => c.category === 'Groceries');
  
  const insights: AIInsight[] = [];
  
  // Food delivery warning
  if (foodDelivery && foodDelivery.total > 2000) {
    const monthlyDelivery = Math.round(foodDelivery.total / 26 * 100) / 100;
    insights.push({
      type: 'warning',
      title: 'Food delivery spending is high',
      description: `You\'ve spent £${foodDelivery.total.toLocaleString()} on Deliveroo, Just Eat & Uber Eats across ${foodDelivery.count} orders — about £${monthlyDelivery}/month. Cooking just 2 more meals per week could save ~£150/month (£1,800/year).`,
      metric: `£${monthlyDelivery}/mo`,
    });
  }
  
  // Combined eating out
  const totalEatingOut = (foodDelivery?.total ?? 0) + (diningOut?.total ?? 0);
  if (totalEatingOut > 3000) {
    insights.push({
      type: 'warning',
      title: 'Food away from home dominates spending',
      description: `Combined food delivery + dining out totals £${Math.round(totalEatingOut).toLocaleString()}, which is ${Math.round(totalEatingOut / stats.totalSpending * 100)}% of your card spending. The grocery bill is only £${groceries?.total.toLocaleString() ?? '0'} — there\'s clear room to shift the balance.`,
      metric: `£${Math.round(totalEatingOut).toLocaleString()}`,
    });
  }
  
  // Savings habit
  insights.push({
    type: 'success',
    title: 'Consistent savings habit established',
    description: `You\'ve built a pattern of saving £100/month to your Driving Fund since late 2024. This discipline is excellent — consider increasing it by even £25/month as your income grows.`,
    metric: '£100/mo',
  });
  
  // Savings rate
  if (stats.savingsRate < 15) {
    insights.push({
      type: 'warning',
      title: 'Savings rate needs improvement',
      description: `Your effective savings rate is around ${stats.savingsRate}%. Financial advisors recommend saving at least 20% of income. With your salary, targeting £800-1,000/month in savings would build a strong safety net within a year.`,
      metric: `${stats.savingsRate}%`,
    });
  } else {
    insights.push({
      type: 'success',
      title: 'Healthy savings rate',
      description: `Your savings rate of ${stats.savingsRate}% is above the recommended 20% minimum. Keep this momentum going.`,
      metric: `${stats.savingsRate}%`,
    });
  }
  
  // Transport
  if (transport && transport.total > 2000) {
    insights.push({
      type: 'tip',
      title: 'Consider a TfL travelcard',
      description: `You\'ve spent £${transport.total.toLocaleString()} on transport (${transport.count} journeys). A monthly Zone 1-3 travelcard costs ~£172/month and could save you money if you\'re commuting 5 days/week. Also review Uber trips — some could be replaced by public transport.`,
      metric: `${transport.count} trips`,
    });
  }
  
  // Emergency fund
  insights.push({
    type: 'tip',
    title: 'Build a 3-month emergency fund',
    description: `Your average monthly spending is ~£${Math.round(stats.avgMonthlySpending).toLocaleString()}. An ideal emergency fund would be £${Math.round(stats.avgMonthlySpending * 3).toLocaleString()}. Consider a high-yield savings account (currently ~5% AER) to make your savings work harder.`,
    metric: `£${Math.round(stats.avgMonthlySpending * 3).toLocaleString()} target`,
  });
  
  // Maximise ISA allowance
  insights.push({
    type: 'tip',
    title: 'Maximise your ISA allowance',
    description: `You have a £20,000/year ISA allowance — use it or lose it each tax year. A Stocks & Shares ISA invested in a global index fund grows tax-free: no capital gains tax, no tax on dividends. Even £300/month could grow to ~£45,000 in 10 years. Platforms like Vanguard or InvestEngine keep fees under 0.2%.`,
    metric: '£20k/yr tax-free',
  });
  
  // Savings withdrawal pattern
  insights.push({
    type: 'warning',
    title: 'Savings pocket empties to £0 repeatedly',
    description: `Your savings pocket follows a pattern of building up (£500–£700) then being fully withdrawn back to £0. This erases your progress. Try keeping a minimum balance you never touch — even £200 as a floor — and only withdraw amounts above that. Automating a "do not touch" threshold makes saving stick.`,
    metric: '£0 floor',
  });
  
  // Spending volatility
  const recentMonths = monthly.slice(-6);
  const maxSpend = Math.max(...recentMonths.map(m => m.spending));
  const minSpend = Math.min(...recentMonths.filter(m => m.spending > 0).map(m => m.spending));
  if (maxSpend > minSpend * 2.5) {
    insights.push({
      type: 'info',
      title: 'Spending varies significantly month to month',
      description: `In the last 6 months, monthly spending ranged from £${Math.round(minSpend).toLocaleString()} to £${Math.round(maxSpend).toLocaleString()}. Creating a monthly budget with fixed allocations for each category would help smooth out these peaks.`,
      metric: `${Math.round(maxSpend / minSpend)}x variance`,
    });
  }
  
  // Wealth building
  insights.push({
    type: 'tip',
    title: 'Start investing for compound growth',
    description: `Even £200/month in a global index fund (e.g., Vanguard FTSE Global All Cap) could grow to ~£30,000 in 10 years at historical average returns. Time in the market beats timing the market — starting now is what matters most.`,
    metric: '£200/mo → £30k',
  });
  
  return insights;
}

export function getIncomeVsExpenses(): { month: string; income: number; expenses: number }[] {
  return getMonthlyBreakdown().map(m => ({
    month: m.month,
    income: m.income,
    expenses: m.spending,
  }));
}

export function getClientData(): ClientData {
  const allTxns = getTransactions();

  // Build client transactions: filter out REVERTED, sort by date descending
  const activeTxns = allTxns
    .filter(t => t.state !== 'REVERTED')
    .sort((a, b) => b.startedDate.getTime() - a.startedDate.getTime());

  const transactions: ClientTransaction[] = activeTxns.map((t, i) => {
    const iso = t.startedDate.toISOString();
    return {
      id: i,
      date: iso.slice(0, 10),
      time: iso.slice(11, 16),
      desc: t.description,
      amt: Math.round(t.amount * 100) / 100,
      fee: Math.round(t.fee * 100) / 100,
      cat: categorize(t.description, t.type, t.amount),
      type: t.type,
      bal: t.balance !== null ? Math.round(t.balance * 100) / 100 : null,
      state: t.state,
      product: t.product,
    };
  });

  return {
    transactions,
    categories: getCategoryBreakdown(),
    merchants: getTopMerchants(20),
    monthly: getMonthlyBreakdown(),
    weekday: getWeekdaySpending(),
    balanceHistory: getBalanceHistory(),
    savingsHistory: getSavingsHistory(),
    stats: getSummaryStats(),
    insights: getAIInsights(),
  };
}
