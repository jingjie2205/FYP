import { sql } from "../config/db.js";

// Maximum number of months a single rollover call will walk forward.
// Guards against a phone clock set far into the future creating thousands of rows.
const MAX_ROLLOVER_STEPS = 24;

/**
 * Accepts "YYYY-MM" or "YYYY-MM-DD" and normalises to the first day of that month ("YYYY-MM-01").
 * Returns null for anything invalid.
 */
export function parseMonth(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const match = input.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

/** Adds n months to a "YYYY-MM-01" string. */
export function addMonths(monthStart: string, n: number): string {
  const [y, m] = monthStart.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function serverCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * The month the user is currently "in" according to the last rollover the app performed
 * (driven by the phone's date). Falls back to the server's current month.
 */
export async function getActiveMonth(userId: string): Promise<string> {
  const [row] = await sql`
    SELECT to_char(last_rollover_month, 'YYYY-MM-DD') AS month
    FROM users WHERE id = ${userId}
  `;
  return row?.month || serverCurrentMonth();
}

/**
 * Creates category_budgets rows for `month` for every category of the user that does not have one yet.
 * - assigned  = the category's default monthly budget (categories.target_amount), falling back to last month's assigned
 * - rollover  = always 0. Leftovers are NOT carried into the new month; unspent envelope money simply returns to the
 *               overall Unallocated pool because every category restarts at its set-aside monthly budget.
 * Idempotent: existing rows are never touched.
 */
async function ensureMonthRows(userId: string, month: string) {
  const prevMonth = addMonths(month, -1);

  await sql`
    INSERT INTO category_budgets (user_id, category_id, month, assigned, rollover)
    SELECT
      c.user_id,
      c.id,
      ${month}::date,
      COALESCE(c.target_amount, p.assigned, 0),
      0
    FROM categories c
    LEFT JOIN category_budgets p
      ON p.category_id = c.id AND p.month = ${prevMonth}::date
    WHERE c.user_id = ${userId}
    ON CONFLICT (category_id, month) DO NOTHING
  `;
}

export interface RolloverResult {
  activeMonth: string;
  monthsRolled: string[];
}

/**
 * Brings the user's envelopes up to `targetMonth` (the month on the user's phone).
 * Never moves backwards: if the phone reports an earlier month than the last rollover,
 * nothing is rolled and the stored active month is kept.
 */
export async function runRollover(userId: string, targetMonth: string): Promise<RolloverResult> {
  const [userRow] = await sql`
    SELECT to_char(last_rollover_month, 'YYYY-MM-DD') AS month
    FROM users WHERE id = ${userId}
  `;
  if (!userRow) throw new Error(`User ${userId} not found`);

  const lastMonth: string | null = userRow.month;
  const monthsRolled: string[] = [];

  if (!lastMonth) {
    // First rollover ever for this user: just seed the target month.
    await ensureMonthRows(userId, targetMonth);
    monthsRolled.push(targetMonth);
  } else if (targetMonth > lastMonth) {
    let cursor = lastMonth;
    // Make sure the starting month itself is complete (e.g. categories created before the column existed).
    await ensureMonthRows(userId, cursor);
    let steps = 0;
    while (cursor < targetMonth && steps < MAX_ROLLOVER_STEPS) {
      cursor = addMonths(cursor, 1);
      await ensureMonthRows(userId, cursor);
      monthsRolled.push(cursor);
      steps++;
    }
  } else {
    // Same or earlier month: only fill in rows for categories added since the last rollover.
    await ensureMonthRows(userId, lastMonth);
  }

  const [updated] = await sql`
    UPDATE users
    SET last_rollover_month = GREATEST(COALESCE(last_rollover_month, ${targetMonth}::date), ${targetMonth}::date)
    WHERE id = ${userId}
    RETURNING to_char(last_rollover_month, 'YYYY-MM-DD') AS month
  `;

  return { activeMonth: updated.month, monthsRolled };
}

/**
 * Inserts or updates the assigned amount of one category for one month.
 * Pass `delta` to add/subtract instead of overwriting.
 */
export async function setMonthAssigned(
  userId: string,
  categoryId: string,
  month: string,
  value: number,
  mode: "set" | "delta" = "set"
) {
  await ensureMonthRows(userId, month);
  if (mode === "set") {
    await sql`
      UPDATE category_budgets
      SET assigned = ${value}, updated_at = CURRENT_TIMESTAMP
      WHERE category_id = ${categoryId} AND month = ${month}::date
    `;
  } else {
    await sql`
      UPDATE category_budgets
      SET assigned = assigned + ${value}, updated_at = CURRENT_TIMESTAMP
      WHERE category_id = ${categoryId} AND month = ${month}::date
    `;
  }
}
