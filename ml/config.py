"""
Configuration management for the Adaptive Smart Electricity Meter ML System.
Loads environment variables, database credentials, and service settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent
BACKEND_ENV = BASE_DIR.parent / "backend" / ".env"
ML_ENV = BASE_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(ML_ENV), str(BACKEND_ENV), ".env"],
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Service Information
    APP_NAME: str = "LECO Adaptive Smart Electricity Meter ML Service"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", validation_alias="NODE_ENV")
    DEBUG: bool = True
    PORT: int = Field(default=8000, validation_alias="ML_SERVICE_PORT")
    HOST: str = "0.0.0.0"

    # Neon PostgreSQL Database Connection
    # Uses the same DATABASE_URL as the Node.js backend
    DATABASE_URL: str = Field(validation_alias="DATABASE_URL")
    DB_POOL_MIN_SIZE: int = 1
    DB_POOL_MAX_SIZE: int = 10

    # Telemetry and Aggregation Settings
    TELEMETRY_INTERVAL_SECONDS: int = 30  # expected pulse every 30-45s
    AGGREGATION_WINDOW_MINUTES: int = 15  # 15-minute intermediate bins
    HOURLY_WINDOW_MINUTES: int = 60

    # ML Cold Start Thresholds (sample count)
    COLD_START_MIN_SAMPLES: int = 3       # Below 3: NO_HISTORY / population prior
    COLD_START_DAY_1_HOURS: int = 24      # Hours 1-24: EWMA + Kalman baseline
    COLD_START_DAYS_2_TO_7: int = 168     # Hours 25-168: Begin online regression
    COLD_START_DAYS_7_TO_30: int = 720    # Hours 169-720: Activate adaptive forest

    # Online Learning & Ensemble Parameters
    ENSEMBLE_LEARNING_RATE: float = 0.15  # Softmax temperature parameter for weight updates
    ERROR_SMOOTHING_FACTOR: float = 0.85  # Exponential moving average for model loss
    UNCERTAINTY_CONFIDENCE_LEVEL: float = 0.95  # 1.96 standard deviations
    DEFAULT_HOURLY_POPULATION_PRIOR_KWH: float = 0.35  # ~8.4 kWh/day typical Sri Lankan household

    # Concept Drift (ADWIN) Parameters
    ADWIN_DELTA: float = 0.002            # Significance level for ADWIN change detection
    ADWIN_CLOCK: int = 32                 # Interval between drift tests

    # Node.js Backend Gateway
    NODE_BACKEND_URL: str = Field(default="http://localhost:3000", validation_alias="BACKEND_URL")


settings = Settings()

