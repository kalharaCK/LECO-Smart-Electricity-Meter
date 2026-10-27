"""
Adaptive Random Forest / Hoeffding Tree Regressor Model
Incremental tree-based online regression capturing non-linear interactions.
Activates during Days 7–30 when sufficient evaluated samples are available.
"""

from typing import Dict, Any
from .base import OnlineRegressorBase

try:
    from river import tree
    RIVER_TREE_AVAILABLE = True
except ImportError:
    RIVER_TREE_AVAILABLE = False


class AdaptiveForestModel(OnlineRegressorBase):
    """
    Adaptive Streaming Tree/Forest Regressor based on Hoeffding Tree theory.
    Splits nodes incrementally when statistical confidence guarantees
    that a split will improve MSE.
    """

    def __init__(self, name: str = "Adaptive_Random_Forest"):
        super().__init__(name)
        if RIVER_TREE_AVAILABLE:
            # HoeffdingTreeRegressor with grace period of 20 samples per check
            self.model = tree.HoeffdingTreeRegressor(
                grace_period=20,
                delta=1e-5,
                tau=0.05
            )
        else:
            self.model = None
            self._running_mean: float = 0.35

    def predict_one(self, x: Dict[str, float]) -> float:
        if RIVER_TREE_AVAILABLE and self.model is not None:
            pred = self.model.predict_one(x)
        else:
            pred = self._running_mean

        return max(0.01, round(float(pred or 0.35), 4))

    def learn_one(self, x: Dict[str, float], y: float) -> None:
        y = max(0.0, float(y))
        if RIVER_TREE_AVAILABLE and self.model is not None:
            self.model.learn_one(x, y)
        else:
            self._running_mean = 0.05 * y + 0.95 * self._running_mean

        self.sample_count += 1
