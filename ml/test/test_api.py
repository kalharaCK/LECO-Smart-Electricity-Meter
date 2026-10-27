"""
Unit tests for FastAPI endpoints using TestClient.
"""

from fastapi.testclient import TestClient
from datetime import datetime, timezone
from ml.main import app

client = TestClient(app)


def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
    assert "version" in data


def test_health_endpoint():
    res = client.get("/api/ml/health")
    assert res.status_code == 200
    data = res.json()
    assert "service" in data
    assert "ml_engine" in data
    assert "cold_start_stages" in data["ml_engine"]


def test_telemetry_ingest_endpoint():
    payload = {
        "meter_id": 999,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cumulative_kwh": 125.40,
        "prepaid_balance": 1850.0,
        "connection_type": "prepaid",
        "tariff_id": "DOMESTIC_D1",
        "billing_cycle_day": 10,
        "voltage": 230.5,
        "current_amps": 4.2,
        "power_factor": 0.96
    }
    res = client.post("/api/ml/telemetry/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACCEPTED"
    assert data["meter_id"] == 999
    assert data["is_valid"] is True


def test_forecast_endpoints():
    # 1. Hourly forecast
    res_h = client.get("/api/ml/forecast/hourly/999")
    assert res_h.status_code == 200
    d_h = res_h.json()
    assert d_h["forecast_type"] == "NEXT_24_HOURS"
    assert len(d_h["hourly_trajectory"]) == 24

    # 2. Prepaid lifetime
    res_p = client.get("/api/ml/forecast/prepaid/999?balance=1500")
    assert res_p.status_code == 200
    d_p = res_p.json()
    assert d_p["expected_remaining_hours"] > 0
    assert "predicted_exhaustion_time" in d_p

    # 3. Postpaid forecast
    res_post = client.get("/api/ml/forecast/postpaid/999")
    assert res_post.status_code == 200
    d_post = res_post.json()
    assert d_post["predicted_bill_lkr"] > 0

    # 4. Demand forecast
    res_dem = client.get("/api/ml/forecast/demand/999")
    assert res_dem.status_code == 200
    d_dem = res_dem.json()
    assert d_dem["predicted_next_month_kwh"] > 0


def test_model_status_endpoint():
    res = client.get("/api/ml/models/status/999")
    assert res.status_code == 200
    data = res.json()
    assert data["meter_id"] == 999
    assert "weights" in data
    assert "cold_start_stage" in data
