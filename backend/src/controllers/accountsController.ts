import { sql } from "../config/db.js"
import express, { Request, Response } from "express";
import { createAccountWithBalance } from "../services/accountService.js"

export async function getAccounts(req : Request, res : Response){
    try {
        const { userId } = req.params

        const accounts = await sql`
            SELECT 
                a.id,
                a.user_id,
                a.name,
                a.type,
                a.created_at,

                COALESCE(SUM(
                    CASE
                        WHEN t.type = 'income' THEN t.amount
                        WHEN t.type = 'expense' THEN -t.amount
                    END
                ), 0) AS balance
                FROM accounts a

                LEFT JOIN transactions t
                ON t.account_id = a.id

                WHERE a.user_id = $(userId)
                GROUP BY a.id
                ORDER BY a.created_at DESC
        `

        res.status(200).json(accounts)
    } catch (e) {
        console.error("Error fetching accounts:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createAccount (req : Request, res : Response) {
    try {
    const { user_id, name, balance } = req.body
    console.log("EXPRESS RECEIVED THIS BODY:", req.body);

    if (!user_id || !name) {
      return res.status(400).json({ error: "Missing required fields - accounts" })
    }

    const account = await createAccountWithBalance(user_id, name, Number(balance))

    res.status(201).json(account)
  } catch (e) {
    console.error("Error creating account:", e)
    res.status(500).json({ error: "Internal server error" })
  }
}
