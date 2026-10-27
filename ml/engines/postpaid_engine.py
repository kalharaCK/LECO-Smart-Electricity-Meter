"""
Postpaid Monthly Bill Forecasting Engine
Predicts final end-of-month electricity bill under PUCSL domestic block tariff
with uncertainty intervals.
"""

from typing import Dict, Any, List, Optional
import math
import logging
from ..tariff.tariff_engine import calculate_domestic_bill
from .forecast_engine import ForecastEngine
from ..models.ensemble import AdaptiveEnsemble

logger = logging.getLogger("LECO_ML.postpaid_engine")


class PostpaidBillEngine:
    """
    Computes forecasted end-of-cycle bill for postpaid electricity meters.
    Formula:
      total_monthly_kwh = already_consumed_kwh + predicted_remaining_kwh
      predicted_bill = tariff_engine(total_monthly_kwh)
    """

    def __init__(self, forecast_engine: Optional[ForecastEngine] = None):
        self.forecast_engine = forecast_engine or ForecastEngine()

    def forecast_bill(
        self,
        ensemble: AdaptiveEnsemble,
        already_consumed_kwh: float,
        current_cycle_day: int,
        daily_kwh_average: float,
        next_24h_kwh: float
    ) -> Dict[str, Any]:
        """
        Forecasts total monthly kWh and corresponding PUCSL bill with lower and upper bounds.
        """
        actual_consumed = max(0.0, float(already_consumed_kwh))
        day = max(1, min(30, int(current_cycle_day)))

        rem_res = self.forecast_engine.forecast_remaining_cycle(
            ensemble=ensemble,
            current_cycle_day=day,
            daily_kwh_average=daily_kwh_average,
            next_24h_kwh=next_24h_kwh
        )

        predicted_remaining = rem_res["predicted_remaining_kwh"]
        lower_remaining = rem_res["lower_bound_kwh"]
        upper_remaining = rem_res["upper_bound_kwh"]

        # Total monthly energy estimates
        predicted_total_kwh = round(actual_consumed + predicted_remaining, 2)
        lower_total_kwh = round(actual_consumed + lower_remaining, 2)
        upper_total_kwh = round(actual_consumed + upper_remaining, 2)

        # Apply PUCSL Domestic Tariff Engine
        bill_expected = calculate_domestic_bill(predicted_total_kwh)
        bill_lower = calculate_domestic_bill(lower_total_kwh)
        bill_upper = calculate_domestic_bill(upper_total_kwh)

        # Accrued bill for energy already consumed
        accrued_bill = calculate_domestic_bill(actual_consumed)

        return {
            "meter_id": ensemble.meter_id,
            "connection_type": "postpaid",
            "current_cycle_day": day,
            "actual_consumed_kwh": round(actual_consumed, 2),
            "predicted_remaining_kwh": predicted_remaining,
            "predicted_total_monthly_kwh": predicted_total_kwh,
            "predicted_bill_lkr": bill_expected["totalCharge"],
            "lower_bound_bill_lkr": bill_lower["totalCharge"],
            "upper_bound_bill_lkr": bill_upper["totalCharge"],
            "accrued_liability_lkr": accrued_bill["totalCharge"],
            "expected_tariff_group": bill_expected["group"],
            "effective_rate_lkr_per_kwh": bill_expected["effectiveRate"],
            "fixed_charge_lkr": bill_expected["fixedCharge"],
            "energy_charge_lkr": bill_expected["energyCharge"],
            "cold_start_stage": ensemble.cold_start_stage
        }
