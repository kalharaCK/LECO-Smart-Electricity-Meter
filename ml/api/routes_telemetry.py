"""
Telemetry Ingestion & Processing API Router
Receives raw meter readings every 30-45s, validates, computes delta,
and triggers real-time aggregation and model evaluation.
"""

from fastapi import APIRouter, Body, Depends, HTTPException, status
from typing import List, Dict, Any
import logging
from ..preprocessing.validator import RawTelemetryInput, ValidatedReading
from ..service import orchestrator
from ..security import require_ml_service_token

logger = logging.getLogger("LECO_ML.api.telemetry")
router = APIRouter(prefix="/api/ml/telemetry", tags=["Telemetry Ingestion"], dependencies=[Depends(require_ml_service_token)])


@router.post("/ingest", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def ingest_reading(payload: RawTelemetryInput):
    """
    Ingests single high-frequency smart meter reading.
    Executes duplicate detection, meter reset detection, and delta kWh calculation.
    """
    try:
        validated = await orchestrator.ingest_telemetry_reading(payload)
        return {
            "status": "ACCEPTED" if validated.is_valid else "REJECTED",
            "meter_id": validated.meter_id,
            "timestamp": validated.timestamp.isoformat(),
            "cumulative_kwh": validated.cumulative_kwh,
            "delta_kwh": validated.delta_kwh,
            "is_valid": validated.is_valid,
            "is_duplicate": validated.is_duplicate,
            "is_meter_reset": validated.is_meter_reset,
            "has_gap": validated.has_gap,
            "flags": validated.flags
        }
    except Exception as e:
        logger.error(f"Error in ingest_reading: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process telemetry reading."
        )


@router.post("/batch", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def ingest_batch(batch: List[RawTelemetryInput] = Body(..., max_length=1000)):
    """
    Ingests array of historical or buffered telemetry readings in chronological sequence.
    """
    processed = 0
    accepted = 0
    duplicates = 0
    resets = 0

    sorted_batch = sorted(batch, key=lambda r: r.timestamp)
    for reading in sorted_batch:
        res = await orchestrator.ingest_telemetry_reading(reading)
        processed += 1
        if res.is_valid:
            accepted += 1
        if res.is_duplicate:
            duplicates += 1
        if res.is_meter_reset:
            resets += 1

    return {
        "total_processed": processed,
        "accepted": accepted,
        "duplicates": duplicates,
        "meter_resets": resets
    }

