/**
 * Transaction categorization logic.
 * Preserved from the original static build, now used at upload time.
 */

export const CATEGORY_COLORS: Record<string, string> = {
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

export function categorize(desc: string, type: string): string {
  const d = desc.toLowerCase();

  if (['deliveroo', 'just eat', 'uber eats'].some((x) => d.includes(x))) return 'Food Delivery';
  if (['transport for london', 'tfl'].some((x) => d.includes(x))) return 'Transport';
  if (['uber', 'bolt'].some((x) => d === x || d.startsWith(x + ' '))) return 'Transport';
  if (['trainline', 'trainpal'].some((x) => d.includes(x))) return 'Transport';
  if (['whipps cross', 'hospital', 'pharmacy'].some((x) => d.includes(x))) return 'Healthcare';
  if (
    [
      'the raj', 'wetherspoon', 'gokyuzu', 'sirac kebab', 'nando', 'mcdonald', 'kfc',
      'greggs', 'subway', 'pizza', 'burger king', 'pret',
    ].some((x) => d.includes(x))
  )
    return 'Dining Out';
  if (['elior'].some((x) => d.includes(x))) return 'Dining Out';
  if (
    [
      'tesco', 'sainsbury', 'lidl', 'aldi', 'asda', 'morrisons', 'co-op', 'waitrose',
      'iceland', '7 star', 'brading food', 'glade food', 'tariq halal',
    ].some((x) => d.includes(x))
  )
    return 'Groceries';
  if (['marks & spencer', 'm&s'].some((x) => d.includes(x))) return 'Groceries';
  if (
    [
      'etihad', 'virgin atlantic', 'air canada', 'air india', 'pegasus', 'trip.com',
      'trip ', 'airbnb', 'booking.com', 'resident hotel',
    ].some((x) => d.includes(x))
  )
    return 'Travel';
  if (
    [
      'amazon', 'argos', 'uniqlo', 'deichmann', 'boots', 'superdrug', 'poundland',
      'primark', 'beauty base', 'h&m', 'tk maxx', 'john lewis',
    ].some((x) => d.includes(x))
  )
    return 'Shopping';
  if (['stow residential', 'goodlord'].some((x) => d.includes(x))) return 'Housing';
  if (['octopus energy'].some((x) => d.includes(x))) return 'Utilities';
  if (
    [
      'netflix', 'spotify', 'apple.com', 'youtube', 'disney', 'vodafone', 'cerebras',
      'exe.dev', 'bold software', 'cloudflare', 'homelet', 'openai', 'chatgpt',
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
