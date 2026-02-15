/**
 * Revolut CSV statement parser.
 * Handles the specific format exported by Revolut.
 */

export interface RawTransaction {
  type: string;
  product: string;
  startedDate: string;
  completedDate: string;
  description: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: number | null;
}

/** Parse a single CSV line handling quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
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
  return fields;
}

/** Validate that the CSV has the expected Revolut header */
export function validateRevolutCSV(text: string): { valid: boolean; error?: string } {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    return { valid: false, error: 'CSV file is empty or has no data rows' };
  }

  const header = lines[0].toLowerCase();
  const requiredFields = ['type', 'amount', 'started date'];
  const missing = requiredFields.filter(f => !header.includes(f));

  if (missing.length > 0) {
    return { valid: false, error: `Missing required columns: ${missing.join(', ')}. Expected Revolut CSV format.` };
  }

  return { valid: true };
}

/** Parse Revolut CSV text into structured transactions */
export function parseRevolutCSV(text: string): RawTransaction[] {
  const lines = text.trim().split('\n');
  const transactions: RawTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    if (fields.length < 10) continue;

    transactions.push({
      type: fields[0],
      product: fields[1],
      startedDate: fields[2],
      completedDate: fields[3],
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

/** Categorize a transaction based on description and type */
export function categorize(desc: string, type: string): string {
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

  return 'Other';
}
