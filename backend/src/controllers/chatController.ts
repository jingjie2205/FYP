import { sql } from "../config/db.js"
import { Request, Response } from "express";

export async function getSession(req: Request, res: Response) {
    try {
        const { userId } = req.params

        const chat_session = await sql`
            SELECT * FROM chat_session
            WHERE user_id = ${ userId }
            ORDER BY created_at DESC
        `

        res.status(200).json(chat_session)
    } catch (e) {
        console.error("Error fetching chat sesion:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createChatMessage (req: Request, res: Response) {
    
}