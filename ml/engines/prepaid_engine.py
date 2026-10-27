"""
Prepaid Balance Lifetime Simulation Engine
Simulates hour-by-hour credit exhaustion under nonlinear PUCSL domestic block tariffs
across median and conservative consumption trajectories.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import math
import logging
from ..tariff.tariff_engine import calculate_incremental_charge
from .forecast_engine import ForecastEngine
from ..models.ensemble import AdaptiveEnsemble

logger = logging.getLogger("LECO_ML.prepaid_engine")


class PrepaidLifetimeEngine:
    """
    Simulates prepaid electricity balance depletion under Sri Lankan block tariffs.
    Never relies on simple linear division; computes exact non-linear incremental cost.
    """

    def __init__(self, forecast_engine: Optional[ForecastEngine] = None):
        self.forecast_engine = forecast_engine or ForecastEngine()

    def simulate_depletion(
        self,
        ensemble: AdaptiveEnsemble,
        current_balance: float,
        current_cycle_kwh: float = 0.0,
        current_cycle_day: int = 1,
        recent_hourly_kwh: Optional[List[float]] = None,
        historical_matrix: Optional[Dict[str, float]] = None,
        base_timestamp: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Runs multi-trajectory Monte-Carlo / quantile depletion simulation.
        Trajectories:
          - Median (50th percentile): Expected hourly rate
          - Conservative (85th percentile): High-usage scenario for early warning
          - Optimistic (15th percentile): Frugal conservation scenario
        """
        now = base_timestamp or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        balance = float(current_balance)
        if balance <= 0.0:
            return {
                "meter_id": ensemble.meter_id,
                "current_balance": round(balance, 2),
                "expected_remaining_hours": 0.0,
                "expected_remaining_days": 0.0,
                "predicted_exhaustion_time": now.isoformat(),
                "conservative_warning_time": now.isoformat(),
                "conservative_remaining_days": 0.0,
                "optimistic_remaining_days": 0.0,
                "status": "EXHAUSTED",
                "is_emergency_lifeline_recommended": True,
                "uncertainty_score": 0.0,
                "cold_start_stage": ensemble.cold_start_stage
            }

        history = recent_hourly_kwh or [0.35]
        # Step 1: Pre-generate next 24-hour profile
        h24_res = self.forecast_engine.forecast_next_24h(
            ensemble=ensemble,
            current_timestamp=now,
            recent_hourly_kwh=history,
            historical_matrix=historical_matrix
        )
        h24_list = h24_res["hourly_trajectory"]

        # Typical diurnal hourly template (24 hours)
        hourly_template = [item["predicted_kwh"] for item in h24_list]
        hourly_sigma = [(item["upper_bound_kwh"] - item["predicted_kwh"]) / 1.96 for item in h24_list]

        # Helper to simulate a specific trajectory
        def run_trajectory(multiplier_sigma: float) -> Tuple[int, datetime]:
            sim_balance = balance
            sim_cycle_kwh = max(0.0, float(current_cycle_kwh))
            sim_day = max(1, min(30, int(current_cycle_day)))
            hour_count = 0
            max_sim_hours = 24 * 90  # 90 days maximum lookahead

            while sim_balance > 0.0 and hour_count < max_sim_hours:
                hour_count += 1
                curr_hour_idx = (now.hour + hour_count) % 24

                # Base hourly predicted kWh + sigma adjustment
                base_kwh = hourly_template[curr_hour_idx]
                sigma = hourly_sigma[curr_hour_idx]
                hourly_kwh = max(0.01, base_kwh + (multiplier_sigma * sigma))

                # Compute exact incremental tariff charge for this hour
                incremental_lkr = calculate_incremental_charge(sim_cycle_kwh, hourly_kwh)

                sim_balance -= incremental_lkr
                sim_cycle_kwh += hourly_kwh

                # Check billing cycle rollover (every 24 hours increments day)
                if (hour_count % 24) == 0:
                    sim_day += 1
                    if sim_day > 30:
                        sim_day = 1
                        sim_cycle_kwh = 0.0  # new cycle resets cumulative slab

            exhaustion_time = now + timedelta(hours=hour_count)
            return hour_count, exhaustion_time

        # 1. Median Expected Trajectory (sigma multiplier = 0.0)
        median_hours, median_exhaustion_time = run_trajectory(0.0)

        # 2. Conservative Trajectory (sigma multiplier = +1.28 -> 85th percentile high usage)
        conservative_hours, conservative_exhaustion_time = run_trajectory(1.28)

        # 3. Optimistic Trajectory (sigma multiplier = -1.28 -> 15th percentile low usage)
        optimistic_hours, optimistic_exhaustion_time = run_trajectory(-1.28)

        # Compute conservative warning time (48 hours before conservative depletion or threshold)
        warning_offset_hours = max(0, conservative_hours - 48)
        conservative_warning_time = now + timedelta(hours=warning_offset_hours)

        expected_days = round(median_hours / 24.0, 1)
        conservative_days = round(conservative_hours / 24.0, 1)
        optimistic_days = round(optimistic_hours / 24.0, 1)

        uncertainty_score = round(
            min(1.0, max(0.05, (optimistic_hours - conservative_hours) / max(1.0, median_hours))),
            3
        )

        status = "HEALTHY"
        if expected_days <= 2.0:
            status = "CRITICAL_LOW"
        elif expected_days <= 5.0:
            status = "WARNING_LOW"

        return {
            "meter_id": ensemble.meter_id,
            "current_balance": round(balance, 2),
            "expected_remaining_hours": median_hours,
            "expected_remaining_days": expected_days,
            "predicted_exhaustion_time": median_exhaustion_time.isoformat(),
            "conservative_warning_time": conservative_warning_time.isoformat(),
            "conservative_remaining_days": conservative_days,
            "optimistic_remaining_days": optimistic_days,
            "status": status,
            "is_emergency_lifeline_recommended": (expected_days <= 1.0),
            "uncertainty_score": uncertainty_score,
            "cold_start_stage": ensemble.cold_start_stage
        }
