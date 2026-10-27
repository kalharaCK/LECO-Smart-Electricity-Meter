"""
Unit tests for ForecastEngine, PrepaidLifetimeEngine, PostpaidBillEngine, and RechargeDemandEngine.
"""

from datetime import datetime, timezone
from ml.models.ensemble import AdaptiveEnsemble
from ml.engines.forecast_engine import ForecastEngine
from ml.engines.prepaid_engine import PrepaidLifetimeEngine
from ml.engines.postpaid_engine import PostpaidBillEngine
from ml.engines.recharge_engine import RechargeDemandEngine


def test_forecast_engine_generates_24h_series():
    ensemble = AdaptiveEnsemble(meter_id=10)
    engine = ForecastEngine()
    now = datetime(2026, 10, 27, 8, 0, 0, tzinfo=timezone.utc)

    res = engine.forecast_next_24h(
        ensemble=ensemble,
        current_timestamp=now,
        recent_hourly_kwh=[0.35] * 24
    )

    assert res["forecast_type"] == "NEXT_24_HOURS"
    assert len(res["hourly_trajectory"]) == 24
    assert res["total_predicted_24h_kwh"] > 0.0

    for step in res["hourly_trajectory"]:
        assert step["lower_bound_kwh"] <= step["predicted_kwh"] <= step["upper_bound_kwh"]
        assert 0.0 <= step["uncertainty_score"] <= 1.0


def test_prepaid_lifetime_engine_simulates_depletion():
    ensemble = AdaptiveEnsemble(meter_id=11)
    engine = PrepaidLifetimeEngine()
    now = datetime(2026, 10, 27, 8, 0, 0, tzinfo=timezone.utc)

    # 1. Zero balance -> immediate exhaustion
    res_zero = engine.simulate_depletion(ensemble, current_balance=0.0, base_timestamp=now)
    assert res_zero["expected_remaining_days"] == 0.0
    assert res_zero["status"] == "EXHAUSTED"

    # 2. Positive balance -> positive lifetime
    res_pos = engine.simulate_depletion(
        ensemble=ensemble,
        current_balance=2500.0,
        current_cycle_kwh=30.0,
        current_cycle_day=10,
        recent_hourly_kwh=[0.40] * 24,
        base_timestamp=now
    )

    assert res_pos["expected_remaining_hours"] > 0
    assert res_pos["expected_remaining_days"] > 0.0
    # Conservative scenario should deplete faster or equal to median
    assert res_pos["conservative_remaining_days"] <= res_pos["expected_remaining_days"]
    assert "predicted_exhaustion_time" in res_pos


def test_postpaid_bill_engine_forecasts():
    ensemble = AdaptiveEnsemble(meter_id=12)
    engine = PostpaidBillEngine()

    res = engine.forecast_bill(
        ensemble=ensemble,
        already_consumed_kwh=50.0,
        current_cycle_day=15,
        daily_kwh_average=3.5,
        next_24h_kwh=3.4
    )

    assert res["actual_consumed_kwh"] == 50.0
    assert res["predicted_remaining_kwh"] > 0.0
    assert res["predicted_total_monthly_kwh"] > 50.0
    assert res["predicted_bill_lkr"] > 0.0
    assert res["lower_bound_bill_lkr"] <= res["predicted_bill_lkr"] <= res["upper_bound_bill_lkr"]


def test_recharge_demand_engine_advises():
    ensemble = AdaptiveEnsemble(meter_id=13)
    engine = RechargeDemandEngine()

    res = engine.predict_next_month_demand(
        ensemble=ensemble,
        current_balance=500.0,
        daily_kwh_average=4.0,
        previous_cycle_kwh=120.0
    )

    assert res["predicted_next_month_kwh"] > 0.0
    assert res["expected_electricity_cost_lkr"] > 0.0
    assert res["recommended_recharge_lkr"] >= 0.0
    assert res["trend"] in ("INCREASING", "STABLE", "DECREASING")
