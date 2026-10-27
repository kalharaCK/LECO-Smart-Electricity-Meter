"""
Adaptive Online Ensemble Model
Combines EWMA+Kalman, Online Linear Regression, and Adaptive Random Forest
using dynamic softmax loss weighting, ADWIN concept drift monitoring,
and residual calibration for uncertainty intervals.
"""

from typing import Dict, Any, Tuple, Optional
import math
import numpy as np
import logging
from .ewma_kalman import EwmaKalmanModel
from .online_linear import OnlineLinearModel
from .adaptive_random_forest import AdaptiveForestModel
from .drift import DriftDetector

logger = logging.getLogger("LECO_ML.ensemble")


class AdaptiveEnsemble:
    """
    Adaptive Ensemble orchestrator for smart electricity meter online learning.
    Manages cold start progression, dynamic error weighting, and uncertainty estimation.
    """

    def __init__(
        self,
        meter_id: int,
        learning_rate: float = 0.15,
        smoothing_factor: float = 0.85,
        default_kwh: float = 0.35
    ):
        self.meter_id = meter_id
        self.learning_rate = learning_rate
        self.smoothing_factor = smoothing_factor
        self.default_kwh = default_kwh

        # Sub-models
        self.model_ewma_kalman = EwmaKalmanModel("EWMA_Kalman", default_kwh)
        self.model_linear = OnlineLinearModel("Online_Linear_SGD")
        self.model_forest = AdaptiveForestModel("Adaptive_Random_Forest")

        # ADWIN Concept Drift Detector
        self.drift_detector = DriftDetector(delta=0.002, clock=32)

        # Dynamic Weights (sum to 1.0)
        self.weights: Dict[str, float] = {
            "ewma_kalman": 0.60,
            "online_linear": 0.20,
            "adaptive_forest": 0.20
        }

        # Running Exponential Smoothed Losses (MAE per model)
        self.smoothed_loss: Dict[str, float] = {
            "ewma_kalman": 0.15,
            "online_linear": 0.15,
            "adaptive_forest": 0.15
        }

        # Uncertainty Estimation: running residual variance
        self.residual_variance: float = 0.04  # std approx 0.20 kWh
        self.uncertainty_decay: float = 0.90

        # Performance Metrics & Statistics
        self.total_evaluations: int = 0
        self.cumulative_abs_error: float = 0.0
        self.cumulative_sq_error: float = 0.0
        self.cumulative_pct_error: float = 0.0

        # Drift Status
        self.last_drift_detected: bool = False
        self.drift_penalty_countdown: int = 0

    @property
    def cold_start_stage(self) -> str:
        """Determines active operational stage based on evaluated samples."""
        n = self.total_evaluations
        if n < 3:
            return "NO_HISTORY"
        elif n <= 24:
            return "FIRST_24_HOURS"
        elif n <= 168:
            return "DAYS_2_TO_7"
        elif n <= 720:
            return "DAYS_7_TO_30"
        else:
            return "MATURE_STREAM"

    def predict(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Generates ensemble prediction before observing actual target outcome.
        Returns predicted_kwh, lower_bound, upper_bound, uncertainty_score, and component predictions.
        """
        p_ewma = self.model_ewma_kalman.predict_one(features)
        p_linear = self.model_linear.predict_one(features)
        p_forest = self.model_forest.predict_one(features)

        stage = self.cold_start_stage

        if stage == "NO_HISTORY":
            # Return baseline population prior with wide uncertainty
            predicted_kwh = self.default_kwh
            uncertainty_score = 1.0
            sigma = 0.35
        elif stage == "FIRST_24_HOURS":
            # Days 1: Rely 100% on EWMA + Kalman baseline
            predicted_kwh = p_ewma
            uncertainty_score = 0.70
            sigma = math.sqrt(max(0.01, self.residual_variance)) * 1.5
        elif stage == "DAYS_2_TO_7":
            # Days 2-7: Blend Kalman with Online Linear
            w_ewma = 0.60
            w_linear = 0.40
            predicted_kwh = (w_ewma * p_ewma) + (w_linear * p_linear)
            uncertainty_score = 0.45
            sigma = math.sqrt(max(0.005, self.residual_variance)) * 1.25
        else:
            # Days 7+: Full adaptive weighted ensemble
            predicted_kwh = (
                (self.weights["ewma_kalman"] * p_ewma) +
                (self.weights["online_linear"] * p_linear) +
                (self.weights["adaptive_forest"] * p_forest)
            )
            uncertainty_score = min(1.0, max(0.05, math.sqrt(self.residual_variance) / max(0.1, predicted_kwh)))
            sigma = math.sqrt(max(0.002, self.residual_variance))

        # Widen uncertainty if concept drift was recently detected
        if self.drift_penalty_countdown > 0:
            sigma *= 1.4
            uncertainty_score = min(1.0, uncertainty_score * 1.3)

        predicted_kwh = max(0.01, round(float(predicted_kwh), 4))
        lower_bound = max(0.0, round(predicted_kwh - 1.96 * sigma, 4))
        upper_bound = round(predicted_kwh + 1.96 * sigma, 4)

        return {
            "predicted_kwh": predicted_kwh,
            "lower_bound_kwh": lower_bound,
            "upper_bound_kwh": upper_bound,
            "uncertainty_score": round(float(uncertainty_score), 3),
            "cold_start_stage": stage,
            "components": {
                "ewma_kalman": round(float(p_ewma), 4),
                "online_linear": round(float(p_linear), 4),
                "adaptive_forest": round(float(p_forest), 4)
            },
            "weights": {k: round(v, 4) for k, v in self.weights.items()}
        }

    def evaluate_and_learn(
        self,
        features: Dict[str, float],
        actual_y: float,
        prior_prediction: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Prequential Step:
        1. Evaluates prior prediction against newly observed actual y.
        2. Updates ADWIN drift detector with residual error.
        3. Updates model losses and adaptive weights via Softmax.
        4. NOW calls learn_one on all sub-models (never training before evaluating).
        """
        actual = max(0.0, float(actual_y))

        # Individual model predictions for loss calculation
        pred_ewma = self.model_ewma_kalman.predict_one(features)
        pred_linear = self.model_linear.predict_one(features)
        pred_forest = self.model_forest.predict_one(features)

        ensemble_pred = prior_prediction if prior_prediction is not None else self.predict(features)["predicted_kwh"]
        residual = abs(actual - ensemble_pred)

        # 1. Update Metrics
        self.total_evaluations += 1
        self.cumulative_abs_error += residual
        self.cumulative_sq_error += (residual ** 2)
        pct_err = (residual / actual) if actual > 0.05 else 0.0
        self.cumulative_pct_error += min(3.0, pct_err)  # bounded MAPE

        # 2. Update Residual Variance for Uncertainty
        self.residual_variance = (
            self.uncertainty_decay * self.residual_variance +
            (1.0 - self.uncertainty_decay) * (residual ** 2)
        )

        # 3. Update Model Exponential Losses
        loss_ewma = abs(actual - pred_ewma)
        loss_linear = abs(actual - pred_linear)
        loss_forest = abs(actual - pred_forest)

        beta = self.smoothing_factor
        self.smoothed_loss["ewma_kalman"] = beta * self.smoothed_loss["ewma_kalman"] + (1.0 - beta) * loss_ewma
        self.smoothed_loss["online_linear"] = beta * self.smoothed_loss["online_linear"] + (1.0 - beta) * loss_linear
        self.smoothed_loss["adaptive_forest"] = beta * self.smoothed_loss["adaptive_forest"] + (1.0 - beta) * loss_forest

        # 4. Update Dynamic Softmax Weights: w_i = exp(-eta * L_i) / sum
        eta = self.learning_rate
        # If adapting after drift, increase eta for faster adaptation
        if self.drift_penalty_countdown > 0:
            eta *= 2.0
            self.drift_penalty_countdown -= 1

        exp_ewma = math.exp(-eta * self.smoothed_loss["ewma_kalman"])
        exp_linear = math.exp(-eta * self.smoothed_loss["online_linear"])
        exp_forest = math.exp(-eta * self.smoothed_loss["adaptive_forest"])
        total_exp = exp_ewma + exp_linear + exp_forest

        self.weights["ewma_kalman"] = exp_ewma / total_exp
        self.weights["online_linear"] = exp_linear / total_exp
        self.weights["adaptive_forest"] = exp_forest / total_exp

        # 5. Concept Drift Detection with ADWIN
        drift_detected = self.drift_detector.update(residual)
        if drift_detected:
            self.last_drift_detected = True
            self.drift_penalty_countdown = 24  # next 24 updates operate in high-vigilance mode
            # Downweight historical smoothed loss to accelerate adaptation
            for k in self.smoothed_loss:
                self.smoothed_loss[k] *= 0.5
            logger.info(f"Meter {self.meter_id}: ADWIN Drift triggered. Weights & learning rates adapted.")
        else:
            self.last_drift_detected = False

        # 6. Incrementally train each sub-model with newly observed target
        self.model_ewma_kalman.learn_one(features, actual)
        if self.total_evaluations >= 24:
            self.model_linear.learn_one(features, actual)
        if self.total_evaluations >= 168:
            self.model_forest.learn_one(features, actual)

        mae = self.cumulative_abs_error / self.total_evaluations
        rmse = math.sqrt(self.cumulative_sq_error / self.total_evaluations)
        mape = (self.cumulative_pct_error / self.total_evaluations) * 100.0

        return {
            "meter_id": self.meter_id,
            "evaluated_sample": self.total_evaluations,
            "actual_kwh": actual,
            "predicted_kwh": ensemble_pred,
            "residual_error": round(residual, 4),
            "drift_detected": drift_detected,
            "current_weights": {k: round(v, 4) for k, v in self.weights.items()},
            "evaluation_metrics": {
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "mape_percent": round(mape, 2)
            }
        }

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive diagnostic state."""
        n = max(1, self.total_evaluations)
        return {
            "meter_id": self.meter_id,
            "sample_count": self.total_evaluations,
            "cold_start_stage": self.cold_start_stage,
            "weights": {k: round(v, 4) for k, v in self.weights.items()},
            "metrics": {
                "mae": round(self.cumulative_abs_error / n, 4),
                "rmse": round(math.sqrt(self.cumulative_sq_error / n), 4),
                "mape_percent": round((self.cumulative_pct_error / n) * 100.0, 2)
            },
            "adwin_status": self.drift_detector.get_status(),
            "residual_variance": round(self.residual_variance, 5)
        }
