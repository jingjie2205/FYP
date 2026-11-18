import { sql } from "../config/db.js"
import { Request, Response } from "express";

export async function createUser(req : Request, res : Response) {
    try {
        const { user_id, email } = req.body;

        if (!user_id || !email) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const user = await sql`
            INSERT INTO users (id, email)
            VALUES (${user_id}, ${email})
            ON CONFLICT (id) DO UPDATE 
            SET email = EXCLUDED.email
            RETURNING *
        `;

        console.log(user);
        res.status(201).json(user[0]);
    } catch (e: any) {
        // users.email is UNIQUE: happens when the same email was used by an older (e.g. deleted) Clerk user
        if (e?.code === "23505") {
            console.error("Error creating user - email already linked to another user id:", e.detail);
            return res.status(409).json({
                error: "This email is already linked to another account in the database",
                details: e.detail,
            });
        }
        console.error("Error creating user:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}