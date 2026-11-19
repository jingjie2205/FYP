"""Per-envelope expense forecaster.

For every envelope (category) the predicted spend of a target month is

    predicted_spend = recurring_amount + variable_amount

* recurring_amount  - deterministic: active recurring expense rules that fall inside the month.
* variable_amount   - statistical: the envelope's non-recurring spending history, bucketed by month, then
    >= 3 months  -> Holt-Winters (damped additive trend), clamped at 0     (model_used = "holt_winters")
    1-2 months   -> weighted moving average (recent months weigh more)      (model_used = "moving_average")
    0 months     -> the planned budget minus recurring, floored at 0        (model_used = "fallback_assigned")

Everything here is a pure function over plain dicts so it can be tested without a database.
`fetch_inputs` is the only function that touches Postgres, and it only runs SELECT statements.
"""

from __future__ import annotations

import calendar
import warnings
from datetime import date, timedelta
from typing import Any

import numpy as np

MAX_HISTORY_MONTHS = 12


# --------------------------------------------------------------------------- month helpers
def month_of(date_str: str) -> str:
    """'2026-11-05' -> '2026-11'."""
    return str(date_str)[:7]


def shift_month(month: str, n: int) -> str:
    y, m = (int(p) for p in month.split("-"))
    total = y * 12 + (m - 1) + n
    return f"{total // 12}-{total % 12 + 1:02d}"


def month_range(start: str, end: str) -> list[str]:
    """Inclusive list of month keys from start to end ('' list when start > end)."""
    out: list[str] = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur = shift_month(cur, 1)
    return out


def _parse_date(value: str) -> date:
    y, m, d = (int(p) for p in str(value)[:10].split("-"))
    return date(y, m, d)


