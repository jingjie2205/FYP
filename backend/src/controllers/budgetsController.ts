import { sql } from "../config/db.js"
import express, { Request, Response } from "express";

export async function getBudgets(req : Request, res : Response) {
    try {
        const { userId } = req.params

        const budgets = await sql`
            SELECT * FROM budgets
            WHERE user_id = ${ userId }
            ORDER BY created_at DESC
        `

        res.status(200).json(budgets)
    } catch (e) {
        console.error("Error fetching budgets:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createBudget (req : Request, res : Response) {
    try {
        const { user_id, category_id, name, amount, period, start_date } = req.body;

        if (!user_id || !category_id || !name || amount === undefined || !period) {
            return res.status(400).json({
                error: "Missing required fields",
            });
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                error: "Amount must be a positive number",
            });
        }

        const budget = await sql`
            INSERT INTO budgets (user_id, category_id, name, amount, period, start_date)
            VALUES (${user_id}, ${category_id}, ${name}, ${amount}, ${period}, ${start_date})
            RETURNING *
        `;

        console.log(budget);
        res.status(201).json(budget[0]);
    } catch (e) {
        console.error("Error creating budget:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteBudget(req : Request, res : Response) {
    try {
        const { id } = req.params

        const result = await sql`
            DELETE FROM budgets
            WHERE id = ${ id } RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ message:"Budget not found!" })
        }

        res.status(200).json({ message:"Budget deleted successfully" })
    } catch (e) {
        console.error("Error deleting budget:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function updateBudget(req : Request, res : Response){
    try {
        const { id } = req.params
        const { name, amount, period, start_date, category_id } = req.body

        // Validate ID
        if (!id) {
            return res.status(400).json({ error: "Budget ID is required" })
        }

        // Validate amount if provided
        if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
            return res.status(400).json({
                error: "Amount must be a positive number",
            })
        }

        const result = await sql`
            UPDATE budgets
            SET 
                name = COALESCE(${name}, name),
                amount = COALESCE(${amount}, amount),
                period = COALESCE(${period}, period),
                start_date = COALESCE(${start_date}, start_date),
                category_id = COALESCE(${category_id}, category_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
            RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ error: "Budget not found" })
        }

        res.status(200).json(result[0])
    } catch (e) {
        console.error("Error updating budget:", e)
        res.status(500).json({ error: "Internal server error" })
    }
}