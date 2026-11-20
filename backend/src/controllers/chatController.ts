import { sql } from "../config/db.js";
import { Request, Response } from "express";
import { needsFinancialContext, processChatQueryWithGemini } from "../services/geminiService.js";
import { buildChatContext } from "../services/chatContextService.js";
import { buildDemoFallback, DEMO_FALLBACK_TIMEOUT_MS, isDemoPrompt, isFailureReply } from "../services/demoFallback.js";

// jsonb normally arrives parsed, but a string-encoded value would silently hide action cards in the app
function withParsedMetadata(row: any) {
    if (!row) return row;
    let metadata = row.metadata;
    if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }
    return { ...row, metadata: metadata ?? {} };
}

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
        res.status(200).json(messages.map(withParsedMetadata));
    } catch (e) {
        console.error("Error fetching chat messages:", e);
        res.status(500).json({ error: "Internal server error" });
    }
}

export async function sendMessage(req: Request, res: Response) {
    try {
        const { sessionId } = req.params;
        const { role, content, metadata, today } = req.body;

        if (!sessionId || !role || !content) {
            return res.status(400).json({ error: "Missing required fields - sessionId, role, content" });
        }

        // Save the incoming message
        const metadataJson = metadata ? JSON.stringify(metadata) : '{}';
        await sql`
            INSERT INTO chat_messages (session_id, role, content, metadata)
            VALUES (${sessionId}, ${role}, ${content}, ${metadataJson}::jsonb)
        `;

        // If user message, build a READ-ONLY snapshot of the user's finances and ask Gemini
        if (role === 'user') {
            const sessionRows = await sql`SELECT user_id FROM chat_sessions WHERE id = ${sessionId}`;
            const userId = sessionRows[0]?.user_id;
            if (!userId) {
                return res.status(404).json({ error: "Chat session not found" });
            }

            // Fetch session message history for conversation memory
            const historyRows = await sql`
                SELECT role, content FROM chat_messages 
                WHERE session_id = ${sessionId} 
                ORDER BY created_at ASC
            `;

            const history = historyRows.map(r => ({ role: r.role, content: r.content }));

            // Only load the financial snapshot when the conversation is actually about money
            const context = needsFinancialContext(content, history)
                ? await buildChatContext(userId, today)
                : null;

            const gemini = processChatQueryWithGemini(content, history, context, today);
            let aiResult;

            // Demo safety net : rehearsed prompts get a local answer if Gemini is slow or failing
            if (isDemoPrompt(content)) {
                const timedOut = Symbol("timeout");
                const first = await Promise.race([
                    gemini,
                    new Promise<typeof timedOut>((resolve) => setTimeout(() => resolve(timedOut), DEMO_FALLBACK_TIMEOUT_MS)),
                ]);
                aiResult = first === timedOut ? null : first;
                if (aiResult === null || isFailureReply(aiResult)) {
                    const demoContext = context ?? (await buildChatContext(userId, today));
                    const fallback = buildDemoFallback(content, demoContext);
                    if (fallback) {
                        console.warn("[chat] demo fallback used for prompt:", content);
                        aiResult = fallback;
                    } else if (aiResult === null) {
                        aiResult = await gemini;
                    }
                }
            } else {
                aiResult = await gemini;
            }

            // Save assistant reply (metadata already validated against the user's real rows)
            const aiMessageRows = await sql`
                INSERT INTO chat_messages (session_id, role, content, metadata)
                VALUES (${sessionId}, 'assistant', ${aiResult.replyText}, ${JSON.stringify(aiResult.metadata)}::jsonb)
                RETURNING *
            `;

            return res.status(201).json(withParsedMetadata(aiMessageRows[0]));
        }

        const lastMsg = await sql`
            SELECT * FROM chat_messages 
            WHERE session_id = ${sessionId} 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        res.status(201).json(withParsedMetadata(lastMsg[0]));
    } catch (e: any) {
        console.error("Error sending message:", e);
        res.status(500).json({ error: "Internal server error", details: e.message });
    }
}