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
- "suggestedCategory": ${categoryContext}
- "items": Array of line items with "name" (string) and "price" (number).`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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