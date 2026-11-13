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
    // 1. Extract exact category names from the user's database records
    const validCategoryNames: string[] = (context.categories || [])
      .map((c: any) => c.name)
      .filter(Boolean);

    // 2. Constrain Gemini's schema to only pick from valid user categories
    const categoryFieldSchema =
      validCategoryNames.length > 0
        ? { type: Type.STRING, enum: validCategoryNames }
        : { type: Type.STRING };

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

CRITICAL REALLOCATION RULES:
1. If the user wants to reallocate, move, or transfer funds between budget categories (e.g., "transfer $20 from food to transport"), set "actionType" to "reallocation".
2. Map the user's casual/shorthand terms to the closest matching category name from this exact list: ${JSON.stringify(validCategoryNames)}.
3. You MUST set "sourceCategory" and "destCategory" in "transferDetails" to the EXACT string from that list (including any ampersands, symbols, or emojis).
4. In "replyText", write a brief, natural confirmation message (e.g., "I've prepared the transfer of $20.00 from Dining & Food Delivery to Public Commute for you."). NEVER include raw JSON or markdown code blocks inside "replyText".
5. If the user's request is not a transfer or is too ambiguous to match any existing category, set "actionType" to "none" and reply conversationally in "replyText".
    `.trim();

    // Format history for Gemini SDK
    const formattedHistory = history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    }));

    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // Lower temperature for more deterministic category mapping
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { type: Type.STRING },
            actionType: { type: Type.STRING, enum: ["none", "reallocation"] },
            transferDetails: {
              type: Type.OBJECT,
              properties: {
                sourceCategory: categoryFieldSchema,
                destCategory: categoryFieldSchema,
                amount: { type: Type.NUMBER },
              },
              required: ["sourceCategory", "destCategory", "amount"],
            },
          },
          required: ["replyText", "actionType"],
        },
      },
      history: formattedHistory.slice(0, -1),
    });

    const result = await chat.sendMessage({ message: userQuery });
    const rawText = result.text || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {
        replyText:
          rawText.replace(/```json[\s\S]*?```/g, "").trim() ||
          "I'm here to help with your budget!",
        actionType: "none",
      };
    }

    let replyText = parsed.replyText || "I've processed your budget query.";
    replyText = replyText.replace(/```json[\s\S]*?```/g, "").trim();

    const isReallocation =
      parsed.actionType === "reallocation" &&
      parsed.transferDetails?.sourceCategory &&
      parsed.transferDetails?.destCategory &&
      Number(parsed.transferDetails?.amount) > 0;

    return {
      replyText,
      actionType: isReallocation ? "reallocation" : "none",
      transferDetails: isReallocation
        ? {
            sourceCategory: parsed.transferDetails.sourceCategory,
            destCategory: parsed.transferDetails.destCategory,
            amount: Number(parsed.transferDetails.amount),
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error in geminiService:", error);
    return {
      replyText: "Sorry, I encountered an error analyzing your financial data.",
      actionType: "none",
    };
  }
}