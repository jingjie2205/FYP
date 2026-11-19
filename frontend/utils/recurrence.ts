// Which dates a recurring rule lands on within a given month. Mirrors the server's scheduling
// (backend/src/services/recurringService.ts): weekly = every 7 days, monthly/yearly keep the
// original day and fall back to the last day of shorter months.

export type RecurringFrequency = 'Weekly' | 'Monthly' | 'Yearly';

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MS_PER_DAY = 86400000;

/**
 * @param startDate  the rule's first date "YYYY-MM-DD" (the anchor)
 * @param monthKey   "YYYY-MM"
 * @returns every occurrence date ("YYYY-MM-DD") in that month, in order; empty when none
 */
export function getOccurrencesInMonth(startDate: string, frequency: RecurringFrequency, monthKey: string): string[] {
  const start = String(startDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!start) return [];
  const [sy, sm, sd] = [Number(start[1]), Number(start[2]), Number(start[3])];
  const [y, m] = monthKey.split('-').map(Number);
  const dim = daysInMonth(y, m);
  const monthStartMs = Date.UTC(y, m - 1, 1);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const monthEndMs = Date.UTC(y, m - 1, dim);

  if (startMs > monthEndMs) return []; // rule hasn't started yet

  if (frequency === 'Weekly') {
    // First occurrence on or after the 1st of the month
    let firstMs = startMs;
    if (startMs < monthStartMs) {
      firstMs = startMs + Math.ceil((monthStartMs - startMs) / (7 * MS_PER_DAY)) * 7 * MS_PER_DAY;
    }
    const dates: string[] = [];
    for (let t = firstMs; t <= monthEndMs; t += 7 * MS_PER_DAY) {
      const d = new Date(t);
      dates.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
    return dates;
  }

  if (frequency === 'Yearly' && m !== sm) return [];

  // Monthly (every month from the start month on) or Yearly (only in the start month)
  const day = Math.min(sd, dim);
  if (Date.UTC(y, m - 1, day) < startMs) return [];
  return [`${y}-${pad(m)}-${pad(day)}`];
}
