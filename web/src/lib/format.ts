export function money(minor: number) { return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', currencyDisplay: 'code', maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100); }
export function rupeesToMinor(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, fraction = ''] = value.trim().split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : NaN;
}
export function localDateInput(iso: string | Date): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.valueOf())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (key: string) => parts.find(p => p.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function colomboToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const date = new Date(`${value}:00+05:30`);
  return Number.isFinite(date.valueOf()) && localDateInput(date) === value ? date.toISOString() : '';
}
export function dateTime(iso: string) { return new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)); }
export function tomorrowAt(hour = 8) { const value = localDateInput(new Date(Date.now() + 86400000)); return `${value.slice(0, 10)}T${String(hour).padStart(2, '0')}:00`; }
export function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }
