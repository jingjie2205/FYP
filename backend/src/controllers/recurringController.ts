import { Request, Response } from "express";
import { sql } from "../config/db.js";

export async function getRecurringTransactions(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const recurringTransactions = await sql`
            SELECT * FROM recurring_transactions
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

        const recurringTransaction = await sql`
            INSERT INTO recurring_transactions 
            (user_id, account_id, category_id, title, amount, type, frequency, next_run_date)
            VALUES (
                ${user_id}, 
                ${account_id}, 
                ${category_id || null}, 
                ${title}, 
                ${amount}, 
                ${type}, 
                ${frequency}, 
                ${next_run_date || new Date()}
            )
            RETURNING *
        `;

        console.log(recurringTransaction);
        res.status(201).json(recurringTransaction[0]);
    } catch (e) {
        console.error("Error creating recurring transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateRecurringTransaction(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { is_active, title, amount, frequency, category_id, account_id } = req.body;

        const result = await sql`
            UPDATE recurring_transactions 
            SET 
                is_active = COALESCE(${is_active}, is_active),
                title = COALESCE(${title}, title),
                amount = COALESCE(${amount}, amount),
                frequency = COALESCE(${frequency}, frequency),
                category_id = COALESCE(${category_id}, category_id),
                account_id = COALESCE(${account_id}, account_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id} 
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "Recurring transaction not found!" });
        }

        res.status(200).json(result[0]);
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