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
    const slimCategories = (context.categories || []).map((c: any) => ({
      name: c.name,
      allocatedBudget: Number(c.target_amount ?? 0),
    }));

    const validCategoryNames: string[] = slimCategories
      .map((c) => c.name)
      .filter(Boolean);

    const slimSavings = (context.savingsPlans || []).map((s: any) => ({
      name: s.name,
      savedAmount: Number(s.saved_amount ?? 0),
      targetAmount: Number(s.target_amount ?? 0),
    }));

    const slimRecentTx = (context.recentTransactions || [])
      .slice(0, 15)
      .map((t: any) => ({
        title: t.title || t.merchant || t.description,
        amount: Number(t.amount ?? 0),
        category: t.category_name || t.category,
        date: t.date || t.created_at,
      }));

    const systemInstruction = `
You are Finley, a helpful, intelligent personal AI financial assistant for a zero-based budgeting application.
You have direct access to the user's financial data below:

- Budget Categories (Total Allocated Budgets): ${JSON.stringify(slimCategories)}
- Savings Plans: ${JSON.stringify(slimSavings)}
- Recent Transactions (last 15): ${JSON.stringify(slimRecentTx)}

CRITICAL REALLOCATION RULES:
1. If the user wants to reallocate, move, or transfer funds between budget categories (e.g., "transfer $20 from food to transport"), set "actionType" to "reallocation".
2. Map the user's casual/shorthand terms to the closest matching category from this exact list: ${JSON.stringify(validCategoryNames)}.
3. You MUST set "sourceCategory" and "destCategory" in "transferDetails" to the EXACT string from that list.
4. In "replyText", write a brief, natural confirmation message. NEVER include raw JSON or markdown code blocks inside "replyText".
5. If the user's request is a general question and not a budget transfer, set "actionType" to "none" and reply conversationally in "replyText".
    `.trim();

    const formattedHistory = history.slice(-11, -1).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content || "" }],
    }));

    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
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
                amount: { type: Type.NUMBER },
              },
              required: ["sourceCategory", "destCategory", "amount"],
            },
          },
          required: ["replyText", "actionType"],
        },
      },
      history: formattedHistory,
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

    const replyText = (parsed.replyText || "I've processed your budget query.")
      .replace(/```json[\s\S]*?```/g, "")
      .trim();

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
            sourceCategory: parsed.transferDetails.sourceCategory.trim(),
            destCategory: parsed.transferDetails.destCategory.trim(),
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