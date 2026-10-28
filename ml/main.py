import sys
import os
import subprocess
from pathlib import Path

# Resolve directory roots
_current_dir = Path(__file__).resolve().parent
_repo_root = _current_dir.parent

# 1. Virtual Environment Auto-Handoff:
# If user executes directly with system python without virtualenv activated,
# auto-relaunch transparently using ml/.venv python.
_venv_python = _current_dir / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
if _venv_python.exists() and "pytest" not in sys.modules:
    _curr_exec = Path(sys.executable).resolve()
    _target_exec = _venv_python.resolve()
    if _curr_exec != _target_exec:
        try:
            import fastapi
            import uvicorn
        except ImportError:
            sys.exit(subprocess.call([str(_target_exec), *sys.argv]))

# 2. Path Setup: Ensure project root and ml directory are in sys.path
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))
if str(_current_dir) not in sys.path:
    sys.path.insert(0, str(_current_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

try:
    from .config import settings
    from .database import init_ml_tables, close_db_pool
    from .api.routes_telemetry import router as telemetry_router
    from .api.routes_forecast import router as forecast_router
    from .api.routes_models import router as models_router
    from .api.routes_health import router as health_router
except (ImportError, ValueError):
    from ml.config import settings
    from ml.database import init_ml_tables, close_db_pool
    from ml.api.routes_telemetry import router as telemetry_router
    from ml.api.routes_forecast import router as forecast_router
    from ml.api.routes_models import router as models_router
    from ml.api.routes_health import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("LECO_ML.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Starting LECO Adaptive ML Service...")
    if settings.ENVIRONMENT == "production" and not settings.ML_SERVICE_TOKEN:
        raise RuntimeError("ML_SERVICE_TOKEN must be configured in production.")
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
    os.chdir(_repo_root)
    print("=" * 65)
    print(f"  {settings.APP_NAME}")
    print(f"  Service:      http://localhost:{settings.PORT}")
    print(f"  Health Check: http://localhost:{settings.PORT}/api/ml/health")
    print(f"  Swagger Docs: http://localhost:{settings.PORT}/docs")
    print("=" * 65)
    uvicorn.run("ml.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
