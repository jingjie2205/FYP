import { sql } from "../config/db.js";
import { addMonths, parseMonth } from "./budgetService.js";

/**
 * READ-ONLY financial snapshot for the chat assistant.
 * Only SELECT statements in this file; every query is scoped to the given user_id.
 */

export interface MonthFigures {
  assigned: number;
  spent: number;
  available: number;
}

export interface ChatEnvelope {
  category_id: string;
  name: string;
  group_name: string | null;
  months: Record<string, MonthFigures>;
}

export interface ChatContext {
  today: string;
  currentMonth: string; // "YYYY-MM"
  accounts: { id: string; name: string; balance: number; is_default: boolean }[];
  totalCash: number;
  envelopes: ChatEnvelope[];
  spendingSummary: {
    category_id: string | null;
    category: string;
    byMonth: Record<string, number>;
    last3MonthsTotal: number;
    last3MonthsMonthlyAverage: number;
  }[];
  recentTransactions: {
    id: string;
    title: string;
    amount: number;
    type: string;
    category_name: string | null;
    account_name: string | null;
    transaction_date: string;
  }[];
  savingsPlans: {
    id: string;
    name: string;
    target_amount: number;
    saved_amount: number;
    deadline: string | null;
  }[];
  recurring: {
    id: string;
    title: string;
    amount: number;
    type: string;
    frequency: string;
    next_date: string | null;
    category_id: string | null;
    category_name: string | null;
    account_id: string | null;
    account_name: string | null;
    is_active: boolean;
  }[];
  unallocatedPool: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v ?? 0);

