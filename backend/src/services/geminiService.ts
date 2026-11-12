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
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  availableBudgets: BudgetEnvelopeContext[] = []
): Promise<ChatResponsePayload> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is missing on server");
  }

  const budgetContextStr =
    availableBudgets.length > 0
      ? `User's current budget envelopes and balances: ${JSON.stringify(availableBudgets)}`
      : `No budget envelopes available.`;

  const systemInstruction = `You are Finley, an AI personal finance and zero-based budgeting assistant. 
Your goal is to help users manage their money, review spending, or answer general finance questions.
${budgetContextStr}

Instructions:
1. If the user asks a general finance question or normal conversational query, set "actionType" to "none", leave "transferDetails" empty, and reply naturally in "replyText".
2. If the user wants to move, transfer, or reallocate money from one envelope/category to another:
   - Set "actionType" to "reallocation".
   - Extract or deduce the source envelope, destination envelope, and numeric amount into "transferDetails".
   - Write a conversational summary in "replyText" indicating that you've prepared the transfer for review.`;

  const contents = [
    {
      role: "user",
      parts: [{ text: systemInstruction }],
    },
    ...conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents,
    config: {
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
  });

  return JSON.parse(response.text || "{}") as ChatResponsePayload;
}