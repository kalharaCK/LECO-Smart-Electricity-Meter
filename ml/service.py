"""
ML Service State Manager & Core Orchestrator
Coordinates online ensembles per meter, manages persistence to Neon PostgreSQL,
and bridges telemetry streams with the prediction engines.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import json
import logging
from .config import settings
from .models.ensemble import AdaptiveEnsemble
from .preprocessing.validator import TelemetryValidator, RawTelemetryInput, ValidatedReading
from .preprocessing.aggregator import TelemetryAggregator
from .features.feature_engine import FeatureEngine
from .engines.forecast_engine import ForecastEngine
from .engines.prepaid_engine import PrepaidLifetimeEngine
from .engines.postpaid_engine import PostpaidBillEngine
from .engines.recharge_engine import RechargeDemandEngine
from .database import get_connection

logger = logging.getLogger("LECO_ML.service")


class MLServiceOrchestrator:
    """
    Singleton service managing active meter ensembles, telemetry validation,
    online model evaluation, and multi-horizon forecasts.
    """

    def __init__(self):
        self.validator = TelemetryValidator(expected_interval_seconds=settings.TELEMETRY_INTERVAL_SECONDS)
        self.aggregator = TelemetryAggregator()
        self.feature_engine = FeatureEngine(population_prior_kwh=settings.DEFAULT_HOURLY_POPULATION_PRIOR_KWH)
        self.forecast_engine = ForecastEngine(self.feature_engine)
        self.prepaid_engine = PrepaidLifetimeEngine(self.forecast_engine)
        self.postpaid_engine = PostpaidBillEngine(self.forecast_engine)
        self.recharge_engine = RechargeDemandEngine()

        # In-memory meter ensembles: { meter_id: AdaptiveEnsemble }
        self._ensembles: Dict[int, AdaptiveEnsemble] = {}
        # Recent hourly history cache per meter: { meter_id: [float, float, ...] }
        self._hourly_history: Dict[int, List[float]] = {}

    async def get_or_create_ensemble(self, meter_id: int) -> AdaptiveEnsemble:
        """Retrieves existing ensemble or hydrates one from PostgreSQL."""
        if meter_id in self._ensembles:
            return self._ensembles[meter_id]

        # Determine meter-specific baseline rate from actual available data for this meter
        default_kwh = settings.DEFAULT_HOURLY_POPULATION_PRIOR_KWH
        try:
            async with get_connection() as conn:
                # 1. Check meter's actual daily average if recorded
                m_row = await conn.fetchrow(
                    "SELECT daily_average FROM meters WHERE id = $1",
                    meter_id
                )
                if m_row and m_row["daily_average"] and float(m_row["daily_average"]) > 0:
                    default_kwh = float(m_row["daily_average"]) / 24.0
                else:
                    # 2. Check actual recent active power from telemetry
                    p_row = await conn.fetchrow(
                        """
                        SELECT AVG(power) as avg_p 
                        FROM (
                            SELECT power FROM meter_readings 
                            WHERE (meter_id = $1::text OR meter_id = (SELECT meter_number FROM meters WHERE id = $1)) 
                              AND power > 0 
                            ORDER BY timestamp DESC 
                            LIMIT 60
                        ) sub
                        """,
                        meter_id
                    )
                    if p_row and p_row["avg_p"] and float(p_row["avg_p"]) > 0:
                        # Raw telemetry power has 1 decimal (raw / 10.0 = Watts), Watts / 1000 = kW (hourly rate)
                        default_kwh = max(0.01, (float(p_row["avg_p"]) / 10.0) / 1000.0)
        except Exception as e:
            logger.debug(f"Meter baseline fetch fallback: {e}")

        ensemble = AdaptiveEnsemble(
            meter_id=meter_id,
            learning_rate=settings.ENSEMBLE_LEARNING_RATE,
            smoothing_factor=settings.ERROR_SMOOTHING_FACTOR,
            default_kwh=default_kwh
        )

        # Hydrate from DB if record exists
        try:
            async with get_connection() as conn:
                row = await conn.fetchrow(
                    "SELECT sample_count, weights, error_metrics, ewma_mean FROM ml_meter_states WHERE meter_id = $1",
                    meter_id
                )
                if row:
                    ensemble.total_evaluations = row["sample_count"] or 0
                    if row["weights"]:
                        raw_w = row["weights"]
                        if isinstance(raw_w, str):
                            raw_w = json.loads(raw_w)
                        ensemble.weights.update(raw_w)
                    if row["ewma_mean"]:
                        ensemble.model_ewma_kalman.ewma_state = float(row["ewma_mean"])
                    logger.info(f"Hydrated ensemble for Meter {meter_id} from database (samples: {ensemble.total_evaluations}).")
        except Exception as e:
            logger.warning(f"Could not load state for Meter {meter_id} from DB (using fresh state): {e}")

        self._ensembles[meter_id] = ensemble
        return ensemble

    async def save_ensemble_state(self, ensemble: AdaptiveEnsemble) -> None:
        """Persists model state, weights, and evaluation metrics to Neon PostgreSQL."""
        try:
            status = ensemble.get_status()
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO ml_meter_states (
                        meter_id, sample_count, cold_start_stage, adwin_drift_detected,
                        ewma_mean, weights, error_metrics, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                    ON CONFLICT (meter_id) DO UPDATE SET
                        sample_count = EXCLUDED.sample_count,
                        cold_start_stage = EXCLUDED.cold_start_stage,
                        adwin_drift_detected = EXCLUDED.adwin_drift_detected,
                        ewma_mean = EXCLUDED.ewma_mean,
                        weights = EXCLUDED.weights,
                        error_metrics = EXCLUDED.error_metrics,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    ensemble.meter_id,
                    ensemble.total_evaluations,
                    ensemble.cold_start_stage,
                    ensemble.last_drift_detected,
                    ensemble.model_ewma_kalman.ewma_state,
                    json.dumps(ensemble.weights),
                    json.dumps(status["metrics"])
                )
        except Exception as e:
            logger.error(f"Error saving ensemble state for meter {ensemble.meter_id}: {e}")

    async def ingest_telemetry_reading(self, raw_input: RawTelemetryInput) -> ValidatedReading:
        """
        Processes high-frequency incoming pulse:
        1. Validates & computes delta_kwh.
        2. Stores raw record in Neon PostgreSQL.
        3. Aggregates into hourly energy bins.
        4. If an hourly bin finalized, stores it and triggers online evaluation loop.
        """
        validated = self.validator.validate_and_compute_delta(raw_input)

        if not validated.is_duplicate:
            # Store validated reading in Neon PostgreSQL
            try:
                async with get_connection() as conn:
                    await conn.execute(
                        """
                        INSERT INTO meter_telemetry_raw (
                            meter_id, timestamp, cumulative_kwh, delta_kwh,
                            prepaid_balance, connection_type, tariff_id, billing_cycle_day,
                            voltage, current_amps, power_factor, is_valid, validation_flags
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
                        """,
                        validated.meter_id,
                        validated.timestamp,
                        validated.cumulative_kwh,
                        validated.delta_kwh,
                        validated.prepaid_balance,
                        validated.connection_type,
                        validated.tariff_id,
                        validated.billing_cycle_day,
                        validated.voltage,
                        validated.current_amps,
                        validated.power_factor,
                        validated.is_valid,
                        json.dumps(validated.flags)
                    )
            except Exception as e:
                logger.error(f"Failed to persist raw telemetry: {e}")

            # Feed to hourly aggregator
            finalized_hour = self.aggregator.process_reading(validated)
            if finalized_hour is not None:
                await self.on_hourly_window_finalized(finalized_hour)

        return validated

    async def on_hourly_window_finalized(self, hourly_data: Dict[str, Any]) -> None:
        """
        Triggered when an hour window concludes:
        1. Persists aggregate to meter_hourly_aggregation table.
        2. Updates in-memory hourly history buffer.
        3. Runs Prequential Evaluation Loop:
           - Matches pending prediction made for this target hour.
           - Evaluates error, updates ADWIN drift detector, updates dynamic weights.
           - Calls learn_one on models.
        """
        meter_id = hourly_data["meter_id"]
        period_start = hourly_data["period_start"]
        total_kwh = hourly_data["total_kwh"]

        try:
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO meter_hourly_aggregation (
                        meter_id, period_start, period_hour, period_day_of_week,
                        is_weekend, total_kwh, peak_kw, reading_count
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (meter_id, period_start) DO UPDATE SET
                        total_kwh = EXCLUDED.total_kwh,
                        peak_kw = EXCLUDED.peak_kw,
                        reading_count = EXCLUDED.reading_count;
                    """,
                    meter_id,
                    period_start,
                    hourly_data["period_hour"],
                    hourly_data["period_day_of_week"],
                    hourly_data["is_weekend"],
                    total_kwh,
                    hourly_data["peak_kw"],
                    hourly_data["reading_count"]
                )
        except Exception as e:
            logger.error(f"Error persisting hourly aggregation for meter {meter_id}: {e}")

        # Update in-memory history cache
        if meter_id not in self._hourly_history:
            self._hourly_history[meter_id] = []
        self._hourly_history[meter_id].insert(0, total_kwh)
        if len(self._hourly_history[meter_id]) > 720:  # keep last 30 days
            self._hourly_history[meter_id].pop()

        # Prequential Evaluation: Find previously stored forecast for this hour
        ensemble = await self.get_or_create_ensemble(meter_id)
        prior_predicted_kwh = None
        forecast_record_id = None

        try:
            async with get_connection() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, predicted_kwh FROM ml_forecast_records
                    WHERE meter_id = $1 AND target_timestamp = $2 AND actual_kwh IS NULL
                    ORDER BY id DESC LIMIT 1;
                    """,
                    meter_id,
                    period_start
                )
                if row:
                    forecast_record_id = row["id"]
                    prior_predicted_kwh = float(row["predicted_kwh"])
        except Exception as e:
            logger.error(f"Error querying pending forecast record: {e}")

        # Extract features for this hour
        history_slice = self._hourly_history[meter_id][1:]  # history prior to this hour
        features = self.feature_engine.extract_features(
            meter_id=meter_id,
            target_timestamp=period_start,
            recent_hourly_kwh=history_slice
        )

        # Execute evaluation and incremental learning
        eval_result = ensemble.evaluate_and_learn(
            features=features.to_model_dict(),
            actual_y=total_kwh,
            prior_prediction=prior_predicted_kwh
        )

        # Update forecast record with actuals and absolute error
        if forecast_record_id is not None:
            try:
                async with get_connection() as conn:
                    await conn.execute(
                        """
                        UPDATE ml_forecast_records SET
                            actual_kwh = $1,
                            absolute_error = $2,
                            evaluated_at = CURRENT_TIMESTAMP
                        WHERE id = $3;
                        """,
                        total_kwh,
                        eval_result["residual_error"],
                        forecast_record_id
                    )
            except Exception as e:
                logger.error(f"Error updating forecast evaluation record: {e}")

        # If ADWIN concept drift occurred, record event
        if eval_result.get("drift_detected"):
            try:
                async with get_connection() as conn:
                    await conn.execute(
                        """
                        INSERT INTO ml_drift_events (
                            meter_id, detected_at, metric, old_mean, new_mean, variance, action_taken
                        ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6);
                        """,
                        meter_id,
                        "PREDICTION_RESIDUAL_MAE",
                        prior_predicted_kwh or total_kwh,
                        total_kwh,
                        ensemble.residual_variance,
                        "EXPANDED_UNCERTAINTY_AND_DOUBLED_ADAPTATION_RATE"
                    )
            except Exception as e:
                logger.error(f"Error logging drift event: {e}")

        # Persist updated ensemble state
        await self.save_ensemble_state(ensemble)

    async def get_recent_history(self, meter_id: int, limit: int = 72) -> List[float]:
        """
        Returns recent hourly consumption values directly from real available data for this meter:
        1. Hourly aggregations if recorded
        2. Consumption logs for this meter
        3. Real hardware telemetry readings from meter_readings
        4. Meter-specific baseline profile from meters table
        Never returns synthetic population data.
        """
        if meter_id in self._hourly_history and len(self._hourly_history[meter_id]) >= limit:
            return self._hourly_history[meter_id][:limit]

        # Query from database based strictly on available data for this meter
        try:
            async with get_connection() as conn:
                # 1. Hourly aggregations
                rows = await conn.fetch(
                    """
                    SELECT total_kwh FROM meter_hourly_aggregation
                    WHERE meter_id = $1
                    ORDER BY period_start DESC LIMIT $2;
                    """,
                    meter_id,
                    limit
                )
                if rows and len(rows) > 0:
                    vals = [float(r["total_kwh"]) for r in rows if r["total_kwh"] is not None]
                    if vals:
                        self._hourly_history[meter_id] = vals
                        return vals

                # 2. Real consumption logs for this meter
                c_rows = await conn.fetch(
                    """
                    SELECT consumption FROM consumption_logs
                    WHERE meter_id = $1
                    ORDER BY reading_date DESC, reading_hour DESC
                    LIMIT $2;
                    """,
                    meter_id,
                    limit
                )
                if c_rows and len(c_rows) > 0:
                    vals = [float(r["consumption"]) for r in c_rows if r["consumption"] is not None and float(r["consumption"]) > 0]
                    if vals:
                        self._hourly_history[meter_id] = vals
                        return vals

                # 3. Real hardware readings from meter_readings
                m_row = await conn.fetchrow("SELECT meter_number, daily_average FROM meters WHERE id = $1", meter_id)
                meter_num = m_row["meter_number"] if m_row else str(meter_id)
                meter_daily_avg = float(m_row["daily_average"] or 0.0) if m_row else 0.0

                readings = await conn.fetch(
                    """
                    SELECT power, energy, received_at FROM meter_readings
                    WHERE UPPER(meter_id) = UPPER($1) OR meter_id = $2::text
                    ORDER BY received_at DESC
                    LIMIT 120;
                    """,
                    meter_num,
                    meter_id
                )
                if readings and len(readings) > 0:
                    hourly_vals = []
                    for r in readings[:limit]:
                        raw_p = float(r["power"] or 0.0)
                        # Power in W with 1 decimal -> raw / 10.0 W -> / 1000.0 kW
                        kw = (raw_p / 10.0) / 1000.0
                        if kw > 0:
                            hourly_vals.append(round(kw, 4))
                    if hourly_vals:
                        self._hourly_history[meter_id] = hourly_vals
                        return hourly_vals

                # 4. Relevant meter-specific baseline if configured
                if meter_daily_avg > 0:
                    hourly_avg = round(meter_daily_avg / 24.0, 4)
                    return [hourly_avg]
        except Exception as e:
            logger.warning(f"Could not load hourly history from DB for meter {meter_id}: {e}")

        # Return empty list if no actual data exists (never fabricate synthetic data)
        return self._hourly_history.get(meter_id, [])


# Global singleton orchestrator
orchestrator = MLServiceOrchestrator()
