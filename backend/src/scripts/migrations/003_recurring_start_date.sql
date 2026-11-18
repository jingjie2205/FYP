-- Recurring rules: remember the original day so a rule created on the 31st
-- goes Jan 31 -> Feb 28 -> Mar 31 (not Mar 28). Run once in the Neon SQL console.
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS start_date DATE;

-- Existing rules: use the date of their next run as the anchor
UPDATE recurring_transactions SET start_date = next_run_date::date WHERE start_date IS NULL;