export async function buildChatContext(userId: string, todayInput?: unknown): Promise<ChatContext> {
  const todayMonthStart = parseMonth(todayInput);
  const today =
    typeof todayInput === "string" && todayMonthStart && /^\d{4}-\d{2}-\d{2}$/.test(todayInput)
      ? todayInput
      : new Date().toISOString().slice(0, 10);

  const currentMonthStart = `${today.slice(0, 7)}-01`;
  const firstMonthStart = addMonths(currentMonthStart, -6);
  const nextMonthStart = addMonths(currentMonthStart, 1);
  const monthKeys: string[] = [];
  for (let i = 6; i >= 0; i--) monthKeys.push(addMonths(currentMonthStart, -i).slice(0, 7));

  const [
    accountRows,
    flowRows,
    categoryRows,
    budgetRows,
    spentRows,
    recentRows,
    savingsRows,
    recurringRows,
  ] = await Promise.all([
    sql`SELECT id, name, balance, is_default FROM accounts WHERE user_id = ${userId} ORDER BY created_at ASC`,
    // Cash flow per account (same rule the app uses: skip the opening balance if an "Initial Balance" transaction exists)
    sql`
      SELECT account_id,
             COALESCE(SUM(CASE WHEN type = 'income' THEN amount WHEN type = 'expense' THEN -amount ELSE 0 END), 0) AS net,
             COALESCE(BOOL_OR(LOWER(title) LIKE '%initial balance%'), FALSE) AS has_initial
      FROM transactions
      WHERE user_id = ${userId}
      GROUP BY account_id
    `,
    sql`
      SELECT c.id, c.name, g.name AS group_name
      FROM categories c
      LEFT JOIN category_groups g ON g.id = c.group_id
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at ASC
    `,
    sql`
      SELECT category_id, to_char(month, 'YYYY-MM') AS month, assigned
      FROM category_budgets
      WHERE user_id = ${userId}
        AND month >= ${firstMonthStart}::date AND month < ${nextMonthStart}::date
    `,
    sql`
      SELECT category_id, to_char(transaction_date, 'YYYY-MM') AS month, SUM(amount) AS spent
      FROM transactions
      WHERE user_id = ${userId}
        AND type = 'expense'
        AND transaction_date >= ${firstMonthStart}::date AND transaction_date < ${nextMonthStart}::date
      GROUP BY category_id, to_char(transaction_date, 'YYYY-MM')
    `,
    sql`
      SELECT t.id, t.title, t.amount, t.type, c.name AS category_name, a.name AS account_name,
             to_char(t.transaction_date, 'YYYY-MM-DD') AS transaction_date
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.user_id = ${userId}
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 80
    `,
    sql`
      SELECT id, name, target_amount, saved_amount, to_char(deadline, 'YYYY-MM-DD') AS deadline
      FROM savings_plans
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `,
    sql`
      SELECT rt.id, rt.title, rt.amount, rt.type, rt.frequency, rt.is_active,
             to_char(rt.next_run_date, 'YYYY-MM-DD') AS next_date,
             rt.category_id, c.name AS category_name, rt.account_id, a.name AS account_name
      FROM recurring_transactions rt
      LEFT JOIN categories c ON c.id = rt.category_id
      LEFT JOIN accounts a ON a.id = rt.account_id
      WHERE rt.user_id = ${userId}
      ORDER BY rt.created_at DESC
    `,
  ]);

  // ---- Accounts & total cash ----
  const flowByAccount = new Map<string, { net: number; hasInitial: boolean }>();
  flowRows.forEach((r: any) => flowByAccount.set(String(r.account_id), { net: num(r.net), hasInitial: !!r.has_initial }));

  let totalCash = 0;
  const accounts = accountRows.map((a: any) => {
    const flow = flowByAccount.get(String(a.id));
    const base = num(a.balance);
    totalCash += flow ? (flow.hasInitial ? flow.net : base + flow.net) : base;
    return { id: String(a.id), name: String(a.name), balance: round2(base), is_default: !!a.is_default };
  });
  totalCash = round2(totalCash);

  // ---- Envelopes with per-month assigned / spent / available ----
  const assignedMap = new Map<string, number>(); // `${category}|${month}`
  budgetRows.forEach((r: any) => assignedMap.set(`${r.category_id}|${r.month}`, num(r.assigned)));
  const spentMap = new Map<string, number>();
  let uncategorized: Record<string, number> = {};
  spentRows.forEach((r: any) => {
    if (r.category_id) spentMap.set(`${r.category_id}|${r.month}`, num(r.spent));
    else uncategorized[r.month] = num(r.spent);
  });

  const envelopes: ChatEnvelope[] = categoryRows.map((c: any) => {
    const months: Record<string, MonthFigures> = {};
    for (const m of monthKeys) {
      const assigned = assignedMap.get(`${c.id}|${m}`) ?? 0;
      const spent = spentMap.get(`${c.id}|${m}`) ?? 0;
      months[m] = { assigned: round2(assigned), spent: round2(spent), available: round2(assigned - spent) };
    }
    return { category_id: String(c.id), name: String(c.name), group_name: c.group_name ? String(c.group_name) : null, months };
  });

  // ---- Pre-aggregated spending summary (exact SQL sums, so the model never adds rows itself) ----
  const last3 = monthKeys.slice(-3);
  const summarize = (id: string | null, name: string, byMonthRaw: Record<string, number>) => {
    const byMonth: Record<string, number> = {};
    for (const m of monthKeys) byMonth[m] = round2(byMonthRaw[m] ?? 0);
    const total = round2(last3.reduce((s, m) => s + byMonth[m], 0));
    return { category_id: id, category: name, byMonth, last3MonthsTotal: total, last3MonthsMonthlyAverage: round2(total / 3) };
  };
  const spendingSummary = categoryRows.map((c: any) => {
    const raw: Record<string, number> = {};
    for (const m of monthKeys) raw[m] = spentMap.get(`${c.id}|${m}`) ?? 0;
    return summarize(String(c.id), String(c.name), raw);
  });
  if (Object.keys(uncategorized).length > 0) spendingSummary.push(summarize(null, "Uncategorized", uncategorized));

  // ---- Savings, recurring, recent ----
  const savingsPlans = savingsRows.map((s: any) => ({
    id: String(s.id),
    name: String(s.name),
    target_amount: round2(num(s.target_amount)),
    saved_amount: round2(num(s.saved_amount)),
    deadline: s.deadline ?? null,
  }));

  const recurring = recurringRows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    amount: round2(num(r.amount)),
    type: String(r.type),
    frequency: String(r.frequency),
    next_date: r.next_date ?? null,
    category_id: r.category_id ? String(r.category_id) : null,
    category_name: r.category_name ?? null,
    account_id: r.account_id ? String(r.account_id) : null,
    account_name: r.account_name ?? null,
    is_active: r.is_active !== false,
  }));

  const recentTransactions = recentRows.map((t: any) => ({
    id: String(t.id),
    title: String(t.title),
    amount: round2(num(t.amount)),
    type: String(t.type),
    category_name: t.category_name ?? null,
    account_name: t.account_name ?? null,
    transaction_date: String(t.transaction_date),
  }));

  // ---- Unallocated pool: totalCash - sum(max(0, available)) - sum(saved) ----
  const currentMonth = today.slice(0, 7);
  const reserved = envelopes.reduce((s, e) => s + Math.max(0, e.months[currentMonth]?.available ?? 0), 0);
  const saved = savingsPlans.reduce((s, p) => s + p.saved_amount, 0);
  const unallocatedPool = round2(totalCash - reserved - saved);

  return { today, currentMonth, accounts, totalCash, envelopes, spendingSummary, recentTransactions, savingsPlans, recurring, unallocatedPool };
}
