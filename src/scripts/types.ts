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

export interface WorkflowStatus {
  status: string;
  steps?: Record<string, string>;
  output?: unknown;
  error?: string;
}
