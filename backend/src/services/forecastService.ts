/**
 * Client for the Python ML service (ml/): per-envelope expense forecasts (Holt-Winters).
 * The service is optional: when it is offline, slow or misconfigured every function here resolves to null
 * instead of throwing, so Express and the chat keep working.
 */

export interface ForecastEnvelope {
  categoryId: string;
  categoryName: string;
  plannedBudget: number;
  recurringAmount: number;
  variableAmount: number;
  predictedSpend: number;
  projectedDelta: number; // > 0 means projected overspend
  modelUsed: "holt_winters" | "moving_average" | "fallback_assigned";
  monthsOfHistory: number;
}

export interface ForecastResult {
  month: string;
  totalPredictedSpend: number;
  totalPlannedBudget: number;
  envelopes: ForecastEnvelope[];
}

const DEFAULT_TIMEOUT_MS = 5000;

export async function getForecast(
  userId: string,
  month: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ForecastResult | null> {
  const baseUrl = (process.env.ML_SERVICE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.ML_INTERNAL_SECRET || "",
      },
      body: JSON.stringify({ user_id: userId, month }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[forecast] ML service responded ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ForecastResult;
    if (!data || !Array.isArray(data.envelopes)) return null;
    return data;
  } catch (error: any) {
    console.warn("[forecast] ML service unavailable:", error?.name === "AbortError" ? "timed out" : error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
