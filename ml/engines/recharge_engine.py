"""
Prepaid Next-Month Demand & Recharge Recommendation Engine
Predicts subsequent 30-day consumption volume, estimated expenditure,
and recommends optimal top-up amounts.
"""

from typing import Dict, Any, List, Optional
import math
import logging
from ..tariff.tariff_engine import calculate_domestic_bill
from ..models.ensemble import AdaptiveEnsemble

logger = logging.getLogger("LECO_ML.recharge_engine")


class RechargeDemandEngine:
    """
    Computes upcoming monthly electricity demand and recommended recharge credit.
    Formulas:
      monthly_kwh = sum(predicted_daily_kwh)
      monthly_cost = tariff_engine(monthly_kwh)
      additional_recharge = max(0, expected_future_cost - usable_credit)
    """

    def predict_next_month_demand(
        self,
        ensemble: AdaptiveEnsemble,
        current_balance: float,
        daily_kwh_average: float,
        previous_cycle_kwh: float,
        recent_trend_slope: float = 0.0
    ) -> Dict[str, Any]:
        """
        Calculates expected next-month energy volume, financial liability under PUCSL tariff,
        recommended recharge amount, and consumption trend status.
        """
        balance = max(0.0, float(current_balance))
        daily_rate = max(0.1, float(daily_kwh_average))
        prev_kwh = max(1.0, float(previous_cycle_kwh))

        # Project 30-day demand incorporating trend slope
        base_monthly_kwh = daily_rate * 30.0
        # If trend is positive (e.g. rising summer temperatures), adjust projection
        trend_adjustment = max(-15.0, min(25.0, recent_trend_slope * 30.0))
        predicted_monthly_kwh = max(3.0, round(base_monthly_kwh + trend_adjustment, 2))

        # Uncertainty bounds (+/- 15% to 25% depending on model maturity)
        sigma_factor = 0.12 if ensemble.cold_start_stage == "MATURE_STREAM" else 0.25
        lower_monthly_kwh = max(1.0, round(predicted_monthly_kwh * (1.0 - sigma_factor), 2))
        upper_monthly_kwh = round(predicted_monthly_kwh * (1.0 + sigma_factor), 2)

        # Compute Tariff Costs
        bill_expected = calculate_domestic_bill(predicted_monthly_kwh)
        bill_lower = calculate_domestic_bill(lower_monthly_kwh)
        bill_upper = calculate_domestic_bill(upper_monthly_kwh)

        expected_cost = bill_expected["totalCharge"]

        # Calculate recommended top-up: max(0, expected_cost - current_balance)
        # Add safety margin buffer of 10% for unexpected appliance spikes
        recommended_recharge = max(0.0, round((expected_cost * 1.05) - balance, 2))

        # Determine Trend: Increasing / Stable / Decreasing
        pct_change = ((predicted_monthly_kwh - prev_kwh) / prev_kwh) * 100.0
        if pct_change >= 7.0:
            trend = "INCREASING"
        elif pct_change <= -7.0:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        return {
            "meter_id": ensemble.meter_id,
            "current_balance_lkr": round(balance, 2),
            "predicted_next_month_kwh": predicted_monthly_kwh,
            "prediction_range_kwh": {
                "lower": lower_monthly_kwh,
                "upper": upper_monthly_kwh
            },
            "expected_electricity_cost_lkr": expected_cost,
            "cost_range_lkr": {
                "lower": bill_lower["totalCharge"],
                "upper": bill_upper["totalCharge"]
            },
            "recommended_recharge_lkr": recommended_recharge,
            "expected_tariff_group": bill_expected["group"],
            "trend": trend,
            "percentage_change_vs_last_month": round(pct_change, 1),
            "cold_start_stage": ensemble.cold_start_stage
        }
