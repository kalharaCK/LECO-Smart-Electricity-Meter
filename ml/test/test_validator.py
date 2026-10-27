"""
Unit tests for TelemetryValidator and Preprocessing.
"""

from datetime import datetime, timezone, timedelta
from ml.preprocessing.validator import TelemetryValidator, RawTelemetryInput


def test_validator_computes_delta_properly():
    validator = TelemetryValidator(expected_interval_seconds=30)
    t0 = datetime(2026, 10, 27, 8, 0, 0, tzinfo=timezone.utc)

    # First pulse
    r1 = validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=1, timestamp=t0, cumulative_kwh=100.0
    ))
    assert r1.is_valid is True
    assert r1.delta_kwh == 0.0

    # Second pulse (30 seconds later, 0.05 kWh consumed)
    t1 = t0 + timedelta(seconds=30)
    r2 = validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=1, timestamp=t1, cumulative_kwh=100.05
    ))
    assert r2.is_valid is True
    assert r2.is_duplicate is False
    assert r2.delta_kwh == 0.05


def test_validator_detects_duplicates():
    validator = TelemetryValidator(expected_interval_seconds=30)
    t0 = datetime(2026, 10, 27, 8, 0, 0, tzinfo=timezone.utc)

    r1 = validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=2, timestamp=t0, cumulative_kwh=50.0
    ))
    assert r1.is_valid is True

    # Duplicate pulse with identical timestamp
    r2 = validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=2, timestamp=t0, cumulative_kwh=50.0
    ))
    assert r2.is_valid is False
    assert r2.is_duplicate is True
    assert r2.delta_kwh == 0.0


def test_validator_handles_hardware_meter_reset():
    validator = TelemetryValidator(expected_interval_seconds=30)
    t0 = datetime(2026, 10, 27, 8, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(seconds=30)

    validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=3, timestamp=t0, cumulative_kwh=9999.5
    ))

    # Meter counter rolled over or reset to 0.2
    r_reset = validator.validate_and_compute_delta(RawTelemetryInput(
        meter_id=3, timestamp=t1, cumulative_kwh=0.2
    ))
    assert r_reset.is_valid is True
    assert r_reset.is_meter_reset is True
    assert r_reset.delta_kwh >= 0.0  # never negative!
    assert "meter_reset" in r_reset.flags
