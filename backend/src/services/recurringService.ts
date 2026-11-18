import { sql } from "../config/db.js";

// Safety cap on how many missed occurrences one rule posts per run
const MAX_OCCURRENCES_PER_RULE = 60;

export type Frequency = "weekly" | "monthly" | "yearly";

export function normalizeFrequency(value: unknown): Frequency | null {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "weekly" || v === "monthly" || v === "yearly" ? v : null;
}

/** True only for a real calendar date written as "YYYY-MM-DD". */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

export function serverToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * The occurrence after `current`. `anchor` (the rule's original start date) keeps the day of month
 * stable: a monthly rule started on the 31st lands on the last day of shorter months, then goes back to the 31st.
 */
export function nextOccurrence(current: string, frequency: Frequency, anchor: string): string {
  const [y, m, d] = current.split("-").map(Number);
  const anchorDay = Number(anchor.split("-")[2]);

  if (frequency === "weekly") {
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    return fmt(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  }
  if (frequency === "monthly") {
    const total = y * 12 + (m - 1) + 1;
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return fmt(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
  }
  // yearly (keeps the month; Feb 29 falls back to Feb 28 in non-leap years)
  return fmt(y + 1, m, Math.min(anchorDay, daysInMonth(y + 1, m)));
}

/** First occurrence on or after `today` (used when a paused rule is resumed, so it doesn't backfill the pause). */
export function firstOccurrenceOnOrAfter(current: string, frequency: Frequency, anchor: string, today: string): string {
  let next = current;
  for (let i = 0; i < 5000 && next < today; i++) {
    next = nextOccurrence(next, frequency, anchor);
  }
  return next;
}

export interface ProcessResult {
  created: number;
  transactionIds: string[];
}

/**
 * Posts a real transaction for every due occurrence (next_run_date <= today) of the user's active rules
 * and moves next_run_date forward. Missed periods are posted one by one, each dated on its own scheduled day.
 *
 * Safe to call repeatedly or from two devices at once: each occurrence is one SQL statement that only
 * advances the rule if next_run_date still equals the occurrence being posted, so it can't be posted twice.
 */
export async function processRecurring(userId: string, today: string): Promise<ProcessResult> {
  const rules = await sql`
    SELECT id, frequency,
           to_char(next_run_date, 'YYYY-MM-DD') AS next_date,
           to_char(start_date, 'YYYY-MM-DD') AS start
    FROM recurring_transactions
    WHERE user_id = ${userId}
      AND is_active = TRUE
      AND next_run_date::date <= ${today}::date
    ORDER BY next_run_date ASC
  `;

  const transactionIds: string[] = [];

  for (const rule of rules) {
    const frequency = normalizeFrequency(rule.frequency);
    if (!frequency) continue;

    let current: string = rule.next_date;
    const anchor: string = rule.start || current;

    for (let i = 0; i < MAX_OCCURRENCES_PER_RULE && current <= today; i++) {
      const next = nextOccurrence(current, frequency, anchor);

      const rows = await sql`
        WITH upd AS (
          UPDATE recurring_transactions
          SET next_run_date = ${next}::date, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${rule.id} AND is_active = TRUE AND next_run_date::date = ${current}::date
          RETURNING *
        )
        INSERT INTO transactions (user_id, account_id, category_id, recurring_id, title, amount, type, notes, transaction_date)
        SELECT upd.user_id, upd.account_id, upd.category_id, upd.id, upd.title, upd.amount, upd.type, 'Recurring', ${current}::date
        FROM upd
        RETURNING id
      `;

      // Another request already posted this occurrence (or the rule was paused/deleted)
      if (rows.length === 0) break;

      transactionIds.push(rows[0].id);
      current = next;
    }
  }

  return { created: transactionIds.length, transactionIds };
}
