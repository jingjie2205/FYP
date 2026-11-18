import { Request, Response } from "express";
import { sql } from "../config/db.js";

// Returns "YYYY-MM-DD" for a real calendar date, null for empty input, or undefined when invalid
// (e.g. "2027-2-30"), so a bad value is rejected here instead of failing inside Postgres.
function normalizeDeadline(value: unknown): string | null | undefined {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value).trim().slice(0, 10);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return undefined;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return undefined;
    return text;
}

// GET all savings plans for a specific user
export async function getSavingsPlans(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const plans = await sql`
            SELECT 
                id,
                user_id,
                name,
                target_amount,
                saved_amount,
                deadline,
                created_at
            FROM savings_plans
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        res.status(200).json(plans);
    } catch (e) {
        console.error("Error fetching savings plans:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// CREATE a new savings plan
export async function createSavingsPlan(req: Request, res: Response) {
    try {
        const { userId } = req.params;
        // saved_amount is deliberately ignored: a goal always starts at 0 and can only be funded
        // from the Unallocated Cash pool through /contribute, so no money appears out of nowhere.
        const { name, target_amount, deadline } = req.body;

        if (!name || target_amount === undefined) {
            return res.status(400).json({ error: "Missing required fields - name and target_amount" });
        }

        const cleanDeadline = normalizeDeadline(deadline);
        if (cleanDeadline === undefined) {
            return res.status(400).json({ error: "deadline must be a valid date (YYYY-MM-DD)" });
        }

        const [newPlan] = await sql`
            INSERT INTO savings_plans (user_id, name, target_amount, saved_amount, deadline)
            VALUES (${userId}, ${name}, ${target_amount || 0}, 0, ${cleanDeadline})
            RETURNING *;
        `;

        res.status(201).json(newPlan);
    } catch (e) {
        console.error("Error creating savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// UPDATE an existing savings plan
export async function updateSavingsPlan(req: Request, res: Response) {
    try {
        const { id } = req.params;
        // saved_amount is not editable here; it only changes via /contribute and /withdraw (ledger-backed)
        const { name, target_amount, deadline } = req.body;

        // null/empty = leave the existing deadline unchanged (COALESCE below)
        const cleanDeadline = normalizeDeadline(deadline);
        if (cleanDeadline === undefined) {
            return res.status(400).json({ error: "deadline must be a valid date (YYYY-MM-DD)" });
        }

        const [updatedPlan] = await sql`
            UPDATE savings_plans
            SET 
                name = COALESCE(${name}, name),
                target_amount = COALESCE(${target_amount}, target_amount),
                deadline = COALESCE(${cleanDeadline}, deadline)
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!updatedPlan) {
            return res.status(404).json({ error: "Savings plan not found" });
        }

        res.status(200).json(updatedPlan);
    } catch (e) {
        console.error("Error updating savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// DELETE a savings plan
export async function deleteSavingsPlan(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const [deletedPlan] = await sql`
            DELETE FROM savings_plans
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!deletedPlan) {
            return res.status(404).json({ error: "Savings plan not found" });
        }

        // Past ledger rows keep existing with savings_plan_id = NULL (FK ON DELETE SET NULL).
        // Unallocated Cash = cash - envelopes - SUM(saved_amount), so the removed goal's
        // saved_amount is released back into the pool automatically.
        res.status(200).json({
            message: "Savings plan deleted successfully",
            deletedPlan,
            releasedAmount: Number(deletedPlan.saved_amount || 0),
        });
    } catch (e) {
        console.error("Error deleting savings plan:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

function isValidDate(value: unknown): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(`${value}T00:00:00`).getTime());
}

function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Moves money between Unallocated Cash and a goal. The plan update and the ledger row are one SQL
// statement (CTE), so they succeed or fail together.
async function moveSavingsFunds(req: Request, res: Response, direction: "contribute" | "withdraw") {
    try {
        const id = String(req.params.id);
        const { user_id, amount, transaction_date } = req.body;
        const userId = user_id ? String(user_id) : "";
        const value = Number(amount);

        if (!userId) {
            return res.status(400).json({ error: "user_id is required" });
        }
        if (amount === undefined || isNaN(value) || value <= 0) {
            return res.status(400).json({ error: "Valid positive amount is required" });
        }
        if (transaction_date !== undefined && !isValidDate(transaction_date)) {
            return res.status(400).json({ error: "transaction_date must be YYYY-MM-DD" });
        }
        const date = transaction_date ?? todayString();

        const [plan] = await sql`SELECT id, name, saved_amount FROM savings_plans WHERE id = ${id} AND user_id = ${userId}`;
        if (!plan) {
            return res.status(404).json({ error: "Savings plan not found" });
        }

        if (direction === "withdraw" && value > Number(plan.saved_amount || 0)) {
            return res.status(400).json({
                error: `Cannot withdraw $${value.toFixed(2)}; only $${Number(plan.saved_amount || 0).toFixed(2)} is saved in "${plan.name}".`,
            });
        }

        // transactions.account_id is required, so the ledger row is attached to the user's oldest account.
        // Savings types never touch account balances, so which account is used does not matter for the math.
        const [account] = await sql`SELECT id FROM accounts WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1`;
        if (!account) {
            return res.status(400).json({ error: "Create an account before moving money into savings" });
        }

        const delta = direction === "contribute" ? value : -value;
        const txType = direction === "contribute" ? "savings" : "savings_withdrawal";
        const titlePrefix = direction === "contribute" ? "Savings: " : "Savings withdrawal: ";

        const rows = await sql`
            WITH upd AS (
                UPDATE savings_plans
                SET saved_amount = saved_amount + ${delta}::numeric
                WHERE id = ${id} AND user_id = ${userId}
                  AND saved_amount + ${delta}::numeric >= 0
                RETURNING *
            ), ins AS (
                INSERT INTO transactions (user_id, account_id, title, amount, type, savings_plan_id, transaction_date)
                SELECT ${userId}::text, ${account.id}::uuid, ${titlePrefix}::text || upd.name, ${value}::numeric,
                       ${txType}::text, upd.id, ${date}::date
                FROM upd
                RETURNING id
            )
            SELECT upd.* FROM upd
        `;

        if (rows.length === 0) {
            return res.status(400).json({ error: "Insufficient funds in this savings goal" });
        }

        res.status(200).json(rows[0]);
    } catch (e) {
        console.error(`Error during savings ${direction}:`, e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// POST /api/savings/:id/contribute  body: { user_id, amount, transaction_date? }
export function contributeToSavings(req: Request, res: Response) {
    return moveSavingsFunds(req, res, "contribute");
}

// POST /api/savings/:id/withdraw  body: { user_id, amount, transaction_date? }
export function withdrawFromSavings(req: Request, res: Response) {
    return moveSavingsFunds(req, res, "withdraw");
}
