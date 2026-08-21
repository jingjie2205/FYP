import { sql } from "../config/db.js"
import { Request, Response } from "express";
import { createAccountWithBalance } from "../services/accountService.js"

export async function getAccounts(req : Request, res : Response){
    try {
        const { userId } = req.params

        const accounts = await sql`
            SELECT 
                id,
                user_id,
                name,
                type,
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

// Update Account 
export async function updateAccount(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, type, balance } = req.body;

        if (!id) {
            return res.status(400).json({ error: "Account ID is required" });
        }

        const [updatedAccount] = await sql`
            UPDATE accounts
            SET 
                name = COALESCE(${name}, name),
                type = COALESCE(${type}, type),
                balance = COALESCE(${balance}, balance)
            WHERE id = ${id}
            RETURNING *;
        `;

        if (!updatedAccount) {
            return res.status(404).json({ error: "Account not found" });
        }

        res.status(200).json(updatedAccount);
    } catch (e) {
        console.error("Error updating account:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

// Delete Account
export async function deleteAccount(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { userId } = req.body; // Passed from frontend to ensure ownership

        if (!id || !userId) {
            return res.status(400).json({ error: "Account ID and User ID are required" });
        }

        const result = await sql`
            DELETE FROM accounts
            WHERE id = ${id} AND user_id = ${userId}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({ message: "Account not found or unauthorized!" });
        }

        res.status(200).json({ message: "Account deleted successfully" });
    } catch (e) {
        console.error("Error deleting account:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}