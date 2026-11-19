import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { ChatContext } from "./chatContextService.js";
import { isValidDateString, normalizeFrequency } from "./recurringService.js";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface ReceiptAccountContext {
  id: string;
  name: string;
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

export type ChatActionMetadata =
  | { actionType: "none" }
  | {
      actionType: "reallocation";
      transferDetails: {
        sourceCategoryId: string;
        sourceCategory: string;
        destCategoryId: string;
        destCategory: string;
        amount: number;
      };
    }
  | {
      actionType: "budget_allocation";
      budgetPlan: {
        targetIncome: number;
        month: string;
        allocations: {
          categoryId: string;
          categoryName: string;
          groupName: string;
          currentAssigned: number;
          proposedAssigned: number;
        }[];
      };
    }
  | {
      actionType: "recurring_proposal";
      mode: "create" | "update";
      recurringDetails: {
        recurringId: string | null;
        title: string;
        amount: number;
        type: "expense" | "income";
        accountId: string | null;
        accountName: string | null;
        categoryId: string | null;
        categoryName: string | null;
        frequency: string;
        nextDate: string;
      };
    };

export interface ChatResponsePayload {
  replyText: string;
  metadata: ChatActionMetadata;
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
    model: "gemini-3.5-flash-lite",
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

const positive = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/**
 * Checks a model-proposed action against the user's real rows. Returns { actionType: "none" } when anything is
 * invalid, so a broken action card is never rendered. Names/groups are always taken from the database, not the model.
 */
export function validateChatProposal(raw: any, ctx: ChatContext): ChatActionMetadata {
  const none: ChatActionMetadata = { actionType: "none" };
  if (!raw || typeof raw !== "object") return none;

  const envelopeById = new Map(ctx.envelopes.map((e) => [e.category_id, e]));
  const accountById = new Map(ctx.accounts.map((a) => [a.id, a]));
  const recurringById = new Map(ctx.recurring.map((r) => [r.id, r]));

  if (raw.actionType === "reallocation") {
    const d = raw.transferDetails;
    const src = envelopeById.get(String(d?.sourceCategoryId ?? ""));
    const dest = envelopeById.get(String(d?.destCategoryId ?? ""));
    const amount = positive(d?.amount);
    if (!src || !dest || src.category_id === dest.category_id || amount === null) return none;
    // The reallocate endpoint rejects moving more than the source's assigned budget; don't offer what would fail
    if (amount > (src.months[ctx.currentMonth]?.assigned ?? 0)) return none;
    return {
      actionType: "reallocation",
      transferDetails: {
        sourceCategoryId: src.category_id,
        sourceCategory: src.name,
        destCategoryId: dest.category_id,
        destCategory: dest.name,
        amount,
      },
    };
  }

  if (raw.actionType === "budget_allocation") {
    const plan = raw.budgetPlan;
    const targetIncome = positive(plan?.targetIncome);
    const month = typeof plan?.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(plan.month) ? plan.month : ctx.currentMonth;
    if (targetIncome === null || !Array.isArray(plan?.allocations)) return none;

    const seen = new Set<string>();
    const allocations: { categoryId: string; categoryName: string; groupName: string; currentAssigned: number; proposedAssigned: number }[] = [];
    let total = 0;
    for (const item of plan.allocations) {
      const env = envelopeById.get(String(item?.categoryId ?? ""));
      const proposed = Number(item?.proposedAssigned);
      if (!env || seen.has(env.category_id) || !Number.isFinite(proposed) || proposed < 0) return none;
      seen.add(env.category_id);
      const rounded = Math.round(proposed * 100) / 100;
      total += rounded;
      allocations.push({
        categoryId: env.category_id,
        categoryName: env.name,
        groupName: env.group_name ?? "",
        currentAssigned: env.months[ctx.currentMonth]?.assigned ?? 0,
        proposedAssigned: rounded,
      });
    }
    if (allocations.length === 0 || total > targetIncome + 0.005) return none;
    return { actionType: "budget_allocation", budgetPlan: { targetIncome, month, allocations } };
  }

  if (raw.actionType === "recurring_proposal") {
    const d = raw.recurringDetails;
    const mode = raw.mode === "update" ? "update" : raw.mode === "create" ? "create" : null;
    const amount = positive(d?.amount);
    const title = typeof d?.title === "string" ? d.title.trim() : "";
    const type = d?.type === "income" ? "income" : d?.type === "expense" ? "expense" : null;
    const freq = normalizeFrequency(d?.frequency);
    if (!mode || amount === null || !title || !type || !freq) return none;

    let recurringId: string | null = null;
    if (mode === "update") {
      recurringId = String(d?.recurringId ?? "");
      if (!recurringById.has(recurringId)) return none;
    }

    let accountId: string | null = null;
    let accountName: string | null = null;
    if (d?.accountId) {
      const acc = accountById.get(String(d.accountId));
      if (!acc) return none;
      accountId = acc.id;
      accountName = acc.name;
    }

    let categoryId: string | null = null;
    let categoryName: string | null = null;
    if (type === "expense" && d?.categoryId) {
      const env = envelopeById.get(String(d.categoryId));
      if (!env) return none;
      categoryId = env.category_id;
      categoryName = env.name;
    }

    const nextDate = isValidDateString(d?.nextDate) ? d.nextDate : ctx.today;
    return {
      actionType: "recurring_proposal",
      mode,
      recurringDetails: {
        recurringId,
        title: title.slice(0, 255),
        amount,
        type,
        accountId,
        accountName,
        categoryId,
        categoryName,
        frequency: freq.charAt(0).toUpperCase() + freq.slice(1),
        nextDate,
      },
    };
  }

  return none;
}

/**
 * Chat assistant. Read-only: it receives a snapshot of the user's data, has no tools, and can only PROPOSE actions.
 * Proposals are validated against the snapshot before being returned; the app applies them through user-confirmed modals.
 */
/** True for Gemini's "503 - model is currently experiencing high demand" (UNAVAILABLE) errors. */
export function isModelOverloadedError(error: unknown): boolean {
  const e = error as any;
  if (e?.status === 503 || e?.code === 503 || e?.error?.code === 503 || e?.response?.status === 503) return true;
  const text = `${e?.message ?? ""} ${e?.error?.message ?? ""}`;
  return /"code"s*:s*503|503.*(unavailable|high demand)|high demand|UNAVAILABLE/i.test(text);
}

const OVERLOADED_REPLY = "Finley is experiencing high demand right now. Please try again in a moment.";
const OVERLOAD_RETRY_DELAYS_MS = [1000, 2500];

const FINANCE_WORDS =
  /budget|spen[dt]|spending|expens|income|salary|paycheck|allowance|envelope|categor|account|balance|cash|saving|saved|goal|recurring|subscription|\bbills?\b|\brent\b|transfer|reallocat|allocat|afford|transaction|purchase|bought|\bpaid\b|\bpay\b|money|dollar|\$|\d|groceries|food|transport|month|week|year|average|total|how much|overspen|unallocated|\bpool\b|deposit|withdraw|\bcost|invest|debt|loan|\bmove\b|\bcover\b/i;

/**
 * Decides whether a chat message needs the user's financial snapshot. Cheap heuristic (no model call):
 * the snapshot is skipped only for messages with no finance wording whose preceding turns were not about money either
 * (greetings, thanks, "what can you do?"). Follow-ups such as "and last month?" keep the snapshot because the
 * previous turns were financial. When in doubt the snapshot is included.
 */
export function needsFinancialContext(userQuery: string, history: Array<{ role: string; content: string }>): boolean {
  if (FINANCE_WORDS.test(userQuery)) return true;
  // history ends with the current message; look at the two turns before it
  const previous = history.slice(0, -1).slice(-2);
  return previous.some((h) => FINANCE_WORDS.test(h.content || ""));
}

export async function processChatQueryWithGemini(
  userQuery: string,
  history: Array<{ role: string; content: string }>,
  ctx: ChatContext | null,
  todayInput?: string
): Promise<ChatResponsePayload> {
  try {
    const today = isValidDateString(todayInput) ? String(todayInput) : new Date().toISOString().slice(0, 10);
    const systemInstruction = ctx === null
      ? `You are Finley, a friendly personal finance assistant inside a zero-based budgeting app. Today's date is ${today}.
No financial data is loaded for this message. Reply briefly and conversationally. Never state or guess any of the user's balances, spending or budgets.
If the user is asking about their own money, budget, spending, savings or recurring payments, ask them to say what they want to look at (for example "how much did I spend on groceries last month?") so you can check it.
Return JSON {"reply": string, "metadata": null}. Never put JSON or code blocks in "reply".`
      : `You are Finley, a friendly personal finance assistant inside a zero-based budgeting app.
Today's date is ${ctx.today}. The current month is ${ctx.currentMonth}. All money is in dollars.
You have READ-ONLY access to the user's data (JSON below). You cannot change anything yourself.

DATA (all figures are exact; use them as given):
${JSON.stringify({
  accounts: ctx.accounts,
  totalCash: ctx.totalCash,
  unallocatedPool: ctx.unallocatedPool,
  envelopes: ctx.envelopes,
  spendingSummary: ctx.spendingSummary,
  savingsPlans: ctx.savingsPlans,
  recurring: ctx.recurring,
  recentTransactions: ctx.recentTransactions,
})}

Envelope "months" hold assigned, spent and available (= assigned - spent) for the current month and the 6 months before it.
"spendingSummary" holds exact monthly totals per category plus last-3-month totals and averages: use them for spending questions instead of adding transactions yourself.
unallocatedPool = totalCash - sum(max(0, available)) - sum(savings saved_amount).

OUTPUT: return JSON {"reply": string, "metadata": object | null}.

ANALYTICAL Q&A: when asked about spending trends, category totals, savings progress or affordability, answer with concise bullet points
(e.g. month-by-month figures, the 3-month total and the monthly average). NEVER invent numbers that are not in the data; if the data does not
cover the question, say so. Set "metadata" to null.

ACTION PROPOSALS (only when the user asks for one; otherwise metadata is null). Use ids exactly as they appear in the data. Never invent ids.
1. Move money between two existing envelopes -> metadata = {"actionType":"reallocation","transferDetails":{"sourceCategoryId","sourceCategory","destCategoryId","destCategory","amount"}}
   The amount must not exceed the source envelope's assigned amount this month.
2. Build or adjust a monthly budget from an income amount (e.g. "make a budget with 1500 income") using the user's EXISTING envelopes ->
   {"actionType":"budget_allocation","budgetPlan":{"targetIncome":number,"month":"YYYY-MM","allocations":[{"categoryId","categoryName","groupName","currentAssigned","proposedAssigned"}]}}
   The total of all proposedAssigned must never exceed targetIncome. Use the month ${ctx.currentMonth} unless told otherwise. Base the split on the user's past spending and current assignments.
3. Create or edit a recurring payment -> {"actionType":"recurring_proposal","mode":"create"|"update","recurringDetails":{"recurringId":string|null,"title","amount","type":"expense"|"income","accountId":string|null,"accountName":string|null,"categoryId":string|null,"categoryName":string|null,"frequency":"Weekly"|"Monthly"|"Yearly","nextDate":"YYYY-MM-DD"}}
   For "update", recurringId must be an existing recurring id from the data. Use null for an account or envelope you are unsure about.
In "reply", briefly explain the proposal and say the user can review and confirm it below. Never put JSON or code blocks in "reply". Nothing is applied until the user confirms.`;

    const formattedHistory = history.slice(-11, -1).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content || "" }],
    }));

    const nullableStr = { type: Type.STRING, nullable: true };
    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            metadata: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                actionType: { type: Type.STRING, enum: ["reallocation", "budget_allocation", "recurring_proposal"] },
                mode: { type: Type.STRING, nullable: true, enum: ["create", "update"] },
                transferDetails: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    sourceCategoryId: { type: Type.STRING },
                    sourceCategory: { type: Type.STRING },
                    destCategoryId: { type: Type.STRING },
                    destCategory: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                  },
                },
                budgetPlan: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    targetIncome: { type: Type.NUMBER },
                    month: { type: Type.STRING },
                    allocations: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          categoryId: { type: Type.STRING },
                          categoryName: { type: Type.STRING },
                          groupName: { type: Type.STRING },
                          currentAssigned: { type: Type.NUMBER },
                          proposedAssigned: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
                recurringDetails: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                    recurringId: nullableStr,
                    title: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    type: { type: Type.STRING, enum: ["expense", "income"] },
                    accountId: nullableStr,
                    accountName: nullableStr,
                    categoryId: nullableStr,
                    categoryName: nullableStr,
                    frequency: { type: Type.STRING },
                    nextDate: { type: Type.STRING },
                  },
                },
              },
            },
          },
          required: ["reply"],
        },
      },
      history: formattedHistory,
    });

    // Demand spikes are usually brief: retry a couple of times before giving up
    let result;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await chat.sendMessage({ message: userQuery });
        break;
      } catch (err) {
        if (!isModelOverloadedError(err) || attempt >= OVERLOAD_RETRY_DELAYS_MS.length) throw err;
        await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAYS_MS[attempt]));
      }
    }
    const rawText = result.text || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { reply: rawText.replace(/```json[\s\S]*?```/g, "").trim() };
    }

    const replyText = String(parsed.reply || "I've looked at your budget.")
      .replace(/```json[\s\S]*?```/g, "")
      .trim();

    return { replyText, metadata: ctx ? validateChatProposal(parsed.metadata, ctx) : ({ actionType: "none" } as ChatActionMetadata) };
  } catch (error) {
    console.error("Error in geminiService:", error);
    return {
      replyText: isModelOverloadedError(error)
        ? OVERLOADED_REPLY
        : "Sorry, I encountered an error analyzing your financial data.",
      metadata: { actionType: "none" },
    };
  }
}
