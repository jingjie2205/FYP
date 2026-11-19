"""Tests for the Holt-Winters envelope forecaster, using synthetic data (no database needed)."""

from __future__ import annotations

import random
from datetime import date, timedelta

import pytest

from forecaster import (
    build_forecast,
    monthly_buckets,
    occurrences_in_month,
    shift_month,
)

RENT, GROCERIES, DINING, FUN = "cat-rent", "cat-groceries", "cat-dining", "cat-fun"

CATEGORIES = [
    {"id": RENT, "name": "Rent", "default_amount": 1200.0, "assigned": 1200.0},
    {"id": GROCERIES, "name": "Groceries", "default_amount": 400.0, "assigned": 400.0},
    {"id": DINING, "name": "Dining", "default_amount": 200.0, "assigned": None},
    {"id": FUN, "name": "Fun", "default_amount": 80.0, "assigned": 80.0},
]


# ----------------------------------------------------------------------------- synthetic data
class Gen:
    """Builds transactions shaped like the rows the service reads from Postgres."""

    def __init__(self, seed: int = 7):
        self.rng = random.Random(seed)
        self.rows: list[dict] = []
        self._n = 0

    def add(self, category_id: str, title: str, amount: float, day: str, recurring_id: str | None = None):
        self._n += 1
        self.rows.append(
            {
                "id": f"tx-{self._n}",
                "title": title,
                "amount": round(amount, 2),
                "category_id": category_id,
                "date": day,
                "recurring_id": recurring_id,
            }
        )

    def fixed_rent(self, months: list[str], amount: float = 1200.0):
        for m in months:
            self.add(RENT, "Rent", amount, f"{m}-01", recurring_id="rule-rent")

    def weekly_groceries(self, months: list[str], mean: float = 95.0, sd: float = 12.0):
        for m in months:
            y, mo = (int(p) for p in m.split("-"))
            d = date(y, mo, 3)
            while d.month == mo:
                self.add(GROCERIES, "Supermarket", max(20.0, self.rng.gauss(mean, sd)), d.isoformat())
                d += timedelta(days=7)

    def trending_dining(self, months: list[str], start: float = 100.0, step: float = 20.0):
        for i, m in enumerate(months):
            total = start + step * i
            for k in range(4):  # four dinners that add up to the month's total
                self.add(DINING, f"Dinner {k}", total / 4, f"{m}-{5 + k * 6:02d}")



def months_before(target: str, n: int) -> list[str]:
    return [shift_month(target, -i) for i in range(n, 0, -1)]


def envelope(result: dict, category_id: str) -> dict:
    return next(e for e in result["envelopes"] if e["categoryId"] == category_id)


# ----------------------------------------------------------------------------- forecaster
def test_holt_winters_follows_an_upward_dining_trend():
    target = "2026-11"
    g = Gen()
    g.trending_dining(months_before(target, 6), start=100, step=20)  # 100,120,...,200 -> next ~220

    result = build_forecast(CATEGORIES, g.rows, [], target)
    dining = envelope(result, DINING)

    assert dining["modelUsed"] == "holt_winters"
    assert dining["monthsOfHistory"] == 6
    assert dining["variableAmount"] >= 0
    # follows the trend: above the last observed month (200) is ideal, but a damped trend may undershoot a bit;
    # it must at least beat a plain average of the history (150)
    assert dining["variableAmount"] > 160


def test_moving_average_for_one_or_two_months_of_history():
    target = "2026-11"
    g = Gen()
    g.add(FUN, "Cinema", 40.0, "2026-09-10")
    g.add(FUN, "Games", 80.0, "2026-10-10")

    result = build_forecast(CATEGORIES, g.rows, [], target)
    fun = envelope(result, FUN)

    assert fun["modelUsed"] == "moving_average"
    assert fun["monthsOfHistory"] == 2
    # weighted toward the newest month: (40*1 + 80*2) / 3
    assert fun["variableAmount"] == pytest.approx(66.67, abs=0.01)


def test_single_month_history_uses_that_month():
    g = Gen()
    g.add(FUN, "Cinema", 55.0, "2026-10-10")
    fun = envelope(build_forecast(CATEGORIES, g.rows, [], "2026-11"), FUN)
    assert fun["modelUsed"] == "moving_average"
    assert fun["variableAmount"] == 55.0


def test_zero_history_falls_back_to_assigned_budget():
    result = build_forecast(CATEGORIES, [], [], "2026-11")
    fun = envelope(result, FUN)
    assert fun["modelUsed"] == "fallback_assigned"
    assert fun["monthsOfHistory"] == 0
    assert fun["predictedSpend"] == 80.0
    assert fun["projectedDelta"] == 0.0


