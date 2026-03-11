import { sql } from "../config/db.js"
import express, { Request, Response } from "express";

export async function getTransactionsByUserId(req : Request, res : Response) {
    try {
        const { userId } = req.params

        const transactions = await sql`
            SELECT * FROM transactions 
            WHERE user_id = ${ userId } 
            ORDER BY created_at DESC
        `

        res.status(200).json(transactions)
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createTransaction (req : Request, res : Response) {
    try {
        const { title, amount, category, user_id } = req.body;

        if (!title || !amount || category === undefined || !user_id) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const transaction = await sql`
            INSERT INTO transactions (user_id, title, amount, category)
            VALUES (${user_id}, ${title}, ${amount}, ${category})
            RETURNING *
        `;

        console.log(transaction);
        res.status(201).json(transaction[0]);
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function deleteTransaction (req : Request, res : Response) {
    try {
        const { id } = req.params

        // Validate id before hitting sql query
        if (isNaN(parseInt(id as string))) {
            return res.status(400).json({ message:"Invalid transaction ID" })
        }

        const result = await sql`
            DELETE FROM transactions
            WHERE id = ${ id } RETURNING *
        `

        if (result.length === 0) {
            return res.status(404).json({ message:"Transaction not found!" })
        }

        res.status(200).json({ message:"Transactions deleted successfully" })
    } catch (e) {
        console.error("Error creating transaction:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getSummary (req : Request, res : Response) {
    try {
        const { userId } = req.params

        const balanceResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = ${ userId }
        `

        const incomeResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as income FROM transactions
        `

        const expensesResult = await sql `
            SELECT COALESCE(SUM(amount), 0) as expenses FROM transactions 
            WHERE user_id = ${ userId } AND amount < 0
        `

        res.status(200).json({
            balance: balanceResult[0].balance,
            income: incomeResult[0].income,
            expenses: expensesResult[0].expenses,
        })
    } catch (e) {
        console.error("Error getting summary:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}