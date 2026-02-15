export function fmtGBP(n: number | null): string {
  if (n == null) return '\u2014';
  const sign = n < 0 ? '-' : '';
  return sign + '\u00a3' + Math.abs(Math.round(n)).toLocaleString('en-GB');
}

export function fmtGBP2(n: number | null): string {
  if (n == null) return '\u2014';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toFixed(2);
  const [whole, dec] = abs.split('.');
  return sign + '\u00a3' + Number(whole).toLocaleString('en-GB') + '.' + dec;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

export function escapeCSV(val: unknown): string {
  const s = String(val == null ? '' : val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}