def test_zero_history_uses_default_budget_when_month_is_uninitialised():
    dining = envelope(build_forecast(CATEGORIES, [], [], "2026-11"), DINING)
    assert dining["plannedBudget"] == 200.0  # assigned is None -> category default
    assert dining["predictedSpend"] == 200.0


def test_recurring_bills_are_deterministic_and_not_double_counted():
    rules = [{"id": "rule-rent", "title": "Rent", "amount": 1200.0, "frequency": "Monthly",
              "category_id": RENT, "anchor": "2026-01-01"}]
    g = Gen()
    g.fixed_rent(months_before("2026-11", 6))  # posted by the recurring rule -> excluded from the variable history

    rent = envelope(build_forecast(CATEGORIES, g.rows, rules, "2026-11"), RENT)
    assert rent["recurringAmount"] == 1200.0
    assert rent["variableAmount"] == 0.0  # no non-recurring spend history
    assert rent["predictedSpend"] == 1200.0


def test_projected_overspend_is_positive_delta():
    g = Gen()
    for m in months_before("2026-11", 4):
        g.add(FUN, "Concert", 150.0, f"{m}-12")
    fun = envelope(build_forecast(CATEGORIES, g.rows, [], "2026-11"), FUN)
    assert fun["projectedDelta"] > 0  # spends ~150 against an 80 budget


def test_holt_winters_never_goes_negative_on_a_falling_series():
    g = Gen()
    g.trending_dining(months_before("2026-11", 5), start=100, step=-24)  # 100, 76, 52, 28, 4
    dining = envelope(build_forecast(CATEGORIES, g.rows, [], "2026-11"), DINING)
    assert dining["variableAmount"] >= 0.0


def test_weekly_occurrences_are_counted_per_month():
    rule = {"frequency": "Weekly", "anchor": "2026-11-02"}  # Mondays: 2, 9, 16, 23, 30
    assert occurrences_in_month(rule, "2026-11") == 5
    assert occurrences_in_month(rule, "2026-10") == 0  # not started yet
    assert occurrences_in_month(rule, "2026-12") == 4  # 7, 14, 21, 28


def test_yearly_and_future_rules():
    assert occurrences_in_month({"frequency": "Yearly", "anchor": "2025-11-15"}, "2026-11") == 1
    assert occurrences_in_month({"frequency": "Yearly", "anchor": "2025-03-15"}, "2026-11") == 0
    assert occurrences_in_month({"frequency": "Monthly", "anchor": "2027-01-01"}, "2026-11") == 0


def test_history_fills_empty_months_with_zero():
    g = Gen()
    g.add(FUN, "A", 30.0, "2026-06-10")
    g.add(FUN, "B", 50.0, "2026-09-10")
    assert monthly_buckets(g.rows, FUN, "2026-11") == [30.0, 0.0, 0.0, 50.0, 0.0]


def test_totals_add_up():
    g = Gen()
    g.trending_dining(months_before("2026-11", 4))
    result = build_forecast(CATEGORIES, g.rows, [], "2026-11")
    assert result["totalPredictedSpend"] == pytest.approx(sum(e["predictedSpend"] for e in result["envelopes"]), abs=0.01)
    assert result["totalPlannedBudget"] == pytest.approx(1200 + 400 + 200 + 80)


def test_full_pipeline_on_a_synthetic_user():
    """Fixed bills + noisy weekly groceries + trending dining, all together."""
    target = "2026-11"
    hist = months_before(target, 6)
    g = Gen(seed=42)
    g.fixed_rent(hist)
    g.weekly_groceries(hist)
    g.trending_dining(hist)
    rules = [{"id": "rule-rent", "title": "Rent", "amount": 1200.0, "frequency": "Monthly",
              "category_id": RENT, "anchor": f"{hist[0]}-01"}]

    forecast = build_forecast(CATEGORIES, g.rows, rules, target)

    assert envelope(forecast, RENT)["predictedSpend"] == 1200.0
    assert envelope(forecast, GROCERIES)["modelUsed"] == "holt_winters"
    assert envelope(forecast, DINING)["modelUsed"] == "holt_winters"
    assert set(forecast) == {"month", "totalPredictedSpend", "totalPlannedBudget", "envelopes"}
    # sorted so the worst projected overspend is first
    deltas = [e["projectedDelta"] for e in forecast["envelopes"]]
    assert deltas == sorted(deltas, reverse=True)
