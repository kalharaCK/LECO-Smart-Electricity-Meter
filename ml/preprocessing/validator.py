"""
Telemetry Validation and Delta Preprocessor
Enforces duplicate detection, meter reset detection, missing telemetry gap resolution,
and cumulative kWh difference calculation.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import logging

logger = logging.getLogger("LECO_ML.validator")


class RawTelemetryInput(BaseModel):
    meter_id: int
    timestamp: datetime
    cumulative_kwh: float
    prepaid_balance: Optional[float] = None
    connection_type: str = "prepaid"  # "prepaid" or "postpaid"
    tariff_id: str = "DOMESTIC_D1"
    billing_cycle_day: int = 1
    voltage: Optional[float] = 230.0
    current_amps: Optional[float] = 0.0
    power_factor: Optional[float] = 0.95


class ValidatedReading(BaseModel):
    meter_id: int
    timestamp: datetime
    cumulative_kwh: float
    delta_kwh: float
    elapsed_seconds: float
    is_valid: bool
    is_duplicate: bool = False
    is_meter_reset: bool = False
    has_gap: bool = False
    prepaid_balance: Optional[float] = None
    connection_type: str = "prepaid"
    tariff_id: str = "DOMESTIC_D1"
    billing_cycle_day: int = 1
    voltage: float = 230.0
    current_amps: float = 0.0
    power_factor: float = 0.95
    flags: Dict[str, Any] = Field(default_factory=dict)


class TelemetryValidator:
    """
    Validates streaming telemetry from smart electricity meters.
    Maintains in-memory and database last-known states to calculate continuous delta_kwh.
    """

    def __init__(self, expected_interval_seconds: int = 30):
        self.expected_interval = expected_interval_seconds
        # In-memory cache of last reading per meter_id: { meter_id: (timestamp, cumulative_kwh) }
        self._last_readings: Dict[int, Dict[str, Any]] = {}

    def set_last_known(self, meter_id: int, timestamp: datetime, cumulative_kwh: float) -> None:
        """Hydrates the last known reading (e.g., from DB on startup)."""
        self._last_readings[meter_id] = {
            "timestamp": timestamp,
            "cumulative_kwh": float(cumulative_kwh)
        }

    def validate_and_compute_delta(self, raw: RawTelemetryInput) -> ValidatedReading:
        """
        Validates incoming pulse, detects duplicates and resets,
        and computes delta_kwh = max(0, current - previous).
        """
        ts = raw.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        current_cum = max(0.0, float(raw.cumulative_kwh))
        last_state = self._last_readings.get(raw.meter_id)

        flags: Dict[str, Any] = {}
        is_duplicate = False
        is_meter_reset = False
        has_gap = False
        delta_kwh = 0.0
        elapsed_seconds = float(self.expected_interval)

        # Voltage & Grid sanity bounds (Nominal Sri Lanka 230V +/- 15%)
        voltage = float(raw.voltage) if raw.voltage is not None else 230.0
        if voltage < 160.0 or voltage > 280.0:
            flags["voltage_anomaly"] = f"Voltage {voltage}V outside safe grid range [160-280V]"

        if last_state is not None:
            prev_ts = last_state["timestamp"]
            prev_cum = last_state["cumulative_kwh"]

            # Calculate elapsed time in seconds
            delta_time = (ts - prev_ts).total_seconds()

            if delta_time <= 0:
                # 1. Duplicate detection
                is_duplicate = True
                flags["duplicate"] = f"Timestamp {ts} <= previous timestamp {prev_ts}"
                logger.warning(f"Meter {raw.meter_id}: Duplicate or out-of-order pulse at {ts}.")
                return ValidatedReading(
                    meter_id=raw.meter_id,
                    timestamp=ts,
                    cumulative_kwh=current_cum,
                    delta_kwh=0.0,
                    elapsed_seconds=0.0,
                    is_valid=False,
                    is_duplicate=True,
                    prepaid_balance=raw.prepaid_balance,
                    connection_type=raw.connection_type,
                    tariff_id=raw.tariff_id,
                    billing_cycle_day=raw.billing_cycle_day,
                    flags=flags
                )

            elapsed_seconds = delta_time

            # 2. Missing data gap detection (gap > 2x expected telemetry frequency)
            if delta_time > (self.expected_interval * 2.0):
                has_gap = True
                flags["telemetry_gap"] = f"Gap of {delta_time:.1f}s (> 2x normal {self.expected_interval}s)"
                logger.info(f"Meter {raw.meter_id}: Telemetry gap detected ({delta_time:.1f}s offline).")

            # 3. Meter reset / rollback detection
            if current_cum < prev_cum:
                is_meter_reset = True
                flags["meter_reset"] = (
                    f"Cumulative kWh dropped from {prev_cum:.3f} to {current_cum:.3f}. "
                    "Detected hardware rollover or replacement."
                )
                logger.warning(f"Meter {raw.meter_id}: Hardware meter reset detected!")
                # Reset delta: treat current value as incremental from 0 or preserve integrity
                delta_kwh = current_cum
            else:
                # 4. Standard cumulative delta computation
                delta_kwh = current_cum - prev_cum

            # Physics sanity check: Single household rarely consumes > 25 kWh in a 30-second window
            max_physible_pulse_kwh = (100.0 * 230.0 * (elapsed_seconds / 3600.0)) / 1000.0  # max 100A load
            if delta_kwh > max_physible_pulse_kwh and not is_meter_reset:
                flags["spike_anomaly"] = f"Delta {delta_kwh:.3f} kWh exceeds physical breaker capacity."
                # Cap to reasonable upper bound
                delta_kwh = min(delta_kwh, max_physible_pulse_kwh)

        else:
            # First observation of this meter session
            delta_kwh = 0.0
            flags["initial_sync"] = "First reading initialized in memory."

        # Never output negative delta
        delta_kwh = max(0.0, round(delta_kwh, 5))

        # Update last known state in cache
        self._last_readings[raw.meter_id] = {
            "timestamp": ts,
            "cumulative_kwh": current_cum
        }

        return ValidatedReading(
            meter_id=raw.meter_id,
            timestamp=ts,
            cumulative_kwh=current_cum,
            delta_kwh=delta_kwh,
            elapsed_seconds=elapsed_seconds,
            is_valid=True,
            is_duplicate=is_duplicate,
            is_meter_reset=is_meter_reset,
            has_gap=has_gap,
            prepaid_balance=raw.prepaid_balance,
            connection_type=raw.connection_type,
            tariff_id=raw.tariff_id,
            billing_cycle_day=raw.billing_cycle_day,
            voltage=voltage,
            current_amps=float(raw.current_amps or 0.0),
            power_factor=float(raw.power_factor or 0.95),
            flags=flags
        )
