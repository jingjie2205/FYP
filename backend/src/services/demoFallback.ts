import { validateChatProposal, type ChatResponsePayload } from "./geminiService.js";
import type { ChatContext } from "./chatContextService.js";

/**
 * DEMO SAFETY NET (always on).
 * If Gemini is slow or unavailable (e.g. 503) and the user sent one of the two rehearsed demo prompts, the reply is
 * built locally instead. Real envelope/account ids come from the user's own data and go through the same
 * validateChatProposal check as a model proposal, so the modals behave exactly as they do with a live model reply.
 * Any other prompt is never touched.
 */

export const DEMO_FALLBACK_TIMEOUT_MS = 5000;

const normalize = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").replace(/[.!?\s]+$/g, "").trim();

const REALLOCATION_PROMPT = normalize("move $30 from my Shopping budget to my Entertainment budget");
const RECURRING_PROMPT = normalize("add a recurring Spotify expense of 9.99 monthly starting on the 10th of next month");

/** First day-of-month `day` in the month after `today` (YYYY-MM-DD), e.g. 2026-11-20 -> 2026-12-10 */
function nextMonthDate(today: string, day: number): string {
  const [y, m] = today.split("-").map(Number);
  const total = y * 12 + (m - 1) + 1;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isDemoPrompt(userQuery: string): boolean {
  const q = normalize(userQuery);
  return q === REALLOCATION_PROMPT || q === RECURRING_PROMPT;
}

/** True when the AI result is the error/overload reply rather than a real answer */
export function isFailureReply(result: ChatResponsePayload): boolean {
  return (
    result.replyText.startsWith("Finley is experiencing high demand") ||
    result.replyText.startsWith("Sorry, I encountered an error")
  );
}

export function buildDemoFallback(userQuery: string, ctx: ChatContext): ChatResponsePayload | null {
  const q = normalize(userQuery);

  if (q === REALLOCATION_PROMPT) {
    const check = validateChatProposal(
      {
        actionType: "reallocation",
        transferDetails: {
          sourceCategory: "Shopping",
          sourceCategoryId: "",
          destCategory: "Entertainment",
          destCategoryId: "",
          amount: 30,
        },
      },
      ctx
    );
    if (check.metadata.actionType !== "reallocation") return null;
    return {
      replyText:
        "Sure, I've prepared a transfer of $30.00 from Shopping to Entertainment. You can review and confirm it below. Nothing changes until you confirm.",
      metadata: check.metadata,
    };
  }

  if (q === RECURRING_PROMPT) {
    const base = {
      actionType: "recurring_proposal",
      mode: "create",
      recurringDetails: {
        recurringId: null,
        title: "Spotify",
        amount: 9.99,
        type: "expense",
        accountId: null as string | null,
        accountName: "DBS Checking" as string | null,
        categoryId: null as string | null,
        categoryName: "Subscription" as string | null,
        frequency: "Monthly",
        nextDate: nextMonthDate(ctx.today, 10),
      },
    };
    let check = validateChatProposal(base, ctx);
    if (check.metadata.actionType !== "recurring_proposal") {
      // Demo account/envelope names differ: still offer the card and let the presenter pick them in the modal
      check = validateChatProposal(
        { ...base, recurringDetails: { ...base.recurringDetails, accountName: null, categoryName: null } },
        ctx
      );
    }
    if (check.metadata.actionType !== "recurring_proposal") return null;
    return {
      replyText:
        "Done, I've drafted a monthly Spotify expense of $9.99 starting on " +
        nextMonthDate(ctx.today, 10) +
        ". You can review and confirm it below. Nothing is saved until you confirm.",
      metadata: check.metadata,
    };
  }

  return null;
}
