import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface ReceiptItem {
  name: string;
  price: number;
  category?: string;
}

export interface ParsedReceipt {
  title: string;
  amount: number;
  date: string;
  suggestedCategory: string;
  items: ReceiptItem[];
}

export interface BudgetEnvelopeContext {
  name: string;
  currentAmount: number;
  targetAmount: number;
}

export interface ChatResponsePayload {
  replyText: string;
  actionType: "none" | "reallocation";
  transferDetails?: {
    sourceCategory: string;
    destCategory: string;
    amount: number;
  };
}

export async function parseReceiptWithGemini(
  base64Image: string,
  availableCategories: string[] = [],
  mimeType: string = "image/jpeg"
): Promise<ParsedReceipt> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is missing on server");
  }

  const categoryContext =
    availableCategories.length > 0
      ? `You MUST choose "suggestedCategory" strictly from this user budget envelope list: [${availableCategories.join(
          ", "
        )}]. If none fit cleanly, pick the closest match from that list.`
      : `Suggest a sensible budget envelope category as "suggestedCategory".`;

  const promptText = `Extract receipt details from this image:
- "title": Merchant or business name
- "amount": Grand total paid as a number
- "date": Date of purchase formatted as YYYY-MM-DD (if missing, use today's date)
- "suggestedCategory": 
${categoryContext}
- "items": Array of line items with "name" (string) and "price" (number).
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: promptText },
          {
            inlineData: {
              data: base64Image,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          date: { type: Type.STRING },
          suggestedCategory: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER },
              },
              required: ["name", "price"],
            },
          },
        },
        required: ["title", "amount", "suggestedCategory", "items"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as ParsedReceipt;
}

export async function processChatQueryWithGemini(
    userQuery: string,
    history: Array<{ role: string; content: string }>,
    context: {
        accounts?: any[];
        categoryGroups?: any[];
        categories?: any[];
        savingsPlans?: any[];
        recurringTransactions?: any[];
        recentTransactions?: any[];
    }
): Promise<ChatResponsePayload> {
    try {
        const contextString = `
Here is the user's current financial data from their budgeting app:
- Accounts: 
${JSON.stringify(context.accounts || [])}
- Category Groups: 
${JSON.stringify(context.categoryGroups || [])}
- Categories / Envelopes: 
${JSON.stringify(context.categories || [])}
- Savings Plans: 
${JSON.stringify(context.savingsPlans || [])}
- Recurring Transactions: 
${JSON.stringify(context.recurringTransactions || [])}
- Recent Transactions: 
${JSON.stringify(context.recentTransactions || [])}
        `.trim();

        const systemInstruction = `
You are Finley, a helpful, intelligent personal AI financial assistant for a zero-based budgeting application.
You have direct access to the user's financial data provided below. Use this data to answer their questions accurately.

${contextString}

If the user wants to reallocate or transfer funds between budget categories or savings envelopes, set actionType to 'reallocation' and provide 'transferDetails' containing sourceCategory, destCategory, and amount. Otherwise, set actionType to 'none'.
You must respond strictly in JSON format matching the requested schema with "replyText", "actionType", and optional "transferDetails".
        `;

        // Format history for Gemini SDK
        const formattedHistory = history.map(h => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }]
        }));

        const chat = ai.chats.create({
            model: 'gemini-3.6-flash',
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        replyText: { type: Type.STRING },
                        actionType: { type: Type.STRING, enum: ["none", "reallocation"] },
                        transferDetails: {
                            type: Type.OBJECT,
                            properties: {
                                sourceCategory: { type: Type.STRING },
                                destCategory: { type: Type.STRING },
                                amount: { type: Type.NUMBER }
                            },
                            required: ["sourceCategory", "destCategory", "amount"]
                        }
                    },
                    required: ["replyText", "actionType"]
                }
            },
            history: formattedHistory.slice(0, -1) 
        });

        const result = await chat.sendMessage({ message: userQuery });
        const rawText = result.text || "{}";

        let parsed: any = {};
        try {
            parsed = JSON.parse(rawText);
        } catch {
            parsed = {
                replyText: rawText.replace(/```json[\s\S]*?```/g, '').trim() || "I'm here to help with your budget!",
                actionType: "none"
            };
        }

        let replyText = parsed.replyText || "I've processed your budget query.";
        replyText = replyText.replace(/```json[\s\S]*?```/g, '').trim();

        return {
            replyText,
            actionType: parsed.actionType === "reallocation" ? "reallocation" : "none",
            transferDetails: parsed.actionType === "reallocation" ? parsed.transferDetails : undefined
        };
    } catch (error) {
        console.error("Error in geminiService:", error);
        return {
            replyText: "Sorry, I encountered an error analyzing your financial data.",
            actionType: 'none',
        };
    }
}