/**
 * Maps Clerk error codes / statuses to clean, human-readable messages.
 * Raw Clerk codes or statuses must never be shown to users.
 */

const FALLBACK = "Unable to sign in. Please try again.";

const MESSAGES: Record<string, string> = {
  form_identifier_not_found: "No account found with that email address.",
  form_password_incorrect: "Incorrect password. Please try again.",
  form_identifier_exists: "An account with this email already exists. Try signing in instead.",
  form_password_length_too_short: "Password must be at least 8 characters long.",
  form_password_pwned: "Please choose a stronger, less common password.",
  form_code_incorrect: "Invalid verification code. Please check your email and try again.",
  verification_failed: "Invalid verification code. Please check your email and try again.",
  verification_expired: "That code has expired. Tap resend to get a new code.",
  needs_identifier: "Please enter your email address and password.",
  form_param_nil: "Please enter your email address and password.",
  too_many_requests: "Too many attempts. Please wait a moment and try again.",
  network_error: "Network error. Please check your connection and try again.",
};

/** A "readable sentence" starts with a capital letter, has spaces, and isn't a snake_case code. */
function isReadableSentence(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const t = text.trim();
  return t.length > 8 && t.includes(" ") && !/^[a-z0-9_]+$/.test(t) && /^[A-Z]/.test(t);
}

/** Convert a Clerk error code or sign-in/up status into a friendly message (or undefined). */
export function messageForCode(code?: string | null): string | undefined {
  return code ? MESSAGES[code] : undefined;
}

/** Convert any thrown/returned Clerk error into a friendly message. */
export function getClerkErrorMessage(err: unknown, fallback: string = FALLBACK): string {
  const e = err as any;
  if (!e) return fallback;

  const codes: unknown[] = [e.code, e.errors?.[0]?.code];
  for (const c of codes) {
    if (typeof c === "string" && MESSAGES[c]) return MESSAGES[c];
  }

  const candidates: unknown[] = [e.errors?.[0]?.longMessage, e.errors?.[0]?.message, e.longMessage];
  for (const c of candidates) {
    if (isReadableSentence(c)) return c;
  }

  return fallback;
}

/** True when the user closed/cancelled an OAuth browser session (should not show an error). */
export function isCancellationError(err: unknown): boolean {
  const e = err as any;
  const text = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  return /err_canceled|cancel|dismiss/.test(text);
}
