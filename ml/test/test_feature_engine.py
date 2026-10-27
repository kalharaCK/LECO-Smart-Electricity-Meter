"""
Unit tests for FeatureEngine.
"""

from datetime import datetime, timezone
from ml.features.feature_engine import FeatureEngine


def test_feature_extraction_cyclical_and_lags():
    engine = FeatureEngine(population_prior_kwh=0.35)
    # Target: Monday 14:00 (hour=14, dow=0)
    ts = datetime(2026, 10, 26, 14, 0, 0, tzinfo=timezone.utc)
    history = [0.40, 0.45, 0.50, 0.38, 0.35, 0.32] + [0.30] * 30

    feat = engine.extract_features(
        meter_id=1,
        target_timestamp=ts,
        recent_hourly_kwh=history,
        historical_weekday_hour_matrix={"0_14": 0.42}
    )

    assert feat.hour == 14
    assert feat.day_of_week == 0
    assert feat.is_weekend == 0.0
    assert feat.lag_1h == 0.40
    assert feat.lag_2h == 0.45
    assert feat.same_weekday_hour_avg == 0.42
    assert -1.0 <= feat.sin_hour <= 1.0
    assert -1.0 <= feat.cos_hour <= 1.0

    model_dict = feat.to_model_dict()
    assert "sin_hour" in model_dict
    assert "ewma_fast" in model_dict
    assert "rolling_mean_6h" in model_dict


def test_feature_engine_cold_start_fallback():
    engine = FeatureEngine(population_prior_kwh=0.35)
    ts = datetime(2026, 10, 26, 8, 0, 0, tzinfo=timezone.utc)

    # Completely empty history (Day 1, 0 samples)
    feat = engine.extract_features(meter_id=99, target_timestamp=ts, recent_hourly_kwh=[])
    assert feat.lag_1h == 0.35  # gracefully defaults to population prior
    assert feat.rolling_mean_6h == 0.35
    assert feat.same_weekday_hour_avg == 0.35
