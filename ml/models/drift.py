"""
Concept Drift Detection with ADWIN (Adaptive Windowing)
Continuously monitors out-of-sample prediction error streams.
Triggers adaptation when consumption behavior changes fundamentally.
"""

from typing import Dict, Any, Optional, Callable
import logging

try:
    from river import drift
    RIVER_DRIFT_AVAILABLE = True
except ImportError:
    RIVER_DRIFT_AVAILABLE = False

logger = logging.getLogger("LECO_ML.drift")


class DriftDetector:
    """
    Online Concept Drift Detector using ADWIN algorithm.
    Tracks residual error distribution and signals when the consumer's
    energy consumption pattern has structurally shifted.
    """

    def __init__(self, delta: float = 0.002, clock: int = 32):
        self.delta = delta
        self.clock = clock
        self.total_evaluations: int = 0
        self.drift_count: int = 0
        self.last_drift_detected: bool = False

        if RIVER_DRIFT_AVAILABLE:
            self.adwin = drift.ADWIN(delta=delta, clock=clock)
        else:
            self.adwin = None
            self._error_history = []

    def update(self, absolute_error: float) -> bool:
        """
        Updates detector with a new out-of-sample residual error |actual - predicted|.
        Returns True if a concept drift was statistically confirmed.
        """
        self.total_evaluations += 1
        drift_detected = False

        if RIVER_DRIFT_AVAILABLE and self.adwin is not None:
            self.adwin.update(float(absolute_error))
            if self.adwin.drift_detected:
                drift_detected = True
        else:
            # Native lightweight sliding window CUSUM fallback
            self._error_history.append(float(absolute_error))
            if len(self._error_history) > 64:
                self._error_history.pop(0)
                mean_first_half = sum(self._error_history[:32]) / 32.0
                mean_second_half = sum(self._error_history[32:]) / 32.0
                if abs(mean_second_half - mean_first_half) > 0.45:
                    drift_detected = True
                    self._error_history.clear()

        if drift_detected:
            self.drift_count += 1
            self.last_drift_detected = True
            logger.warning(
                f"Concept Drift Detected! Drift #{self.drift_count} after {self.total_evaluations} evaluations."
            )
        else:
            self.last_drift_detected = False

        return drift_detected

    def reset(self) -> None:
        """Resets the detector state."""
        if RIVER_DRIFT_AVAILABLE and self.adwin is not None:
            self.adwin = drift.ADWIN(delta=self.delta, clock=self.clock)
        else:
            self._error_history = []
        self.last_drift_detected = False

    def get_status(self) -> Dict[str, Any]:
        width = getattr(self.adwin, "width", 0) if self.adwin else 0
        variance = getattr(self.adwin, "variance", 0.0) if self.adwin else 0.0
        return {
            "total_evaluations": self.total_evaluations,
            "drift_count": self.drift_count,
            "last_drift_detected": self.last_drift_detected,
            "window_width": width,
            "estimation_variance": round(variance, 4) if isinstance(variance, (int, float)) else 0.0
        }
