import { Request, Response } from "express";
import { parseMonth } from "../services/budgetService.js";
import { getForecast } from "../services/forecastService.js";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Always answers 200 with { available, forecast }: a missing ML service must never look like a server failure.
async function respond(res: Response, userId: unknown, monthInput: unknown) {
  if (typeof userId !== "string" || !userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const parsed = monthInput === undefined || monthInput === null || monthInput === "" ? null : parseMonth(monthInput);
  if (monthInput && !parsed) {
    return res.status(400).json({ error: "month must be formatted as YYYY-MM" });
  }
  const month = parsed ? parsed.slice(0, 7) : currentMonthKey();

  const forecast = await getForecast(userId, month);
  return res.status(200).json({ available: forecast !== null, month, forecast });
}

// POST /api/forecast   body: { user_id, month: "YYYY-MM" }
export async function postForecast(req: Request, res: Response) {
  try {
    return await respond(res, req.body?.user_id, req.body?.month);
  } catch (e) {
    console.error("Error building forecast:", e);
    return res.status(200).json({ available: false, month: null, forecast: null });
  }
}

// GET /api/forecast/:userId?month=YYYY-MM
export async function getForecastForUser(req: Request, res: Response) {
  try {
    return await respond(res, req.params.userId, req.query.month);
  } catch (e) {
    console.error("Error building forecast:", e);
    return res.status(200).json({ available: false, month: null, forecast: null });
  }
}
