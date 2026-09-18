import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  mimeType: string = "image/jpeg"
): Promise<ParsedReceipt> {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Extract receipt details: merchant name as 'title', total as 'amount', date as 'date' (YYYY-MM-DD), envelope category as 'suggestedCategory', and line items into 'items' (with name, price, category).",
          },
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
                category: { type: Type.STRING },
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