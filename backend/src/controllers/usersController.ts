import { sql } from "../config/db.js"
import express, { Request, Response } from "express";

export async function createUser(req : Request, res : Response) {
    try {
        const { user_id, email } = req.body;

        if (!user_id || !email) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const user = await sql`
            INSERT INTO users (id, email)
            VALUES (${user_id}, ${email})
            RETURNING *
        `;

        console.log(user);
        res.status(201).json(user[0]);
    } catch (e) {
        console.error("Error creating user:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}