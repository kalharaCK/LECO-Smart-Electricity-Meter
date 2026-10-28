@echo off
title LECO ML Service (Port 8000)
cd /d "%~dp0\.."

echo ============================================================
echo   LECO Adaptive Smart Electricity Meter ML Service
echo   Service:      http://localhost:8000
echo   Health Check: http://localhost:8000/api/ml/health
echo   Swagger Docs: http://localhost:8000/docs
echo ============================================================

if exist "ml\.venv\Scripts\python.exe" (
    "ml\.venv\Scripts\python.exe" -m ml.main
) else (
    python run-ml.py
)

pause
