import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface ReceiptAccountContext {
  id: string;
  name: string;
  /** The accounts table has no type column today; kept optional for future use */
  type?: string;
}

export interface ReceiptEnvelopeContext {
  id: string;
  name: string;
  group_name: string | null;
  allocated: number;
  spent: number;
}

export type ReceiptField = "title" | "amount" | "account_id" | "category_id" | "transaction_date";

export interface ReceiptDraft {
  title: string | null;
  amount: number | null;
  account_id: string | null;
  category_id: string | null;
  transaction_date: string;
  uncertain_fields: ReceiptField[];
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

const isRealDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, day] = value.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === day;
};

/**
 * Reads a receipt image and returns a DRAFT transaction. The model only sees the user's accounts and
 * envelopes as read-only context, has no tools, and anything it is unsure about is returned as null.
 * Every returned id is re-validated against the supplied lists before it leaves this function.
 */
export async function extractReceiptDraft(
  base64Image: string,
  context: { accounts: ReceiptAccountContext[]; envelopes: ReceiptEnvelopeContext[]; today: string },
  mimeType: string = "image/jpeg"
): Promise<ReceiptDraft> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is missing on server");
  }

  const { accounts, envelopes, today } = context;

  const systemInstruction = `You extract a draft expense from a receipt image. You have read-only context and no tools.
Return strictly valid JSON: {"title","amount","account_id","category_id","transaction_date","uncertain_fields"}.

RULES (never guess; use null when unsure):
- title: merchant name or a concise description of the purchase. null if illegible or unclear.
- amount: the final total paid, as a number. null if cut off, blurry or ambiguous.
- account_id: choose ONLY an "id" from the ACCOUNTS list below, and only when the receipt shows an explicit payment cue
  (e.g. "DBS", "OCBC", "NETS", "PayNow", a card network / last-4 digits, or "CASH") that clearly matches exactly one account. Otherwise null.
- category_id: choose ONLY an "id" from the ENVELOPES list below, based on the merchant and line items. If ambiguous or low-confidence, null.
- transaction_date: the receipt date as YYYY-MM-DD. If missing, unreadable or ambiguous use today's date: ${today}.
- uncertain_fields: names of fields (title, amount, account_id, category_id, transaction_date) that were missing, defaulted or low-confidence.
Never invent ids. Never output anything but the JSON object.

ACCOUNTS: ${JSON.stringify(accounts)}
ENVELOPES: ${JSON.stringify(envelopes)}`;

  const nullableString = { type: Type.STRING, nullable: true };

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Extract the draft transaction from this receipt." },
          { inlineData: { data: base64Image, mimeType } },
        ],
      },
    ],
    config: {
      systemInstruction,
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: nullableString,
          amount: { type: Type.NUMBER, nullable: true },
          account_id: nullableString,
          category_id: nullableString,
          transaction_date: nullableString,
          uncertain_fields: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["title", "amount", "account_id", "category_id", "transaction_date", "uncertain_fields"],
      },
    },
  });

  let raw: any = {};
  try {
    raw = JSON.parse(response.text || "{}");
  } catch {
    raw = {};
  }

  // ---- Post-validation: never trust the model ----
  const accountIds = new Set(accounts.map((a) => a.id));
  const envelopeIds = new Set(envelopes.map((e) => e.id));

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 255) : null;
  const amountNum = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
  const amount = raw.amount !== null && raw.amount !== undefined && Number.isFinite(amountNum) && amountNum > 0
    ? Math.round(amountNum * 100) / 100
    : null;
  const account_id = typeof raw.account_id === "string" && accountIds.has(raw.account_id) ? raw.account_id : null;
  const category_id = typeof raw.category_id === "string" && envelopeIds.has(raw.category_id) ? raw.category_id : null;
  const dateOk = isRealDate(raw.transaction_date);
  const transaction_date = dateOk ? (raw.transaction_date as string) : today;

  const uncertain = new Set<ReceiptField>();
  const allowed: ReceiptField[] = ["title", "amount", "account_id", "category_id", "transaction_date"];
  if (Array.isArray(raw.uncertain_fields)) {
    for (const f of raw.uncertain_fields) if (allowed.includes(f)) uncertain.add(f);
  }
  if (title === null) uncertain.add("title");
  if (amount === null) uncertain.add("amount");
  if (account_id === null) uncertain.add("account_id");
  if (category_id === null) uncertain.add("category_id");
  if (!dateOk) uncertain.add("transaction_date");

  return { title, amount, account_id, category_id, transaction_date, uncertain_fields: [...uncertain] };
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