# --------------------------------------------------------------------------- recurring (deterministic)
def occurrences_in_month(rule: dict[str, Any], month: str) -> int:
    """How many times a recurring rule is due inside `month` (the rule's anchor is its start date)."""
    y, m = (int(p) for p in month.split("-"))
    first = date(y, m, 1)
    last = date(y, m, calendar.monthrange(y, m)[1])
    anchor = _parse_date(rule["anchor"])
    if anchor > last:
        return 0

    frequency = str(rule.get("frequency", "")).strip().lower()
    if frequency == "weekly":
        if anchor >= first:
            start = anchor
        else:
            weeks = -(-(first - anchor).days // 7)  # ceil
            start = anchor + timedelta(days=7 * weeks)
        return 0 if start > last else (last - start).days // 7 + 1
    if frequency == "monthly":
        return 1
    if frequency == "yearly":
        return 1 if anchor.month == m else 0
    return 0


def recurring_amount_by_category(recurring: list[dict[str, Any]], month: str) -> dict[str, float]:
    totals: dict[str, float] = {}
    for rule in recurring:
        cat = rule.get("category_id")
        if not cat:
            continue
        count = occurrences_in_month(rule, month)
        if count:
            totals[cat] = totals.get(cat, 0.0) + float(rule["amount"]) * count
    return totals


# --------------------------------------------------------------------------- variable (statistical)
def monthly_buckets(expenses: list[dict[str, Any]], category_id: str, month: str) -> list[float]:
    """Contiguous monthly totals of NON-recurring spend for the envelope, from its first month up to the month
    before `month` (empty months in between count as 0). Returns [] when there is no history before `month`."""
    sums: dict[str, float] = {}
    for tx in expenses:
        if tx.get("category_id") != category_id or tx.get("recurring_id"):
            continue
        key = month_of(tx["date"])
        if key < month:
            sums[key] = sums.get(key, 0.0) + float(tx["amount"])
    if not sums:
        return []
    start = max(min(sums), shift_month(month, -MAX_HISTORY_MONTHS))
    return [round(sums.get(m, 0.0), 2) for m in month_range(start, shift_month(month, -1))]


def weighted_moving_average(values: list[float]) -> float:
    weights = np.arange(1, len(values) + 1, dtype=float)  # newest month weighs the most
    return float(np.average(np.asarray(values, dtype=float), weights=weights))


def holt_winters_next(values: list[float]) -> float | None:
    """One-step Holt-Winters forecast (additive damped trend, no seasonality: a person rarely has 2 full years of data).
    Returns None if the model cannot be fitted so the caller can fall back."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    series = np.asarray(values, dtype=float)
    if len(series) < 3 or not np.isfinite(series).all():
        return None
    if float(np.ptp(series)) == 0.0:
        return float(series[-1])  # perfectly flat history: nothing to model
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fit = ExponentialSmoothing(
                series, trend="add", damped_trend=True, seasonal=None, initialization_method="estimated"
            ).fit()
            forecast = float(np.asarray(fit.forecast(1))[0])
    except Exception:
        return None
    return forecast if np.isfinite(forecast) else None


def predict_variable(history: list[float], planned: float, recurring: float) -> tuple[float, str]:
    if len(history) >= 3:
        hw = holt_winters_next(history)
        if hw is not None:
            return max(0.0, hw), "holt_winters"
        return max(0.0, weighted_moving_average(history)), "moving_average"
    if len(history) >= 1:
        return max(0.0, weighted_moving_average(history)), "moving_average"
    # No history: assume the plan is spent. Recurring bills are already part of the plan, so don't count them twice.
    return max(0.0, planned - recurring), "fallback_assigned"


# --------------------------------------------------------------------------- public API
def build_forecast(
    categories: list[dict[str, Any]],
    expenses: list[dict[str, Any]],
    recurring: list[dict[str, Any]],
    month: str,
) -> dict[str, Any]:
    recurring_by_cat = recurring_amount_by_category(recurring, month)
    envelopes: list[dict[str, Any]] = []

    for cat in categories:
        cid = cat["id"]
        assigned = cat.get("assigned")
        planned = float(assigned if assigned is not None else (cat.get("default_amount") or 0))
        recurring_amount = round(recurring_by_cat.get(cid, 0.0), 2)

        history = monthly_buckets(expenses, cid, month)
        variable, model = predict_variable(history, planned, recurring_amount)
        variable = round(variable, 2)

        predicted = round(recurring_amount + variable, 2)
        envelopes.append(
            {
                "categoryId": cid,
                "categoryName": cat["name"],
                "plannedBudget": round(planned, 2),
                "recurringAmount": recurring_amount,
                "variableAmount": variable,
                "predictedSpend": predicted,
                "projectedDelta": round(predicted - planned, 2),  # > 0 means projected overspend
                "modelUsed": model,
                "monthsOfHistory": len(history),
            }
        )

    envelopes.sort(key=lambda e: e["projectedDelta"], reverse=True)
    return {
        "month": month,
        "totalPredictedSpend": round(sum(e["predictedSpend"] for e in envelopes), 2),
        "totalPlannedBudget": round(sum(e["plannedBudget"] for e in envelopes), 2),
        "envelopes": envelopes,
    }


# --------------------------------------------------------------------------- database (read-only)
def fetch_inputs(conn, user_id: str, month: str) -> tuple[list[dict], list[dict], list[dict]]:
    """Reads the user's envelopes, expense history and recurring rules. SELECT only, always scoped to user_id."""
    month_start = f"{month}-01"
    next_month_start = f"{shift_month(month, 1)}-01"

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id::text AS id, c.name, c.target_amount AS default_amount, b.assigned AS assigned
            FROM categories c
            LEFT JOIN category_budgets b ON b.category_id = c.id AND b.month = %s::date
            WHERE c.user_id = %s
            """,
            (month_start, user_id),
        )
        categories = [
            {
                "id": r["id"],
                "name": r["name"],
                "default_amount": float(r["default_amount"] or 0),
                "assigned": float(r["assigned"]) if r["assigned"] is not None else None,
            }
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT t.id::text AS id, t.title, t.amount, t.category_id::text AS category_id,
                   to_char(t.transaction_date, 'YYYY-MM-DD') AS date, t.recurring_id::text AS recurring_id
            FROM transactions t
            WHERE t.user_id = %s AND t.type = 'expense' AND t.transaction_date < %s::date
            ORDER BY t.transaction_date ASC
            """,
            (user_id, next_month_start),
        )
        expenses = [
            {
                "id": r["id"],
                "title": r["title"],
                "amount": float(r["amount"]),
                "category_id": r["category_id"],
                "date": r["date"],
                "recurring_id": r["recurring_id"],
            }
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            SELECT rt.id::text AS id, rt.title, rt.amount, rt.frequency, rt.category_id::text AS category_id,
                   to_char(COALESCE(rt.start_date, rt.next_run_date), 'YYYY-MM-DD') AS anchor
            FROM recurring_transactions rt
            WHERE rt.user_id = %s AND rt.type = 'expense' AND rt.is_active = TRUE
            """,
            (user_id,),
        )
        recurring = [
            {
                "id": r["id"],
                "title": r["title"],
                "amount": float(r["amount"]),
                "frequency": r["frequency"],
                "category_id": r["category_id"],
                "anchor": r["anchor"],
            }
            for r in cur.fetchall()
        ]

    return categories, expenses, recurring
