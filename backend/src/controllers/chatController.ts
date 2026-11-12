import { sql } from "../config/db.js"
import { Request, Response } from "express";

export async function getSessions(req: Request, res: Response) {
    try {
        const { userId } = req.params;

        const sessions = await sql`
            SELECT * FROM chat_sessions 
            WHERE user_id = ${userId} 
            ORDER BY updated_at DESC
        `;

        res.status(200).json(sessions);
    } catch (e) {
        console.error("Error fetching chat sessions:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function createSession(req: Request, res: Response) {
    try {
        const { user_id, session_name } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: "Missing required field - user_id" });
        }

        const name = session_name || "New Conversation";

        const session = await sql`
            INSERT INTO chat_sessions (user_id, session_name)
            VALUES (${user_id}, ${name})
            RETURNING *
        `;

        res.status(201).json(session[0]);
    } catch (e) {
        console.error("Error creating chat session:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function getMessages(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;

        const messages = await sql`
            SELECT * FROM chat_messages 
            WHERE session_id = ${sessionId} 
            ORDER BY created_at ASC
        `;

        res.status(200).json(messages);
    } catch (e) {
        console.error("Error fetching chat messages:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function sendMessage(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        const { role, content, metadata } = req.body; // role: 'user' or 'assistant'

        if (!sessionId || !role || !content) {
            return res.status(400).json({ error: "Missing required fields - sessionId, role, content" });
        }

        const metadataJson = metadata ? JSON.stringify(metadata) : '{}';

        // Insert message (PostgreSQL handles created_at natively)
        const message = await sql`
            INSERT INTO chat_messages (session_id, role, content, metadata)
            VALUES (${sessionId}, ${role}, ${content}, ${metadataJson}::jsonb)
            RETURNING *
        `;

        res.status(201).json(message[0]);
    } catch (e) {
        console.error("Error sending message:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}