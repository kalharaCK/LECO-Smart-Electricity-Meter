"""
Unit tests for online regression models, ADWIN drift detection, and the adaptive ensemble.
"""

from ml.models.ewma_kalman import EwmaKalmanModel
from ml.models.online_linear import OnlineLinearModel
from ml.models.adaptive_random_forest import AdaptiveForestModel
from ml.models.drift import DriftDetector
from ml.models.ensemble import AdaptiveEnsemble


def test_ewma_kalman_model_adapts():
    model = EwmaKalmanModel("EWMA_Kalman", default_kwh=0.35)
    feat = {"hour": 10, "ewma_fast": 0.35, "same_weekday_hour_avg": 0.35}

    p0 = model.predict_one(feat)
    assert p0 > 0.0

    # Feed higher consumption series (0.80 kWh)
    for _ in range(10):
        model.learn_one(feat, 0.80)

    p1 = model.predict_one(feat)
    # Model should have learned and shifted upward toward 0.80
    assert p1 > p0


def test_online_linear_learns():
    model = OnlineLinearModel("SGD_Linear")
    feat = {"hour": 12.0, "is_weekend": 0.0, "lag_1h": 0.50}

    # Verify predict and learn loop
    p = model.predict_one(feat)
    assert p > 0.0
    model.learn_one(feat, 0.55)
    assert model.sample_count == 1


def test_adaptive_forest_learns():
    model = AdaptiveForestModel("Hoeffding_Forest")
    feat = {"hour": 18.0, "is_weekend": 1.0, "lag_1h": 1.20}

    p = model.predict_one(feat)
    assert p > 0.0
    model.learn_one(feat, 1.25)
    assert model.sample_count == 1


def test_drift_detector_triggers_on_shift():
    detector = DriftDetector(delta=0.01, clock=8)
    # Stream small stationary errors
    for _ in range(40):
        detector.update(0.05)

    assert detector.drift_count == 0

    # Inject sudden massive error shift
    drift_seen = False
    for _ in range(60):
        if detector.update(2.50):
            drift_seen = True
            break

    assert drift_seen or detector.drift_count > 0


def test_adaptive_ensemble_weights_and_uncertainty():
    ensemble = AdaptiveEnsemble(meter_id=1, learning_rate=0.20)
    feat = {"hour": 8.0, "is_weekend": 0.0, "lag_1h": 0.40, "ewma_fast": 0.40}

    # 1. Cold start stage 0
    assert ensemble.cold_start_stage == "NO_HISTORY"
    res0 = ensemble.predict(feat)
    assert res0["uncertainty_score"] == 1.0
    assert res0["predicted_kwh"] > 0.0

    # 2. Prequential evaluation step: test-then-train
    eval_res = ensemble.evaluate_and_learn(feat, actual_y=0.42, prior_prediction=res0["predicted_kwh"])
    assert eval_res["residual_error"] == abs(0.42 - res0["predicted_kwh"])
    assert ensemble.total_evaluations == 1

    # Verify weights sum to 1.0
    total_w = sum(ensemble.weights.values())
    assert abs(total_w - 1.0) < 1e-4
