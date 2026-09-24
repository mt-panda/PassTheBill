export const CURRENCY = 'Rs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const groupThousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "Rs 1,950". Whole rupees, fixed grouping, independent of the device locale (matches SQL rs()). */
export function money(n: number): string {
  const r = Math.round(n);
  return `${r < 0 ? '-' : ''}${CURRENCY} ${groupThousands(Math.abs(r))}`;
}

/** Largest-remainder rounding: rounded parts always add up to the rounded total. */
export function splitRound(parts: number[], total = parts.reduce((s, p) => s + p, 0)): number[] {
  const out = parts.map((p) => Math.floor(p));
  let rest = Math.round(total) - out.reduce((s, p) => s + p, 0);
  const order = parts
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i] += 1;
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parses 'YYYY-MM-DD' (or a timestamp starting with it) as a local date. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const dayDiff = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      86_400_000
  );

const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "Tue, 22 Sep" (adds the year when it isn't the current one). */
export function shortDate(s: string, today = new Date()): string {
  const d = parseYmd(s);
  const base = `${WEEKDAYS[d.getDay()]}, ${dayMonth(d)}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "Today" / "Tomorrow" / "Yesterday" / shortDate. */
export function dayLabel(s: string, today = new Date()): string {
  const diff = dayDiff(parseYmd(s), today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return shortDate(s, today);
}

/** "1–28 Aug", "28 Aug – 3 Sep", "24 Sep", "Since 1 Sep"; years added when not the current year. */
export function rangeLabel(start: string, end?: string | null, today = new Date()): string {
  const a = parseYmd(start);
  const year = (d: Date) => (d.getFullYear() === today.getFullYear() ? '' : ` ${d.getFullYear()}`);
  if (!end) return `Since ${dayMonth(a)}${year(a)}`;
  const b = parseYmd(end);
  if (a.getTime() === b.getTime()) return `${dayMonth(a)}${year(a)}`;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${dayMonth(a)} ${a.getFullYear()} – ${dayMonth(b)} ${b.getFullYear()}`;
  }
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${dayMonth(b)}${year(b)}`;
  return `${dayMonth(a)} – ${dayMonth(b)}${year(b)}`;
}

/** Accepts "450", "450.5", "150,5". Returns null for anything else (incl. "1,950"). */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return null;
  return Number(t.replace(',', '.'));
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
