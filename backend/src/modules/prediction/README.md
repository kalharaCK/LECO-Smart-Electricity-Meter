# LECO Prediction & Forecasting Module (Decoupled Architecture)

## Overview
This module calculates daily electricity consumption projections, wallet balance lifetime, and PUCSL block tariff threshold alerts. It is isolated from the main backend controllers and operates as an independent REST calculation engine.

## Directory Structure
```
backend/src/modules/prediction/
├── index.js                  # Module exports (router, controller, service)
├── predictionRoutes.js       # REST API endpoints (GET /meter/:meterId, POST /simulate)
├── predictionController.js   # Parameter validation, meter ownership check & telemetry queries
├── predictionService.js      # Weighted historical prediction & block burn algorithm
└── README.md                 # Developer documentation
```

## REST API Endpoints

### 1. Get Live Meter Prediction
- **Method**: `GET`
- **Route**: `/api/prediction/meter/:meterId`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response**:
```json
{
  "success": true,
  "meterId": 1,
  "meterNumber": "MTR-2026-0001",
  "prediction": {
    "predictedDailyKWh": 10.45,
    "confidence": "HIGH",
    "walletBalance": 6950.00,
    "currentCycleNetKWh": 142.50,
    "currentCycleDay": 24,
    "estimatedDaysRemaining": 18,
    "estimatedMinDays": 16,
    "estimatedMaxDays": 21,
    "averageDailyUsageKwh": 10.45,
    "currentTariffGroup": "DOMESTIC (>60 kWh)",
    "isLifelineActive": false,
    "lifelineRemaining": 500.00,
    "lifelineUsed": 0.00
  }
}
```

### 2. Simulate Wallet Lifetime
- **Method**: `POST`
- **Route**: `/api/prediction/simulate`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`
- **Request Body**:
```json
{
  "walletBalance": 5000,
  "currentCycleKWh": 50,
  "currentCycleDay": 10,
  "avgDailyKWh": 8.5,
  "emergencyCreditLimit": 500,
  "emergencyCreditActive": false
}
```
- **Response**:
```json
{
  "success": true,
  "simulation": {
    "estimatedDaysRemaining": 22,
    "estimatedMinDays": 20,
    "estimatedMaxDays": 25,
    "currentTariffGroup": "DOMESTIC (>60 kWh)",
    "lifelineRemaining": 500,
    "lifelineUsed": 0
  }
}
```

## Decoupled Architecture Principles
1. **No WebSocket Dependencies**: Prediction calculations are pure deterministic REST functions. They do not depend on, invoke, or require socket emitters.
2. **Explainable Historical Weighting**:
   - `recentAverage = 0.50 * 7-day-avg + 0.30 * 14-day-avg + 0.20 * 30-day-avg`
   - `predictedDailyKWh = 0.60 * recentAverage + 0.40 * sameWeekdayAverage`
3. **PUCSL Cumulative Tariff Accuracy**: Computes burn rate day-by-day across domestic block tariff thresholds (0-30, 31-60, 61-90, 91-120, 121-180, 180+ kWh) so predictions remain accurate as the consumer steps across tariff tiers.
