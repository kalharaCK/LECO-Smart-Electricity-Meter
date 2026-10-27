"""
Neon PostgreSQL Database Connection & Optimization Layer
Provides asynchronous connection pooling (asyncpg) with automatic index tuning
and table initialization for high-frequency telemetry and ML state storage.
"""

import asyncpg
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from .config import settings

logger = logging.getLogger("LECO_ML.database")

_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> asyncpg.Pool:
    """Returns or initializes the asyncpg connection pool."""
    global _pool
    if _pool is None:
        logger.info("Initializing Neon PostgreSQL async connection pool for ML service...")
        # Clean query parameters for asyncpg if necessary
        db_url = settings.DATABASE_URL
        if "sslmode=require" in db_url and "ssl=" not in db_url:
            db_url = db_url.replace("sslmode=require", "ssl=require")

        _pool = await asyncpg.create_pool(
            dsn=db_url,
            min_size=settings.DB_POOL_MIN_SIZE,
            max_size=settings.DB_POOL_MAX_SIZE,
            command_timeout=60.0
        )
        logger.info("Neon PostgreSQL connection pool established successfully.")
    return _pool


async def close_db_pool() -> None:
    """Closes the connection pool gracefully."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Neon PostgreSQL connection pool closed.")


@asynccontextmanager
async def get_connection():
    """Context manager yielding a connection from the pool."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        yield conn


async def init_ml_tables() -> None:
    """
    Ensures high-performance tables and indexes exist in the Neon PostgreSQL database.
    Designed for large scale meter deployments (thousands to millions of readings).
    """
    schema_sql = """
    -- 1. Raw Telemetry Stream (High frequency, 30-45s incoming pulse)
    CREATE TABLE IF NOT EXISTS meter_telemetry_raw (
        id BIGSERIAL PRIMARY KEY,
        meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        cumulative_kwh DOUBLE PRECISION NOT NULL,
        delta_kwh DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        prepaid_balance DECIMAL(10, 2),
        connection_type VARCHAR(20) DEFAULT 'prepaid',
        tariff_id VARCHAR(50) DEFAULT 'DOMESTIC_D1',
        billing_cycle_day INTEGER DEFAULT 1,
        voltage DOUBLE PRECISION,
        current_amps DOUBLE PRECISION,
        power_factor DOUBLE PRECISION,
        is_valid BOOLEAN DEFAULT TRUE,
        validation_flags JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Composite index for fast chronological time-series slicing per meter
    CREATE INDEX IF NOT EXISTS idx_telemetry_meter_time 
        ON meter_telemetry_raw(meter_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_telemetry_time_only 
        ON meter_telemetry_raw(timestamp DESC);

    -- 2. Aggregated Hourly Energy Series (Features for ML engine)
    CREATE TABLE IF NOT EXISTS meter_hourly_aggregation (
        id BIGSERIAL PRIMARY KEY,
        meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
        period_start TIMESTAMPTZ NOT NULL,
        period_hour INTEGER NOT NULL,
        period_day_of_week INTEGER NOT NULL,
        is_weekend BOOLEAN NOT NULL,
        total_kwh DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        peak_kw DOUBLE PRECISION DEFAULT 0.0,
        reading_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_meter_hourly_period UNIQUE (meter_id, period_start)
    );

    CREATE INDEX IF NOT EXISTS idx_hourly_meter_period 
        ON meter_hourly_aggregation(meter_id, period_start DESC);

    -- 3. ML Forecast Records & Prequential Evaluation Log
    CREATE TABLE IF NOT EXISTS ml_forecast_records (
        id BIGSERIAL PRIMARY KEY,
        meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
        forecast_type VARCHAR(50) NOT NULL, -- 'HOURLY_NEXT_24', 'REMAINING_CYCLE', 'PREPAID_LIFETIME', 'MONTHLY_BILL'
        horizon_hours INTEGER NOT NULL,
        forecast_time TIMESTAMPTZ NOT NULL,
        target_timestamp TIMESTAMPTZ NOT NULL,
        predicted_kwh DOUBLE PRECISION NOT NULL,
        lower_bound_kwh DOUBLE PRECISION NOT NULL,
        upper_bound_kwh DOUBLE PRECISION NOT NULL,
        uncertainty_score DOUBLE PRECISION NOT NULL,
        model_version VARCHAR(50) NOT NULL,
        ensemble_weights JSONB,
        actual_kwh DOUBLE PRECISION,
        absolute_error DOUBLE PRECISION,
        evaluated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_forecast_eval_pending 
        ON ml_forecast_records(meter_id, target_timestamp) 
        WHERE actual_kwh IS NULL;
    CREATE INDEX IF NOT EXISTS idx_forecast_meter_target 
        ON ml_forecast_records(meter_id, target_timestamp DESC);

    -- 4. Online ML Model States, Weights & Memory per Meter
    CREATE TABLE IF NOT EXISTS ml_meter_states (
        meter_id INTEGER PRIMARY KEY REFERENCES meters(id) ON DELETE CASCADE,
        sample_count INTEGER DEFAULT 0,
        cold_start_stage VARCHAR(30) DEFAULT 'NO_HISTORY',
        adwin_drift_detected BOOLEAN DEFAULT FALSE,
        last_drift_timestamp TIMESTAMPTZ,
        ewma_mean DOUBLE PRECISION DEFAULT 0.35,
        kalman_state DOUBLE PRECISION DEFAULT 0.35,
        kalman_variance DOUBLE PRECISION DEFAULT 1.0,
        weights JSONB NOT NULL DEFAULT '{"ewma": 0.3, "kalman": 0.3, "linear": 0.2, "forest": 0.2}'::jsonb,
        error_metrics JSONB NOT NULL DEFAULT '{"mae": 0.0, "rmse": 0.0, "mape": 0.0}'::jsonb,
        model_checkpoints JSONB,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Concept Drift Audit Trail
    CREATE TABLE IF NOT EXISTS ml_drift_events (
        id BIGSERIAL PRIMARY KEY,
        meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
        detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        metric VARCHAR(50) NOT NULL,
        old_mean DOUBLE PRECISION,
        new_mean DOUBLE PRECISION,
        variance DOUBLE PRECISION,
        action_taken VARCHAR(100) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_drift_meter_time 
        ON ml_drift_events(meter_id, detected_at DESC);
    """

    try:
        async with get_connection() as conn:
            await conn.execute(schema_sql)
            logger.info("LECO Adaptive ML database schema and indexes initialized.")
    except Exception as e:
        logger.error(f"Error initializing ML database tables: {e}", exc_info=True)
        raise
