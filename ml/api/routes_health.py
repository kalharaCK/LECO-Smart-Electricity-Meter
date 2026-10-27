"""
Health & Diagnostics API Router
Exposes service liveness, Neon PostgreSQL connection pool health, and active ML models.
"""

from fastapi import APIRouter, status
from typing import Dict, Any
import time
import logging
from ..config import settings
from ..service import orchestrator
from ..database import get_connection

logger = logging.getLogger("LECO_ML.api.health")
router = APIRouter(prefix="/api/ml", tags=["Health & Telemetry Diagnostics"])

_START_TIME = time.time()


@router.get("/health", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def health_check():
    """
    Health and readiness diagnostic check.
    Probes Neon PostgreSQL database connectivity and reports active online model count.
    """
    db_connected = False
    db_latency_ms = 0.0

    try:
        t0 = time.time()
        async with get_connection() as conn:
            await conn.fetchval("SELECT 1;")
            db_latency_ms = round((time.time() - t0) * 1000.0, 2)
            db_connected = True
    except Exception as e:
        logger.warning(f"Database health check failed: {e}")
        db_connected = False

    uptime_seconds = int(time.time() - _START_TIME)

    return {
        "status": "UP" if db_connected else "DEGRADED",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": uptime_seconds,
        "database": {
            "connected": db_connected,
            "latency_ms": db_latency_ms
        },
        "ml_engine": {
            "active_meter_models_in_memory": len(orchestrator._ensembles),
            "telemetry_interval_expected_seconds": settings.TELEMETRY_INTERVAL_SECONDS,
            "cold_start_stages": [
                "NO_HISTORY (<3 samples)",
                "FIRST_24_HOURS (EWMA+Kalman)",
                "DAYS_2_TO_7 (Online Linear)",
                "DAYS_7_TO_30 (Adaptive Random Forest)",
                "MATURE_STREAM (Dynamic Ensemble + ADWIN)"
            ]
        }
    }
