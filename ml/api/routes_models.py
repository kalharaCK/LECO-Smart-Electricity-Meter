"""
Model Management & Diagnostics API Router
Exposes online ensemble weights, ADWIN drift detection status,
prequential error metrics (MAE, RMSE, MAPE), and evaluation controls.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List
import logging
from ..service import orchestrator
from ..security import require_ml_service_token
from ..database import get_connection

logger = logging.getLogger("LECO_ML.api.models")
router = APIRouter(prefix="/api/ml/models", tags=["Model Diagnostics & Governance"], dependencies=[Depends(require_ml_service_token)])


@router.get("/status/{meter_id}", response_model=Dict[str, Any])
async def get_model_status(meter_id: int):
    """
    Returns online learning state: sample count, cold start stage,
    dynamic ensemble weights, ADWIN status, and running loss metrics.
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        return ensemble.get_status()
    except Exception as e:
        logger.error(f"Error fetching model status for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to retrieve model data.")


@router.get("/drift/{meter_id}", response_model=List[Dict[str, Any]])
async def get_drift_events(meter_id: int, limit: int = 20):
    """
    Returns audit trail of ADWIN concept drift detections and structural shifts.
    """
    try:
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, meter_id, detected_at, metric, old_mean, new_mean, variance, action_taken
                FROM ml_drift_events
                WHERE meter_id = $1
                ORDER BY detected_at DESC LIMIT $2;
                """,
                meter_id,
                limit
            )
            return [
                {
                    "id": r["id"],
                    "meter_id": r["meter_id"],
                    "detected_at": r["detected_at"].isoformat() if r["detected_at"] else None,
                    "metric": r["metric"],
                    "old_mean": r["old_mean"],
                    "new_mean": r["new_mean"],
                    "variance": r["variance"],
                    "action_taken": r["action_taken"]
                }
                for r in rows
            ]
    except Exception as e:
        logger.error(f"Error fetching drift events for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to retrieve model data.")


@router.post("/evaluate/{meter_id}", response_model=Dict[str, Any])
async def trigger_meter_evaluation(meter_id: int):
    """
    Triggers an on-demand prequential evaluation pass for any pending forecast records
    whose target timestamps have now passed and actual consumption is recorded.
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        evaluated_count = 0

        async with get_connection() as conn:
            # Query pending forecasts where target_timestamp <= current time
            pending = await conn.fetch(
                """
                SELECT f.id, f.target_timestamp, f.predicted_kwh, h.total_kwh
                FROM ml_forecast_records f
                JOIN meter_hourly_aggregation h
                  ON f.meter_id = h.meter_id AND f.target_timestamp = h.period_start
                WHERE f.meter_id = $1 AND f.actual_kwh IS NULL AND f.target_timestamp <= CURRENT_TIMESTAMP
                ORDER BY f.target_timestamp ASC LIMIT 50;
                """,
                meter_id
            )

            for item in pending:
                actual = float(item["total_kwh"])
                pred = float(item["predicted_kwh"])
                f_id = item["id"]
                target_ts = item["target_timestamp"]

                # Extract features for that timestamp
                history = await orchestrator.get_recent_history(meter_id, limit=48)
                features = orchestrator.feature_engine.extract_features(
                    meter_id=meter_id,
                    target_timestamp=target_ts,
                    recent_hourly_kwh=history
                )

                eval_res = ensemble.evaluate_and_learn(
                    features=features.to_model_dict(),
                    actual_y=actual,
                    prior_prediction=pred
                )

                await conn.execute(
                    """
                    UPDATE ml_forecast_records SET
                        actual_kwh = $1,
                        absolute_error = $2,
                        evaluated_at = CURRENT_TIMESTAMP
                    WHERE id = $3;
                    """,
                    actual,
                    eval_res["residual_error"],
                    f_id
                )
                evaluated_count += 1

        if evaluated_count > 0:
            await orchestrator.save_ensemble_state(ensemble)

        return {
            "meter_id": meter_id,
            "evaluated_forecasts_count": evaluated_count,
            "updated_ensemble_status": ensemble.get_status()
        }
    except Exception as e:
        logger.error(f"Error evaluating meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to retrieve model data.")
