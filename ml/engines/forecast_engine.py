"""
Multi-Horizon Energy Forecast Engine
Forecasts next hour, next 24 hours (hourly trajectory), remaining cycle kWh,
and next month kWh using the adaptive online ensemble and dynamic feature lags.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import math
import logging
from ..features.feature_engine import FeatureEngine
from ..models.ensemble import AdaptiveEnsemble

logger = logging.getLogger("LECO_ML.forecast_engine")


class ForecastEngine:
    """
    Executes multi-step recursive and direct energy forecasts.
    Maintains causality: future targets are never fed back until officially evaluated.
    """

    def __init__(self, feature_engine: Optional[FeatureEngine] = None):
        self.feature_engine = feature_engine or FeatureEngine()

    def forecast_next_hour(
        self,
        ensemble: AdaptiveEnsemble,
        current_timestamp: datetime,
        recent_hourly_kwh: List[float],
        historical_matrix: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Generates H+1 next-hour forecast."""
        target_ts = current_timestamp + timedelta(hours=1)
        features = self.feature_engine.extract_features(
            meter_id=ensemble.meter_id,
            target_timestamp=target_ts,
            recent_hourly_kwh=recent_hourly_kwh,
            historical_weekday_hour_matrix=historical_matrix
        )

        pred_res = ensemble.predict(features.to_model_dict())
        pred_res["target_timestamp"] = target_ts.isoformat()
        pred_res["horizon_hours"] = 1
        return pred_res

    def forecast_next_24h(
        self,
        ensemble: AdaptiveEnsemble,
        current_timestamp: datetime,
        recent_hourly_kwh: List[float],
        historical_matrix: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Generates 24-step recursive hourly forecast trajectory for the next day.
        Applies progressive uncertainty expansion over longer horizons.
        """
        hourly_series: List[Dict[str, Any]] = []
        simulated_history = list(recent_hourly_kwh)
        total_24h_kwh = 0.0

        for h in range(1, 25):
            target_ts = current_timestamp + timedelta(hours=h)
            features = self.feature_engine.extract_features(
                meter_id=ensemble.meter_id,
                target_timestamp=target_ts,
                recent_hourly_kwh=simulated_history,
                historical_weekday_hour_matrix=historical_matrix
            )

            pred = ensemble.predict(features.to_model_dict())
            val = pred["predicted_kwh"]
            total_24h_kwh += val

            # Multi-step uncertainty expansion: variance scales with sqrt(horizon)
            horizon_scale = math.sqrt(h)
            sigma = (pred["upper_bound_kwh"] - val) / 1.96
            adj_sigma = sigma * (1.0 + 0.05 * horizon_scale)

            low = max(0.0, round(val - 1.96 * adj_sigma, 4))
            high = round(val + 1.96 * adj_sigma, 4)

            hourly_series.append({
                "step": h,
                "target_timestamp": target_ts.isoformat(),
                "hour": target_ts.hour,
                "predicted_kwh": val,
                "lower_bound_kwh": low,
                "upper_bound_kwh": high,
                "uncertainty_score": min(1.0, round(pred["uncertainty_score"] * (1.0 + 0.03 * h), 3))
            })

            # Feed forward predicted value into virtual lag buffer
            simulated_history.insert(0, val)

        return {
            "meter_id": ensemble.meter_id,
            "forecast_type": "NEXT_24_HOURS",
            "base_timestamp": current_timestamp.isoformat(),
            "total_predicted_24h_kwh": round(total_24h_kwh, 3),
            "cold_start_stage": ensemble.cold_start_stage,
            "hourly_trajectory": hourly_series
        }

    def forecast_remaining_cycle(
        self,
        ensemble: AdaptiveEnsemble,
        current_cycle_day: int,
        daily_kwh_average: float,
        next_24h_kwh: float
    ) -> Dict[str, Any]:
        """
        Projects remaining electricity demand until the end of the 30-day billing cycle.
        """
        cycle_day = max(1, min(30, int(current_cycle_day)))
        remaining_days = max(0, 30 - cycle_day)

        if remaining_days == 0:
            return {
                "remaining_days": 0,
                "predicted_remaining_kwh": 0.0,
                "lower_bound_kwh": 0.0,
                "upper_bound_kwh": 0.0
            }

        # Day 1 of remaining uses high-confidence 24h forecast
        # Remaining subsequent days use daily average blended with 24h trend
        day_1_energy = next_24h_kwh
        subsequent_daily_rate = 0.50 * daily_kwh_average + 0.50 * next_24h_kwh

        predicted_remaining = day_1_energy + ((remaining_days - 1) * subsequent_daily_rate) if remaining_days > 1 else day_1_energy
        predicted_remaining = max(0.5, round(predicted_remaining, 2))

        uncertainty_factor = 0.15 if ensemble.cold_start_stage in ("DAYS_7_TO_30", "MATURE_STREAM") else 0.30
        lower_bound = max(0.0, round(predicted_remaining * (1.0 - uncertainty_factor), 2))
        upper_bound = round(predicted_remaining * (1.0 + uncertainty_factor), 2)

        return {
            "remaining_days": remaining_days,
            "predicted_remaining_kwh": predicted_remaining,
            "lower_bound_kwh": lower_bound,
            "upper_bound_kwh": upper_bound,
            "subsequent_daily_rate": round(subsequent_daily_rate, 2)
        }
