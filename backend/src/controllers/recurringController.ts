import { Request, Response } from "express";
import { sql } from "../config/db.js";
import {
    firstOccurrenceOnOrAfter,
    isValidDateString,
    normalizeFrequency,
    processRecurring,
    serverToday,
} from "../services/recurringService.js";

// POST /api/recurring/process/:userId  body: { date: "YYYY-MM-DD" }  (date = today on the user's phone)
export async function processRecurringTransactions(req: Request, res: Response) {
    try {
        const userId = String(req.params.userId);
        const date = req.body?.date;

        if (date !== undefined && !isValidDateString(date)) {
            return res.status(400).json({ error: "date must be YYYY-MM-DD" });
        }

        const result = await processRecurring(userId, date ?? serverToday());
        res.status(200).json(result);
    } catch (e: any) {
        console.error("Error processing recurring transactions:", e);
        res.status(500).json({ error: "Internal server error", details: e.message });
    }
}

export async function getRecurringTransactions(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const recurringTransactions = await sql`
            SELECT *, to_char(next_run_date, 'YYYY-MM-DD') AS next_date,
                   to_char(COALESCE(start_date, next_run_date), 'YYYY-MM-DD') AS start
            FROM recurring_transactions
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        res.status(200).json(recurringTransactions);
    } catch (e) {
        console.error("Error fetching recurring transactions:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createRecurringTransaction(req: Request, res: Response) {
    try {
        const { 
            user_id, 
            account_id, 
            category_id, 
            title, 
            amount, 
            type, 
            frequency, 
            next_run_date 
        } = req.body;

        if (!user_id || !account_id || !title || !amount || !type || !frequency) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        if (isNaN(amount) || Number(amount) <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }
        if (type !== "income" && type !== "expense") {
            return res.status(400).json({ error: "type must be income or expense" });
        }
        const freq = normalizeFrequency(frequency);
        if (!freq) {
            return res.status(400).json({ error: "frequency must be Weekly, Monthly or Yearly" });
        }
        if (next_run_date !== undefined && next_run_date !== null && !isValidDateString(next_run_date)) {
            return res.status(400).json({ error: "next_run_date must be YYYY-MM-DD" });
        }

        // Recurring expenses must be charged to one of the user's envelopes (income has none)
        if (type === "expense") {
            if (!category_id) {
                return res.status(400).json({ error: "An envelope is required for recurring expenses" });
            }
            const [envelope] = await sql`SELECT id FROM categories WHERE id = ${category_id} AND user_id = ${user_id}`;
            if (!envelope) {
                return res.status(400).json({ error: "Envelope not found for this user" });
            }
        }

        // The account must belong to this user; posted transactions will be written to it
        const [account] = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND user_id = ${user_id}`;
        if (!account) {
            return res.status(400).json({ error: "Account not found for this user" });
        }

        // First occurrence date (also the anchor day for monthly/yearly rules)
        const firstDate: string = next_run_date || serverToday();

        const recurringTransaction = await sql`
            INSERT INTO recurring_transactions 
            (user_id, account_id, category_id, title, amount, type, frequency, next_run_date, start_date)
            VALUES (
                ${user_id}, 
                ${account_id}, 
                ${type === "expense" ? category_id : null}, 
                ${title}, 
                ${amount}, 
                ${type}, 
                ${frequency}, 
                ${firstDate}::date,
                ${firstDate}::date
            )
            RETURNING *
        `;

        res.status(201).json(recurringTransaction[0]);
    } catch (e) {
        console.error("Error creating recurring transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateRecurringTransaction(req: Request, res: Response) {
    try {
        const id = String(req.params.id);
        const { user_id, is_active, title, amount, frequency, category_id, account_id, next_run_date, date } = req.body;

        if (date !== undefined && !isValidDateString(date)) {
            return res.status(400).json({ error: "date must be YYYY-MM-DD" });
        }
        if (next_run_date !== undefined && next_run_date !== null && !isValidDateString(next_run_date)) {
            return res.status(400).json({ error: "next_run_date must be YYYY-MM-DD" });
        }

        const [existing] = await sql`
            SELECT user_id, type, is_active, frequency,
                   to_char(next_run_date, 'YYYY-MM-DD') AS next_date,
                   to_char(COALESCE(start_date, next_run_date), 'YYYY-MM-DD') AS start
            FROM recurring_transactions WHERE id = ${id}
        `;
        if (!existing || (user_id && existing.user_id !== user_id)) {
            return res.status(404).json({ error: "Recurring transaction not found" });
        }

        if (title !== undefined && !String(title).trim()) {
            return res.status(400).json({ error: "Title cannot be empty" });
        }
        if (amount !== undefined && (isNaN(amount) || Number(amount) <= 0)) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }

        let newFrequency: string | null = null;
        if (frequency !== undefined) {
            const f = normalizeFrequency(frequency);
            if (!f) {
                return res.status(400).json({ error: "frequency must be Weekly, Monthly or Yearly" });
            }
            newFrequency = f.charAt(0).toUpperCase() + f.slice(1);
        }

        if (account_id !== undefined && account_id !== null) {
            const [account] = await sql`SELECT id FROM accounts WHERE id = ${account_id} AND user_id = ${existing.user_id}`;
            if (!account) {
                return res.status(400).json({ error: "Account not found for this user" });
            }
        }

        // Expenses always keep an envelope; income never has one
        let newCategory: string | null = null;
        if (existing.type === "expense") {
            if (category_id === null) {
                return res.status(400).json({ error: "An envelope is required for recurring expenses" });
            }
            if (category_id !== undefined) {
                const [envelope] = await sql`SELECT id FROM categories WHERE id = ${category_id} AND user_id = ${existing.user_id}`;
                if (!envelope) {
                    return res.status(400).json({ error: "Envelope not found for this user" });
                }
                newCategory = category_id;
            }
        }

        // Resuming a paused rule: skip the periods missed while paused instead of posting them all
        let resumeDate: string | null = null;
        const effectiveFrequency = normalizeFrequency(newFrequency ?? existing.frequency);
        if (is_active === true && !existing.is_active && effectiveFrequency) {
            resumeDate = firstOccurrenceOnOrAfter(existing.next_date, effectiveFrequency, existing.start || existing.next_date, date ?? serverToday());
        }

        // A new next date re-anchors the schedule (also becomes the day used for monthly/yearly repeats)
        const newNext: string | null = next_run_date ?? null;
        const effectiveNext = newNext ?? resumeDate;

        const [updated] = await sql`
            UPDATE recurring_transactions
            SET
                is_active = COALESCE(${is_active ?? null}, is_active),
                title = COALESCE(${title !== undefined ? String(title).trim() : null}, title),
                amount = COALESCE(${amount ?? null}, amount),
                frequency = COALESCE(${newFrequency}, frequency),
                category_id = COALESCE(${newCategory}, category_id),
                account_id = COALESCE(${account_id ?? null}, account_id),
                next_run_date = COALESCE(${effectiveNext}::date, next_run_date),
                start_date = COALESCE(${newNext}::date, start_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING *,
                to_char(next_run_date, 'YYYY-MM-DD') AS next_date,
                to_char(COALESCE(start_date, next_run_date), 'YYYY-MM-DD') AS start
        `;

        res.status(200).json(updated);
    } catch (e) {
        console.error("Error updating recurring transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteRecurringTransaction(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const result = await sql`
            DELETE FROM recurring_transactions
            WHERE id = ${id} 
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "Recurring transaction not found!" });
        }

        res.status(200).json({ message: "Recurring transaction deleted successfully" });
    } catch (e) {
        console.error("Error deleting recurring transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}