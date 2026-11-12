import { sql } from "../config/db.js";
import { Request, Response } from "express";
import { processChatQueryWithGemini } from "../services/geminiService.js";

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

export async function deleteSession(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required" });
        }
        const result = await sql`
            DELETE FROM chat_sessions 
            WHERE id = ${sessionId} 
            RETURNING *
        `;
        if (result.length === 0) {
            return res.status(404).json({ error: "Chat session not found" });
        }
        res.status(200).json({ message: "Chat session and messages deleted successfully" });
    } catch (e) {
        console.error("Error deleting chat session:", e);
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
        const { role, content, metadata } = req.body;

        if (!sessionId || !role || !content) {
            return res.status(400).json({ error: "Missing required fields - sessionId, role, content" });
        }

        // Save the incoming message
        const metadataJson = metadata ? JSON.stringify(metadata) : '{}';
        await sql`
            INSERT INTO chat_messages (session_id, role, content, metadata)
            VALUES (${sessionId}, ${role}, ${content}, ${metadataJson}::jsonb)
        `;

        // If user message, fetch context and trigger Gemini AI
        if (role === 'user') {
            const sessionRows = await sql`SELECT user_id FROM chat_sessions WHERE id = ${sessionId}`;
            const userId = sessionRows[0]?.user_id;

            let comprehensiveBudgetContext: any = {
                savingsPlans: [],
                categories: [],
                categoryGroups: [],
                recurringTransactions: [],
                recentTransactions: []
            };

            if (userId) {
                // Fetch all relevant financial contexts concurrently
                const [
                    savingsPlans,
                    categories,
                    categoryGroups,
                    recurringTransactions,
                    recentTransactions
                ] = await Promise.all([
                    sql`SELECT name, saved_amount as "currentAmount", target_amount as "targetAmount" FROM savings_plans WHERE user_id = ${userId}`,
                    sql`SELECT name, budget_limit, spent_amount FROM categories WHERE user_id = ${userId}`,
                    sql`SELECT name FROM category_groups WHERE user_id = ${userId}`,
                    sql`SELECT title, amount, frequency, category FROM recurring_transactions WHERE user_id = ${userId}`,
                    sql`SELECT title, amount, date, category FROM transactions WHERE user_id = ${userId} ORDER BY date DESC LIMIT 15`
                ]);

                comprehensiveBudgetContext = {
                    savingsPlans,
                    categories,
                    categoryGroups,
                    recurringTransactions,
                    recentTransactions
                };
            }

            // Fetch session message history for conversation memory
            const historyRows = await sql`
                SELECT role, content FROM chat_messages 
                WHERE session_id = ${sessionId} 
                ORDER BY created_at ASC
            `;

            // Call Gemini service with full contextual payload
            const aiResult = await processChatQueryWithGemini(
                content,
                historyRows.map(r => ({ role: r.role, content: r.content })),
                comprehensiveBudgetContext
            );

            const aiMetadata = aiResult.actionType === 'reallocation' 
                ? { actionType: 'reallocation', transferDetails: aiResult.transferDetails }
                : { actionType: 'none' };

            // Save assistant reply to DB
            const aiMessageRows = await sql`
                INSERT INTO chat_messages (session_id, role, content, metadata)
                VALUES (${sessionId}, 'assistant', ${aiResult.replyText}, ${JSON.stringify(aiMetadata)}::jsonb)
                RETURNING *
            `;

            return res.status(201).json(aiMessageRows[0]);
        }

        const lastMsg = await sql`
            SELECT * FROM chat_messages 
            WHERE session_id = ${sessionId} 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        res.status(201).json(lastMsg[0]);
    } catch (e: any) {
        console.error("Error sending message:", e);
        res.status(500).json({ error: "Internal server error", details: e.message });
    }
}