import { sql } from "../config/db.js";
import { Request, Response } from "express";
import { processChatQueryWithGemini } from "../services/geminiService.js";
import { getUserFinancialData } from "../services/accountService.js"; // Importing the service function

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

        // If user message, fetch context via accountService and trigger Gemini AI
        if (role === 'user') {
            const sessionRows = await sql`SELECT user_id FROM chat_sessions WHERE id = ${sessionId}`;
            const userId = sessionRows[0]?.user_id;

            let comprehensiveBudgetContext: any = {
                accounts: [],
                savingsPlans: [],
                categories: [],
                categoryGroups: [],
                recurringTransactions: [],
                recentTransactions: []
            };

            if (userId && typeof getUserFinancialData === 'function') {
                // Fetch comprehensive user financial context using the service
                comprehensiveBudgetContext = await getUserFinancialData(userId);
            } else if (userId) {
                // Fallback concurrent query set if service signature differs slightly
                const [
                    accounts,
                    savingsPlans,
                    categories,
                    categoryGroups,
                    recurringTransactions,
                    recentTransactions
                ] = await Promise.all([
                    sql`SELECT * FROM accounts WHERE user_id = ${userId} ORDER BY created_at DESC`,
                    sql`SELECT name, saved_amount as "currentAmount", target_amount as "targetAmount" FROM savings_plans WHERE user_id = ${userId}`,
                    sql`SELECT name, budget_limit, spent_amount FROM categories WHERE user_id = ${userId}`,
                    sql`SELECT name FROM category_groups WHERE user_id = ${userId}`,
                    sql`SELECT rt.title, rt.amount, rt.frequency, c.name as category FROM recurring_transactions rt LEFT JOIN categories c ON rt.category_id = c.id WHERE rt.user_id = ${userId}`,
                    sql`SELECT t.title, t.amount, t.date, c.name as category FROM transactions t LEFT JOIN categories c ON t.category_id = c.id WHERE t.user_id = ${userId} ORDER BY t.date DESC LIMIT 15`
                ]);

                comprehensiveBudgetContext = {
                    accounts,
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

            // Call Gemini service
            const aiResult = await processChatQueryWithGemini(
                content,
                historyRows.map(r => ({ role: r.role, content: r.content })),
                comprehensiveBudgetContext
            );

            const aiMetadata = aiResult.actionType === 'reallocation' 
                ? { actionType: 'reallocation', transferDetails: aiResult.transferDetails }
                : { actionType: 'none' };

            // Save assistant reply
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