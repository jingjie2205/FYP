import { sql } from "../config/db.ts"
import express, { Request, Response } from "express";

export async function createUser(req : Request, res : Response) {
    try {
        const { user_id, email } = req.body;

        if (!user_id || !email) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await sql`
            WITH new_user AS (
                INSERT INTO users (id, email)
                VALUES (${user_id}, ${email})
                ON CONFLICT (id) DO NOTHING
                RETURNING *
            ),
            new_account AS (
                INSERT INTO accounts (user_id, name, type, balance, is_default)
                SELECT id, 'Cash Wallet', 'cash', 0.00, TRUE
                FROM new_user
            )
            SELECT * FROM new_user;
        `;

        console.log(user);
        res.status(201).json(user[0]);
    } catch (e) {
        console.error("Error creating user:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}