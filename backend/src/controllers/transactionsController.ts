import { sql } from "../config/db.js"
import express, { Request, Response } from "express";
import { createTransactionRecord } from "../services/transactionService.js"

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
        const {
            user_id,
            account_id,
            category_id,
            title,
            amount,
            type,
            notes,
            transaction_date
        } = req.body

        // Validate required fields
        if (!user_id || !account_id || !title || amount === undefined || !type || !transaction_date) {
            return res.status(400).json({
                error: "Missing required fields"
            })
        }

        // Validate amount
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                error: "Amount must be a positive number"
            })
        }

        const transaction = await createTransactionRecord({
            user_id,
            account_id,
            category_id,
            title,
            amount,
            type,
            notes,
            transaction_date: new Date(transaction_date)
        })

        res.status(201).json(transaction)

  } catch (e) {
    console.error("Error creating transaction:", e)
    res.status(500).json({
      error: "Internal server error - Transactions"
    })
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