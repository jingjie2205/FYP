// Month helpers. A "month key" is a "YYYY-MM" string, e.g. "2026-11".

/** Month key for the date currently set on the user's phone. */
export function getPhoneMonthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Shifts a month key by n months (negative = backwards). */
export function shiftMonthKey(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** "2026-11" -> "November 2026" (or "Nov 2026" when short). */
export function formatMonthKey(monthKey: string, short = false): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  });
}

/** Number of days in the month. */
export function daysInMonthKey(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Month key of a transaction. Prefers the server-computed `month_key`
 * (avoids timezone shifts on DATE columns) and falls back to parsing the date string.
 */
export function getTransactionMonthKey(tx: any): string {
  if (tx?.month_key) return tx.month_key;
  const raw = String(tx?.transaction_date || tx?.created_at || '');
  const match = raw.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : '';
}

/** Day of month (1-31) of a transaction, using the date part of the string. */
export function getTransactionDay(tx: any): number {
  const raw = String(tx?.transaction_date || tx?.created_at || '');
  const match = raw.match(/^\d{4}-\d{2}-(\d{2})/);
  return match ? Number(match[1]) : 1;
}

/** Date currently set on the phone as "YYYY-MM-DD" (local time). */
export function getPhoneDateString(date: Date = new Date()): string {
  return `${getPhoneMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}
