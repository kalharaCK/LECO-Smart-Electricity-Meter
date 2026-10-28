# LECO Adaptive Smart Electricity Meter ML System

Continuous online learning forecasting service for smart electricity meters under the Public Utilities Commission of Sri Lanka (PUCSL) domestic block tariff structures.

Built with **Python 3.15**, **FastAPI**, **River** (streaming machine learning), **NumPy**, **SciPy**, and **Neon PostgreSQL**.

---

## System Architecture

```text
                 SMART ELECTRICITY METERS (30-45s incoming pulse)
                                   |
                                   v
                          NODE.JS BACKEND (Express)
                                   |
                                   v
             PYTHON ML SERVICE (/api/ml/telemetry/ingest)
                                   |
                                   v
                      VALIDATION & PREPROCESSING
                      - Duplicate pulse suppression
                      - Meter reset / rollover detection
                      - Telemetry gap detection
                      - Real delta kWh calculation
                                   |
                                   v
                         NEON POSTGRESQL POOL
             (meter_telemetry_raw, meter_hourly_aggregation)
                                   |
                                   v
                            FEATURE ENGINE
                      - Sin/Cos Cyclical Hour & Day Encodings
                      - Multi-scale Lags: 1h, 2h, 24h, 168h
                      - Rolling Statistics: 6h, 24h mean & std
                      - Exponential Moving Averages (Fast/Slow)
                      - Diurnal Hour Anchors
                                   |
                                   v
                       HYBRID ONLINE ML ENGINE
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
       EWMA + 24-ch         Online Linear        Adaptive Random
      Kalman Filter           Regression             Forest
     (Day 1 Baseline)      (River SGDRegressor)  (Hoeffding Tree)
            |                     |                     |
            +---------------------+---------------------+
                                  |
                                  v
                          ADAPTIVE ENSEMBLE
                      - Dynamic Softmax Weights
                      - ADWIN Concept Drift Detection
                      - Prediction Error Memory
                      - Residual Uncertainty Calibration
                                  |
                                  v
                        ENERGY FORECAST ENGINE
                      - Next Hour (H+1 Prequential)
                      - Next 24 Hours Recursive Trajectory
                      - Remaining Cycle Consumption
                      - Next Month Demand
                                  |
                                  v
                        PUCSL TARIFF ENGINE
              (Block Tariff D-1: Group A, Group B, Group C)
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
         PREPAID                POSTPAID             RECHARGE
         BALANCE                MONTHLY              NEXT-MONTH
         LIFETIME               BILL                 RECOMMENDATION
         (Depletion timestamp)  (Total LKR liability) (Depletion forecast)
```

---

## Cold Start Strategy

| Stage | Data Threshold | Active Models | Description |
|---|---|---|---|
| **NO_HISTORY** | < 3 samples | Population Prior (`0.35 kWh/h`) | Fallback baseline prior for newly activated meters. |
| **DAY_1_BASELINE** | 3 to 24 hours | EWMA + 24-channel Diurnal Kalman | Tracks diurnal 24-hour hour-of-day baseline immediately. |
| **DAYS_2_TO_7_LINEAR** | 25 to 168 hours | EWMA + Kalman + River Online Linear | Online linear regression adapts to weekday/weekend habits. |
| **DAYS_7_TO_30_FOREST** | 169 to 720 hours | Full Ensemble + Adaptive Random Forest | Streaming tree regressor captures non-linear consumption patterns. |
| **MATURE_ENSEMBLE** | > 720 hours | Fully Dynamic Ensemble with ADWIN Drift | Full streaming adaptation with automated drift detection. |

---

## Critical Engineering Guarantees

1. **ML Predicts Energy; Tariff Engine Calculates Money**:
   Models exclusively predict physical energy ($\text{kWh}$); the tariff engine calculates financial liabilities ($\text{LKR}$) using official PUCSL domestic block tariff rules.
2. **Prequential Evaluation (Test-Then-Train)**:
   Never trains on future targets before evaluating prior predictions made for that target.
3. **Missing Telemetry Safety**:
   Never assumes missing telemetry equals zero consumption; intervals between pulses are validated and flagged.
4. **Advisory Role**:
   Forecasts never directly deduct actual prepaid credit. Real balances are only affected by actual meter settlements.

---

## REST API Endpoints

### 1. Telemetry Ingestion
- `POST /api/ml/telemetry/ingest`: Ingest high-frequency (30-45s) telemetry pulse.
- `POST /api/ml/telemetry/batch`: Ingest multiple telemetry pulses.

### 2. Multi-Horizon Forecasting
- `GET /api/ml/forecast/hourly/{meter_id}`: 24-step recursive hourly energy forecast with confidence bands.
- `GET /api/ml/forecast/prepaid/{meter_id}?balance=1500`: Non-linear PUCSL domestic block tariff depletion lifetime simulation.
- `GET /api/ml/forecast/postpaid/{meter_id}`: End-of-cycle bill forecast for postpaid meters under PUCSL tariffs.
- `GET /api/ml/forecast/demand/{meter_id}`: Next-month demand, recommended recharge, and consumer trend.

### 3. Model Monitoring & Drift
- `GET /api/ml/models/status/{meter_id}`: Online model weights, sample count, and cold-start stage.
- `GET /api/ml/models/drift/{meter_id}`: Concept drift history and events.
- `POST /api/ml/models/evaluate/{meter_id}`: Manual evaluation trigger.

### 4. Health
- `GET /api/ml/health`: System health and cold-start threshold metadata.

---

## How to Run the ML Service Easily

Choose any of the following convenient options:

### Option 1: Quick Double-Click (Windows)
Double-click `start-ml.bat` in the repository root or in the `ml/` folder.

### Option 2: NPM Command
From either the repository root or the `backend/` folder:
```bash
npm run ml
```

### Option 3: Python Launcher (Auto-detects .venv and packages)
From repo root or `ml/` folder:
```bash
python run-ml.py
# or
python ml/main.py
# or (inside ml folder)
python main.py
```

### Option 4: PowerShell Script
```powershell
.\start-ml.ps1
```

---

## Testing & Feed Tools

```bash
# Run all 24 ML unit tests:
npm run test:backend   # in backend
.venv\Scripts\python.exe -m pytest -o pythonpath=. test   # in ml

# Feed continuous 30-second live telemetry for a meter:
npm run ml:feed -- --meter-id 19 --mode stream --interval 30
```

