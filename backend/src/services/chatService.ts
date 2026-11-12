import { sql } from '../config/db';

export const chatService = {
  // Get all chat sessions for a specific user
  async getSessionsByUser(userId: string) {
    const result = await sql`
      SELECT * FROM chat_sessions 
      WHERE user_id = ${userId} 
      ORDER BY updated_at DESC;
    `;
    return result; 
  },

  // Create a new chat session
  async createSession(userId: string, sessionName: string) {
    const name = sessionName || 'New Conversation';
    const result = await sql`
      INSERT INTO chat_sessions (user_id, session_name)
      VALUES (${userId}, ${name})
      RETURNING *;
    `;
    return result[0]; 
  },

  // Get all messages for a specific session
  async getMessagesBySession(sessionId: string) {
    const result = await sql`
      SELECT * FROM chat_messages 
      WHERE session_id = ${sessionId} 
      ORDER BY created_at ASC;
    `;
    return result;
  },

  // Save a message (user or assistant)
  async saveMessage(sessionId: string, role: string, content: string, metadata: object = {}) {
    const metadataString = JSON.stringify(metadata);

    const result = await sql`
      INSERT INTO chat_messages (session_id, role, content, metadata)
      VALUES (${sessionId}, ${role}, ${content}, ${metadataString}::jsonb)
      RETURNING *;
    `;
    
    await sql`
      UPDATE chat_sessions 
      SET updated_at = DEFAULT 
      WHERE id = ${sessionId};
    `;

    return result[0];
  }
};