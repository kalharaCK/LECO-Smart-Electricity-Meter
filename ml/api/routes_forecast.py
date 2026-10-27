"""
Forecasting API Router
Provides endpoints for next 24-hour hourly trajectory, prepaid depletion lifetime,
postpaid bill forecasting, and next-month demand recommendations.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import logging
from ..service import orchestrator
from ..security import require_ml_service_token
from ..database import get_connection

logger = logging.getLogger("LECO_ML.api.forecast")
router = APIRouter(prefix="/api/ml/forecast", tags=["Forecasting Engines"], dependencies=[Depends(require_ml_service_token)])


@router.get("/hourly/{meter_id}", response_model=Dict[str, Any])
async def get_hourly_forecast(meter_id: int):
    """
    Returns 24-step recursive hourly energy forecast with confidence intervals.
    Automatically registers H+1 forecast for prequential evaluation upon arrival of actuals.
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        history = await orchestrator.get_recent_history(meter_id, limit=72)
        now = datetime.now(timezone.utc)

        forecast_24h = orchestrator.forecast_engine.forecast_next_24h(
            ensemble=ensemble,
            current_timestamp=now,
            recent_hourly_kwh=history
        )

        # Store H+1 forecast record in DB to evaluate out-of-sample accuracy when target arrives
        h1 = forecast_24h["hourly_trajectory"][0]
        try:
            target_ts = datetime.fromisoformat(h1["target_timestamp"])
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO ml_forecast_records (
                        meter_id, forecast_type, horizon_hours, forecast_time, target_timestamp,
                        predicted_kwh, lower_bound_kwh, upper_bound_kwh, uncertainty_score,
                        model_version, ensemble_weights
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
                    """,
                    meter_id,
                    "HOURLY_NEXT_1",
                    1,
                    now,
                    target_ts,
                    h1["predicted_kwh"],
                    h1["lower_bound_kwh"],
                    h1["upper_bound_kwh"],
                    h1["uncertainty_score"],
                    f"ENSEMBLE_V1_{ensemble.cold_start_stage}",
                    ensemble.weights
                )
        except Exception as e:
            logger.warning(f"Could not log H+1 forecast record: {e}")

        return forecast_24h
    except Exception as e:
        logger.error(f"Error generating hourly forecast for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate forecast.")


@router.get("/prepaid/{meter_id}", response_model=Dict[str, Any])
async def get_prepaid_lifetime(
    meter_id: int,
    balance: Optional[float] = Query(None, description="Optional override of current balance in LKR")
):
    """
    Simulates non-linear PUCSL domestic block tariff balance exhaustion.
    Returns median expected depletion, conservative early warning, and confidence score.
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        history = await orchestrator.get_recent_history(meter_id, limit=72)

        # Retrieve balance and current cycle info from DB if not passed
        curr_balance = balance
        current_cycle_kwh = 0.0
        current_cycle_day = 1

        if curr_balance is None:
            try:
                async with get_connection() as conn:
                    m_row = await conn.fetchrow("SELECT balance FROM meters WHERE id = $1", meter_id)
                    if m_row:
                        curr_balance = float(m_row["balance"] or 0.0)
                    else:
                        curr_balance = 0.0

                    # Calculate cumulative kWh in current month
                    c_row = await conn.fetchrow(
                        """
                        SELECT COALESCE(SUM(consumption), 0.0) as cycle_kwh,
                               EXTRACT(DAY FROM CURRENT_DATE) as cycle_day
                        FROM consumption_logs
                        WHERE meter_id = $1 AND reading_date >= DATE_TRUNC('month', CURRENT_DATE);
                        """,
                        meter_id
                    )
                    if c_row:
                        current_cycle_kwh = float(c_row["cycle_kwh"] or 0.0)
                        current_cycle_day = int(c_row["cycle_day"] or datetime.now(timezone.utc).day)
            except Exception as db_err:
                logger.warning(f"DB lookup fallback for prepaid meter {meter_id}: {db_err}")
                curr_balance = 0.0

        result = orchestrator.prepaid_engine.simulate_depletion(
            ensemble=ensemble,
            current_balance=curr_balance,
            current_cycle_kwh=current_cycle_kwh,
            current_cycle_day=current_cycle_day,
            recent_hourly_kwh=history
        )
        return result
    except Exception as e:
        logger.error(f"Error simulating prepaid lifetime for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate forecast.")


@router.get("/postpaid/{meter_id}", response_model=Dict[str, Any])
async def get_postpaid_forecast(meter_id: int):
    """
    Forecasts end-of-cycle bill for postpaid electricity meters under PUCSL domestic tariff.
    Formula: total_kwh = actual_consumed + predicted_remaining; bill = tariff(total_kwh).
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        history = await orchestrator.get_recent_history(meter_id, limit=72)
        now = datetime.now(timezone.utc)

        already_consumed = 0.0
        cycle_day = now.day
        daily_avg = 0.0

        try:
            async with get_connection() as conn:
                c_row = await conn.fetchrow(
                    """
                    SELECT COALESCE(SUM(consumption), 0.0) as cycle_kwh,
                           EXTRACT(DAY FROM CURRENT_DATE) as cycle_day
                    FROM consumption_logs
                    WHERE meter_id = $1 AND reading_date >= DATE_TRUNC('month', CURRENT_DATE);
                    """,
                    meter_id
                )
                if c_row and c_row["cycle_kwh"] is not None:
                    already_consumed = float(c_row["cycle_kwh"])
                    cycle_day = int(c_row["cycle_day"] or now.day)

                # Daily average
                avg_row = await conn.fetchrow(
                    "SELECT COALESCE(daily_average, 0.0) as d_avg FROM meters WHERE id = $1",
                    meter_id
                )
                if avg_row:
                    daily_avg = float(avg_row["d_avg"] or 0.0)
        except Exception as db_err:
            logger.warning(f"DB lookup fallback for postpaid meter {meter_id}: {db_err}")

        # Quick 24h total
        h24 = orchestrator.forecast_engine.forecast_next_24h(ensemble, now, history)
        next_24h_kwh = h24["total_predicted_24h_kwh"]

        bill_forecast = orchestrator.postpaid_engine.forecast_bill(
            ensemble=ensemble,
            already_consumed_kwh=already_consumed,
            current_cycle_day=cycle_day,
            daily_kwh_average=daily_avg,
            next_24h_kwh=next_24h_kwh
        )
        return bill_forecast
    except Exception as e:
        logger.error(f"Error forecasting postpaid bill for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate forecast.")


@router.get("/demand/{meter_id}", response_model=Dict[str, Any])
async def get_recharge_demand(meter_id: int):
    """
    Forecasts next month's consumption demand, total tariff liability,
    recommended recharge credit, and consumer trend (Increasing / Stable / Decreasing).
    """
    try:
        ensemble = await orchestrator.get_or_create_ensemble(meter_id)
        history = await orchestrator.get_recent_history(meter_id, limit=72)

        curr_balance = 0.0
        daily_avg = 0.0
        prev_cycle_kwh = 0.0

        try:
            async with get_connection() as conn:
                m_row = await conn.fetchrow(
                    "SELECT balance, daily_average FROM meters WHERE id = $1", meter_id
                )
                if m_row:
                    curr_balance = float(m_row["balance"] or 0.0)
                    daily_avg = float(m_row["daily_average"] or 0.0)

                p_row = await conn.fetchrow(
                    """
                    SELECT COALESCE(SUM(consumption), 0.0) as prev_kwh
                    FROM consumption_logs
                    WHERE meter_id = $1 
                      AND reading_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND reading_date < DATE_TRUNC('month', CURRENT_DATE);
                    """,
                    meter_id
                )
                if p_row:
                    prev_cycle_kwh = float(p_row["prev_kwh"] or 0.0)
        except Exception as db_err:
            logger.warning(f"DB lookup fallback for demand meter {meter_id}: {db_err}")

        demand_res = orchestrator.recharge_engine.predict_next_month_demand(
            ensemble=ensemble,
            current_balance=curr_balance,
            daily_kwh_average=daily_avg,
            previous_cycle_kwh=prev_cycle_kwh
        )
        return demand_res
    except Exception as e:
        logger.error(f"Error predicting demand for meter {meter_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to generate forecast.")

