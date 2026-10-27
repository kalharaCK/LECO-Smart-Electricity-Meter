"""
Base Abstract Class for Online Incremental Regressors.
Every model implements predict_one and learn_one (Prequential Paradigm).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class OnlineRegressorBase(ABC):
    """Abstract interface for streaming regressors."""

    def __init__(self, name: str):
        self.name = name
        self.sample_count: int = 0
        self.last_loss: float = 0.0

    @abstractmethod
    def predict_one(self, x: Dict[str, float]) -> float:
        """Generates out-of-sample prediction before observing actual y."""
        pass

    @abstractmethod
    def learn_one(self, x: Dict[str, float], y: float) -> None:
        """Incrementally updates model parameters with newly observed actual outcome."""
        pass

    def get_state(self) -> Dict[str, Any]:
        """Serializes model parameters for persistence."""
        return {
            "name": self.name,
            "sample_count": self.sample_count,
            "last_loss": round(self.last_loss, 4)
        }
