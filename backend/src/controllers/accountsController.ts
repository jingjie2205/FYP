import { sql } from "../config/db.js"
import express, { Request, Response } from "express";
import { createAccountWithBalance } from "../services/accountService.js"

export async function getAccounts(req : Request, res : Response){
    try {
        const { userId } = req.params

        // Ultra-fast query: Just grab the rows directly since the balance is already accurate
        const accounts = await sql`
            SELECT 
                id,
                user_id,
                name,
                balance,
                is_default,
                created_at
            FROM accounts
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
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