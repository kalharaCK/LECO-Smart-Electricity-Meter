"""
FastAPI Application Entrypoint
Adaptive Smart Electricity Meter Online Machine Learning Service.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from .config import settings
from .database import init_ml_tables, close_db_pool
from .api.routes_telemetry import router as telemetry_router
from .api.routes_forecast import router as forecast_router
from .api.routes_models import router as models_router
from .api.routes_health import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("LECO_ML.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Starting LECO Adaptive ML Service...")
    # Initialize DB tables and indexes if not present
    try:
        await init_ml_tables()
    except Exception as e:
        logger.error(f"Startup warning: Database initialization failed (will retry dynamically): {e}")

    yield

    logger.info("Shutting down LECO Adaptive ML Service...")
    await close_db_pool()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Continuously learning electricity forecasting engine for prepaid and postpaid smart meters. "
        "Operates without initial datasets using a cold-start strategy, adaptive online ensemble, "
        "and ADWIN concept drift detection."
    ),
    lifespan=lifespan
)

# CORS Policy configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Customer Portal
        "http://localhost:5174",  # Staff Portal
        "http://localhost:3000",  # Node.js Backend REST API
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router)
app.include_router(telemetry_router)
app.include_router(forecast_router)
app.include_router(models_router)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": "/api/ml/health",
        "status": "OPERATIONAL"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
