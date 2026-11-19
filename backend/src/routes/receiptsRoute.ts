import { Router } from "express";
import { sql } from "../config/db.js";
import {
  extractReceiptDraft,
  ReceiptAccountContext,
  ReceiptEnvelopeContext,
} from "../services/geminiService.js";

const router = Router();

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// POST /api/receipts/scan   body: { image (base64), mimeType?, user_id, today: "YYYY-MM-DD" }
// Read-only: only SELECT queries run here. The result is a DRAFT the user must review before saving.
router.post("/scan", async (req, res) => {
  try {
    const { image, mimeType, user_id, today } = req.body;

    if (!image) return res.status(400).json({ error: "Missing image data" });
    if (!user_id || typeof user_id !== "string") return res.status(400).json({ error: "user_id is required" });
    if (typeof today !== "string" || !DATE_RE.test(today)) {
      return res.status(400).json({ error: "today must be formatted as YYYY-MM-DD" });
    }

    const monthStart = `${today.slice(0, 7)}-01`;

    // Read-only context, scoped to this user
    const accountRows = await sql`
      SELECT id, name FROM accounts WHERE user_id = ${user_id}
    `;

    const envelopeRows = await sql`
      SELECT
        c.id,
        c.name,
        g.name AS group_name,
        COALESCE(b.assigned, 0) AS allocated,
        COALESCE(s.spent, 0) AS spent
      FROM categories c
      LEFT JOIN category_groups g ON g.id = c.group_id
      LEFT JOIN category_budgets b ON b.category_id = c.id AND b.month = ${monthStart}::date
      LEFT JOIN (
        SELECT category_id, SUM(amount) AS spent
        FROM transactions
        WHERE user_id = ${user_id}
          AND type = 'expense'
          AND transaction_date >= ${monthStart}::date
          AND transaction_date < (${monthStart}::date + INTERVAL '1 month')
        GROUP BY category_id
      ) s ON s.category_id = c.id
      WHERE c.user_id = ${user_id}
    `;

    const accounts: ReceiptAccountContext[] = accountRows.map((a: any) => ({
      id: String(a.id),
      name: String(a.name),
    }));
    const envelopes: ReceiptEnvelopeContext[] = envelopeRows.map((e: any) => ({
      id: String(e.id),
      name: String(e.name),
      group_name: e.group_name ? String(e.group_name) : null,
      allocated: Number(e.allocated),
      spent: Number(e.spent),
    }));

    const draft = await extractReceiptDraft(image, { accounts, envelopes, today }, mimeType || "image/jpeg");
    return res.json(draft);
  } catch (err: any) {
    console.error("OCR Scan Error:", err);
    // Keep internal details out of the response
    return res.status(500).json({ error: "We couldn't read that receipt. Please try again." });
  }
});

export default router;
