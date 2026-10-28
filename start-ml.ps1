# LECO Smart Electricity Meter - PowerShell ML Service Launcher
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir "ml\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    $VenvPython = "python"
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LECO Adaptive Smart Electricity Meter ML Service" -ForegroundColor Yellow
Write-Host "  Service:      http://localhost:8000" -ForegroundColor Green
Write-Host "  Health Check: http://localhost:8000/api/ml/health" -ForegroundColor Green
Write-Host "  Swagger Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

& $VenvPython -m ml.main
