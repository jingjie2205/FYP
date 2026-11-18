import { Request, Response } from "express";
import { parseMonth, runRollover } from "../services/budgetService.js";

// POST /api/budgets/rollover/:userId   body: { month: "YYYY-MM" }  (month = date on the user's phone)
export async function rolloverBudgets(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId);
    const month = parseMonth(req.body?.month);

    if (!month) {
      return res.status(400).json({ error: "A valid month (YYYY-MM) is required" });
    }

    const result = await runRollover(userId, month);
    res.status(200).json(result);
  } catch (e: any) {
    console.error("Error running monthly rollover:", e);
    res.status(500).json({ error: "Internal server error during rollover", details: e.message });
  }
}
