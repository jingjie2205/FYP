-- Savings goal contributions/withdrawals tracked in the existing transactions table.
-- Run once in the Neon SQL console. No new tables.

-- 1. Link a transaction to the savings goal it moved money into/out of.
--    The column type is copied from savings_plans.id so the FK always matches.
--    ON DELETE SET NULL keeps history when a goal is deleted.
DO $$
DECLARE
    plan_id_type text;
BEGIN
    SELECT format_type(atttypid, atttypmod) INTO plan_id_type
    FROM pg_attribute
    WHERE attrelid = 'savings_plans'::regclass AND attname = 'id';

    EXECUTE format(
        'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS savings_plan_id %s REFERENCES savings_plans(id) ON DELETE SET NULL',
        plan_id_type
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_savings_plan ON transactions (savings_plan_id) WHERE savings_plan_id IS NOT NULL;

-- 2. If transactions.type has a CHECK constraint, replace it with one that also allows
--    'savings' and 'savings_withdrawal'. If there is no CHECK constraint, nothing is changed.
DO $$
DECLARE
    c record;
    had_check boolean := false;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'transactions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', c.conname);
        had_check := true;
    END LOOP;

    IF had_check THEN
        ALTER TABLE transactions
            ADD CONSTRAINT transactions_type_check
            CHECK (type IN ('income', 'expense', 'transfer', 'savings', 'savings_withdrawal'));
    END IF;
END $$;
