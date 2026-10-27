"""
Online Linear Regression Model
Incremental SGD with adaptive scaling and L2 regularization.
Activates during Days 2–7 as the hourly consumption baseline stabilizes.
"""

from typing import Dict, Any
from .base import OnlineRegressorBase

try:
    from river import linear_model, preprocessing, optim
    RIVER_AVAILABLE = True
except ImportError:
    RIVER_AVAILABLE = False


class OnlineLinearModel(OnlineRegressorBase):
    """
    Online Linear Regression model using River's pipeline
    with standard feature scaling and SGD optimizer.
    """

    def __init__(self, name: str = "Online_Linear_SGD"):
        super().__init__(name)
        if RIVER_AVAILABLE:
            self.model = (
                preprocessing.StandardScaler() |
                linear_model.LinearRegression(
                    optimizer=optim.SGD(lr=0.01),
                    l2=0.005,
                    intercept_lr=0.01
                )
            )
        else:
            self.model = None
            self._weights: Dict[str, float] = {}
            self._intercept: float = 0.35
            self._lr: float = 0.01

    def predict_one(self, x: Dict[str, float]) -> float:
        if RIVER_AVAILABLE and self.model is not None:
            pred = self.model.predict_one(x)
        else:
            # Native fallback SGD prediction
            pred = self._intercept + sum(self._weights.get(k, 0.0) * v for k, v in x.items())

        return max(0.01, round(float(pred or 0.35), 4))

    def learn_one(self, x: Dict[str, float], y: float) -> None:
        y = max(0.0, float(y))
        if RIVER_AVAILABLE and self.model is not None:
            self.model.learn_one(x, y)
        else:
            # Native fallback SGD update
            y_pred = self.predict_one(x)
            error = y - y_pred
            self._intercept += self._lr * error
            for k, v in x.items():
                w = self._weights.get(k, 0.0)
                self._weights[k] = w + self._lr * (error * v - 0.005 * w)

        self.sample_count += 1
