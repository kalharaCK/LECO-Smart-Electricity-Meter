"""
Telemetry Aggregator
Groups 30-45s incoming pulse readings into 15-minute and 1-hour energy intervals.
Emits finalized hourly energy consumption events for feature extraction and model updates.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import math
import logging
from .validator import ValidatedReading

logger = logging.getLogger("LECO_ML.aggregator")


class HourlyAggregate(BaseException if False else object):
    def __init__(self, meter_id: int, period_start: datetime):
        self.meter_id = meter_id
        self.period_start = period_start.replace(minute=0, second=0, microsecond=0)
        self.total_kwh: float = 0.0
        self.peak_kw: float = 0.0
        self.reading_count: int = 0
        self.last_timestamp: datetime = period_start
        self.is_finalized: bool = False

    def add_reading(self, reading: ValidatedReading) -> None:
        if not reading.is_valid or reading.is_duplicate:
            return

        self.total_kwh += reading.delta_kwh
        self.reading_count += 1
        self.last_timestamp = reading.timestamp

        # Estimate instantaneous power in kW: kW = (delta_kwh / (elapsed_seconds / 3600))
        if reading.elapsed_seconds > 0:
            instant_kw = (reading.delta_kwh / (reading.elapsed_seconds / 3600.0))
            if instant_kw > self.peak_kw and instant_kw < 100.0:
                self.peak_kw = instant_kw

    def to_dict(self) -> Dict[str, Any]:
        hour = self.period_start.hour
        dow = self.period_start.weekday()  # 0=Monday, 6=Sunday
        is_weekend = dow in (5, 6)

        return {
            "meter_id": self.meter_id,
            "period_start": self.period_start,
            "period_hour": hour,
            "period_day_of_week": dow,
            "is_weekend": is_weekend,
            "total_kwh": round(self.total_kwh, 4),
            "peak_kw": round(self.peak_kw, 3),
            "reading_count": self.reading_count
        }


class TelemetryAggregator:
    """
    In-memory window aggregator for incoming meter streams.
    Tracks currently open hourly bins and detects when an hour has completed.
    """

    def __init__(self):
        # { meter_id: HourlyAggregate }
        self._current_hourly_bins: Dict[int, HourlyAggregate] = {}

    def process_reading(self, reading: ValidatedReading) -> Optional[Dict[str, Any]]:
        """
        Processes reading into the meter's current hourly bin.
        If a new hour has commenced, the previous hour is finalized and returned.
        """
        if not reading.is_valid or reading.is_duplicate:
            return None

        meter_id = reading.meter_id
        reading_hour_start = reading.timestamp.replace(minute=0, second=0, microsecond=0)

        current_bin = self._current_hourly_bins.get(meter_id)
        finalized_data = None

        if current_bin is None:
            # Initialize bin for new meter
            self._current_hourly_bins[meter_id] = HourlyAggregate(meter_id, reading_hour_start)
            self._current_hourly_bins[meter_id].add_reading(reading)
        elif current_bin.period_start == reading_hour_start:
            # Accumulate within current hour
            current_bin.add_reading(reading)
        elif reading_hour_start > current_bin.period_start:
            # Previous hour finalized!
            current_bin.is_finalized = True
            finalized_data = current_bin.to_dict()
            logger.info(
                f"Meter {meter_id}: Finalized hourly bin for {current_bin.period_start} "
                f"with {current_bin.total_kwh:.3f} kWh over {current_bin.reading_count} pulses."
            )
            # Roll over to new hour
            new_bin = HourlyAggregate(meter_id, reading_hour_start)
            new_bin.add_reading(reading)
            self._current_hourly_bins[meter_id] = new_bin

        return finalized_data

    def get_current_in_progress(self, meter_id: int) -> Optional[Dict[str, Any]]:
        """Returns the in-progress aggregate for the current unfinalized hour."""
        current_bin = self._current_hourly_bins.get(meter_id)
        return current_bin.to_dict() if current_bin else None
