"""
Online Feature Engineering for Electricity Demand Forecasting
Extracts cyclical temporal encodings, multi-scale lags, rolling statistics,
and exponential moving averages from sequential hourly consumption.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import math
import numpy as np
from pydantic import BaseModel


class ConsumptionFeatures(BaseModel):
    meter_id: int
    target_timestamp: datetime
    # Cyclical & Calendar
    hour: int
    day_of_week: int
    is_weekend: float
    sin_hour: float
    cos_hour: float
    sin_dow: float
    cos_dow: float
    # Lags
    lag_1h: float
    lag_2h: float
    lag_24h: float
    lag_168h: float  # same hour last week
    # Rolling Statistics
    rolling_mean_6h: float
    rolling_std_6h: float
    rolling_mean_24h: float
    rolling_std_24h: float
    # Exponential Moving Averages
    ewma_fast: float  # alpha=0.5
    ewma_slow: float  # alpha=0.2
    # Diurnal Historic Anchor
    same_weekday_hour_avg: float
    sample_count: int

    def to_model_dict(self) -> Dict[str, float]:
        """Returns clean numerical dictionary for online regressors (River / scikit)."""
        return {
            "hour": float(self.hour),
            "is_weekend": float(self.is_weekend),
            "sin_hour": float(self.sin_hour),
            "cos_hour": float(self.cos_hour),
            "sin_dow": float(self.sin_dow),
            "cos_dow": float(self.cos_dow),
            "lag_1h": float(self.lag_1h),
            "lag_2h": float(self.lag_2h),
            "lag_24h": float(self.lag_24h),
            "lag_168h": float(self.lag_168h),
            "rolling_mean_6h": float(self.rolling_mean_6h),
            "rolling_std_6h": float(self.rolling_std_6h),
            "rolling_mean_24h": float(self.rolling_mean_24h),
            "rolling_std_24h": float(self.rolling_std_24h),
            "ewma_fast": float(self.ewma_fast),
            "ewma_slow": float(self.ewma_slow),
            "same_weekday_hour_avg": float(self.same_weekday_hour_avg)
        }


class FeatureEngine:
    """
    Constructs real-time feature vectors from chronological hourly series.
    Gracefully handles cold starts using adaptive default anchors.
    """

    def __init__(self, population_prior_kwh: float = 0.35):
        self.population_prior = population_prior_kwh

    def extract_features(
        self,
        meter_id: int,
        target_timestamp: datetime,
        recent_hourly_kwh: List[float],
        historical_weekday_hour_matrix: Optional[Dict[str, float]] = None
    ) -> ConsumptionFeatures:
        """
        Extracts feature vector given the target timestamp and history of hourly kWh
        ordered newest first: [t-1, t-2, t-3, ...]
        """
        ts = target_timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        hour = ts.hour
        dow = ts.weekday()
        is_weekend = 1.0 if dow in (5, 6) else 0.0

        # Cyclical Encodings (smooth 24h & 7d continuity)
        sin_hour = math.sin(2.0 * math.pi * hour / 24.0)
        cos_hour = math.cos(2.0 * math.pi * hour / 24.0)
        sin_dow = math.sin(2.0 * math.pi * dow / 7.0)
        cos_dow = math.cos(2.0 * math.pi * dow / 7.0)

        n = len(recent_hourly_kwh)

        # Baseline fallback value
        fallback = self.population_prior if n == 0 else float(np.mean(recent_hourly_kwh[:min(n, 24)]))

        # Lags extraction (with graceful fallback for cold-start periods)
        lag_1h = recent_hourly_kwh[0] if n >= 1 else fallback
        lag_2h = recent_hourly_kwh[1] if n >= 2 else lag_1h
        lag_24h = recent_hourly_kwh[23] if n >= 24 else fallback
        lag_168h = recent_hourly_kwh[167] if n >= 168 else (lag_24h if n >= 24 else fallback)

        # 6-Hour Rolling Statistics
        if n >= 2:
            slice_6 = recent_hourly_kwh[:min(n, 6)]
            rolling_mean_6h = float(np.mean(slice_6))
            rolling_std_6h = float(np.std(slice_6)) if len(slice_6) > 1 else 0.05
        else:
            rolling_mean_6h = fallback
            rolling_std_6h = 0.05

        # 24-Hour Rolling Statistics
        if n >= 6:
            slice_24 = recent_hourly_kwh[:min(n, 24)]
            rolling_mean_24h = float(np.mean(slice_24))
            rolling_std_24h = float(np.std(slice_24))
        else:
            rolling_mean_24h = fallback
            rolling_std_24h = 0.08

        # Exponential Moving Averages
        ewma_fast = fallback
        ewma_slow = fallback
        if n > 0:
            # Compute online backwards from oldest in slice
            rev = list(reversed(recent_hourly_kwh[:min(n, 48)]))
            f_val = rev[0]
            s_val = rev[0]
            for val in rev[1:]:
                f_val = 0.5 * val + 0.5 * f_val
                s_val = 0.2 * val + 0.8 * s_val
            ewma_fast = f_val
            ewma_slow = s_val

        # Same Weekday & Hour Historical Anchor (e.g. key: "dow_hour" -> "0_14")
        key = f"{dow}_{hour}"
        same_weekday_hour_avg = fallback
        if historical_weekday_hour_matrix and key in historical_weekday_hour_matrix:
            same_weekday_hour_avg = historical_weekday_hour_matrix[key]

        return ConsumptionFeatures(
            meter_id=meter_id,
            target_timestamp=ts,
            hour=hour,
            day_of_week=dow,
            is_weekend=is_weekend,
            sin_hour=round(sin_hour, 5),
            cos_hour=round(cos_hour, 5),
            sin_dow=round(sin_dow, 5),
            cos_dow=round(cos_dow, 5),
            lag_1h=round(float(lag_1h), 4),
            lag_2h=round(float(lag_2h), 4),
            lag_24h=round(float(lag_24h), 4),
            lag_168h=round(float(lag_168h), 4),
            rolling_mean_6h=round(float(rolling_mean_6h), 4),
            rolling_std_6h=round(float(rolling_std_6h), 4),
            rolling_mean_24h=round(float(rolling_mean_24h), 4),
            rolling_std_24h=round(float(rolling_std_24h), 4),
            ewma_fast=round(float(ewma_fast), 4),
            ewma_slow=round(float(ewma_slow), 4),
            same_weekday_hour_avg=round(float(same_weekday_hour_avg), 4),
            sample_count=n
        )
