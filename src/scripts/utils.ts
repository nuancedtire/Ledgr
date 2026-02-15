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

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

export function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; totalPages: number; currentPage: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const cur = Math.max(1, Math.min(page, totalPages));
  return { items: items.slice((cur - 1) * perPage, cur * perPage), totalPages, currentPage: cur };
}

export function el(
  tag: string,
  attrs?: Record<string, unknown> | null,
  children?: string | Node | (Node | null)[] | null,
): HTMLElement {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v as string;
      else if (k === 'innerHTML') e.innerHTML = v as string;
      else if (k.startsWith('on') && typeof v === 'function') {
        e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else {
        e.setAttribute(k, String(v));
      }
    }
  }
  if (children != null) {
    if (typeof children === 'string') e.textContent = children;
    else if (Array.isArray(children)) children.forEach(c => { if (c) e.appendChild(c); });
    else e.appendChild(children);
  }
  return e;
}

export function escapeCSV(val: unknown): string {
  const s = String(val == null ? '' : val);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

export function defaultColor(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360},55%,55%)`;
}
