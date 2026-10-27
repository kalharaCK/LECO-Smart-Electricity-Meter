"""
EWMA + Adaptive 1D Kalman Filter Model
Rapid-convergence baseline for Day 1 cold starts.
Maintains 24 hourly Kalman filters to track diurnal consumption profiles without lag.
"""

from typing import Dict, Any, List
import math
from .base import OnlineRegressorBase


class HourlyKalmanCell:
    """1D Adaptive Kalman filter tracking true mean for a specific hour of day."""

    def __init__(self, initial_state: float = 0.35, initial_variance: float = 1.0):
        self.x: float = initial_state      # Estimated true mean consumption
        self.P: float = initial_variance   # Estimation error covariance
        self.Q: float = 0.02              # Process noise variance
        self.R: float = 0.05              # Measurement noise variance

    def predict(self) -> float:
        # State extrapolation (random walk assumption)
        self.P = self.P + self.Q
        return max(0.01, self.x)

    def update(self, y: float) -> None:
        # Measurement update
        y = max(0.0, float(y))
        K = self.P / (self.P + self.R)
        self.x = self.x + K * (y - self.x)
        self.P = (1.0 - K) * self.P


class EwmaKalmanModel(OnlineRegressorBase):
    """
    Hybrid EWMA + 24-Hour Diurnal Kalman Filter.
    Provides fast, responsive tracking even with 3-5 initial readings.
    """

    def __init__(self, name: str = "EWMA_Kalman", default_kwh: float = 0.35):
        super().__init__(name)
        self.default_kwh = default_kwh
        self.ewma_state: float = default_kwh
        self.alpha: float = 0.3  # EWMA smoothing factor
        # 24 hour-specific Kalman filters
        self.hourly_filters: List[HourlyKalmanCell] = [
            HourlyKalmanCell(default_kwh, 1.0) for _ in range(24)
        ]

    def predict_one(self, x: Dict[str, float]) -> float:
        hour = int(x.get("hour", 0)) % 24
        # Get Kalman prediction for this hour
        kalman_pred = self.hourly_filters[hour].predict()

        # Combine with recent EWMA and same-weekday anchor
        ewma_pred = x.get("ewma_fast", self.ewma_state)
        same_anchor = x.get("same_weekday_hour_avg", kalman_pred)

        if self.sample_count < 24:
            # Cold start: rely primarily on Kalman tracking
            pred = 0.70 * kalman_pred + 0.30 * ewma_pred
        else:
            # Experienced: blend Kalman with same-weekday anchor
            pred = 0.50 * kalman_pred + 0.30 * same_anchor + 0.20 * ewma_pred

        return max(0.01, round(float(pred), 4))

    def learn_one(self, x: Dict[str, float], y: float) -> None:
        y = max(0.0, float(y))
        hour = int(x.get("hour", 0)) % 24

        # Update Kalman cell for this hour
        self.hourly_filters[hour].update(y)

        # Update global EWMA
        self.ewma_state = (self.alpha * y) + ((1.0 - self.alpha) * self.ewma_state)
        self.sample_count += 1

    def get_state(self) -> Dict[str, Any]:
        base = super().get_state()
        base.update({
            "ewma_state": round(self.ewma_state, 4),
            "hourly_estimates": [round(f.x, 3) for f in self.hourly_filters]
        })
        return base
