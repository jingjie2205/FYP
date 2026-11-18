-- Monthly envelopes + rollover
-- Run once in the Neon SQL console.

-- 1. One row per envelope (category) per month
CREATE TABLE IF NOT EXISTS category_budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    month       DATE NOT NULL,                       -- always the 1st of the month, e.g. 2026-11-01
    assigned    DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- amount budgeted into the envelope this month
    rollover    DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- leftover carried in from the previous month
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT category_budgets_month_is_first CHECK (EXTRACT(DAY FROM month) = 1),
    UNIQUE (category_id, month)
);

CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month ON category_budgets (user_id, month);

-- 2. Last month the app rolled the user's envelopes into (driven by the phone's date)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_rollover_month DATE;

-- 3. Speeds up the per-month transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, transaction_date);

-- 4. Backfill: give every existing envelope a row for the current month,
--    using its current target_amount as the assigned amount (no rollover for the first month).
INSERT INTO category_budgets (user_id, category_id, month, assigned, rollover)
SELECT c.user_id, c.id, date_trunc('month', CURRENT_DATE)::date, COALESCE(c.target_amount, 0), 0
FROM categories c
WHERE c.user_id IS NOT NULL
ON CONFLICT (category_id, month) DO NOTHING;
