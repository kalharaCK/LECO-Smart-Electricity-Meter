"""Authentication for private backend-to-ML service requests."""

import secrets

from fastapi import Header, HTTPException, status

from .config import settings


async def require_ml_service_token(x_ml_service_token: str | None = Header(default=None)) -> None:
    expected = settings.ML_SERVICE_TOKEN
    if expected is None and settings.ENVIRONMENT != "production":
        return
    if not expected or not x_ml_service_token or not secrets.compare_digest(x_ml_service_token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service credentials")
