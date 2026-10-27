# LECO Smart Electricity Metering & Bidirectional Grid Analytics Platform

> An enterprise-grade, end-to-end Smart Prepaid Electricity Metering, Bidirectional Net-Metering, Adaptive Machine Learning, and Conversational AI Platform engineered for modern utility providers (Lanka Electricity Company - LECO) and domestic prosumers.

---

## Table of Contents
1. [Executive Summary and Platform Overview](#executive-summary-and-platform-overview)
2. [Key Innovations and Bidirectional Energy Model](#key-innovations-and-bidirectional-energy-model)
3. [End-to-End System Architecture](#end-to-end-system-architecture)
4. [Technology Stack](#technology-stack)
5. [Deep Dive: Machine Learning Forecasting Engine](#deep-dive-machine-learning-forecasting-engine)
   - [Architectural Philosophy](#architectural-philosophy)
   - [Online Streaming Ensemble Pipeline](#online-streaming-ensemble-pipeline)
   - [Feature Engineering and Cyclical Encodings](#feature-engineering-and-cyclical-encodings)
   - [Online Streaming Algorithms](#online-streaming-algorithms)
   - [Dynamic Softmax Weighting and Loss Memory](#dynamic-softmax-weighting-and-loss-memory)
   - [ADWIN Concept Drift Detection](#adwin-concept-drift-detection)
   - [5-Stage Cold-Start Progressive Strategy](#5-stage-cold-start-progressive-strategy)
   - [Non-Linear PUCSL Balance Depletion Simulation](#non-linear-pucsl-balance-depletion-simulation)
   - [ML Microservice REST API Reference](#ml-microservice-rest-api-reference)
6. [Deep Dive: Conversational AI and Tri-Lingual RAG Chatbot](#deep-dive-conversational-ai-and-tri-lingual-rag-chatbot)
   - [Conversational Architecture](#conversational-architecture)
   - [RAG Knowledge Base and TF-IDF Semantic Retriever](#rag-knowledge-base-and-tf-idf-semantic-retriever)
   - [Prompt Positioning and Jailbreak Security Guard](#prompt-positioning-and-jailbreak-security-guard)
   - [Dynamic Context Hydration from Live Database](#dynamic-context-hydration-from-live-database)
   - [Dual-Engine Redundancy: Groq Cloud LLM and Offline Engine](#dual-engine-redundancy-groq-cloud-llm-and-offline-engine)
   - [Tri-Lingual Engine (English, Sinhala, Tamil)](#tri-lingual-engine-english-sinhala-tamil)
   - [Interactive Dashboard Actions and Value Highlighting](#interactive-dashboard-actions-and-value-highlighting)
7. [Prepaid Billing, PUCSL Tariffs, and Financial Engine](#prepaid-billing-pucsl-tariffs-and-financial-engine)
   - [PUCSL 2026 Domestic Block Tariff Structure](#pucsl-2026-domestic-block-tariff-structure)
   - [PayHere Payment Gateway and Cryptographic Verification](#payhere-payment-gateway-and-cryptographic-verification)
   - [Automated Statement and PDF Receipt Generation](#automated-statement-and-pdf-receipt-generation)
8. [Dual-Channel Verification and Communication Gateways](#dual-channel-verification-and-communication-gateways)
   - [Text.lk SMS Gateway](#textlk-sms-gateway)
   - [Nodemailer Email Gateway with Google App Passwords](#nodemailer-email-gateway-with-google-app-passwords)
   - [Dual OTP Synchronization](#dual-otp-synchronization)
9. [Staff Operations Command and System Settings](#staff-operations-command-and-system-settings)
   - [Fleet Operations and Telemetry Triage](#fleet-operations-and-telemetry-triage)
   - [Remote System Settings and API Key Management](#remote-system-settings-and-api-key-management)
   - [Customer Feature Toggles and Maintenance Mode](#customer-feature-toggles-and-maintenance-mode)
10. [Database Schema and Data Dictionary](#database-schema-and-data-dictionary)
11. [Security, Hardening, and Concurrency Protections](#security-hardening-and-concurrency-protections)
12. [Installation, Local Development, and Verification](#installation-local-development-and-verification)
13. [Future Roadmap and License](#future-roadmap-and-license)

---

## Executive Summary and Platform Overview

Traditional electricity distribution systems rely heavily on manual meter reading, post-paid monthly billing, deferred fault discovery, and unidirectional power grids. The exponential adoption of domestic rooftop photovoltaic (PV) solar installations has transformed everyday consumers into **prosumers**—entities that both draw power from the utility grid and export excess clean energy back into the distribution network.

The **LECO Smart Electricity Meter Platform** is an enterprise-grade utility system engineered to deliver:
1. **Continuous Bidirectional Telemetry**: Real-time tracking of imported energy (In) from the national grid and exported solar energy (Out) to the grid, computing net billing balances ($Net = In - Out$).
2. **Prepaid Smart Metering and Remote Relay Control**: Instant balance recharges, automated low-balance alarms, non-linear tariff lifetime predictions, and remote relay actuation (automatic cutoff on depletion and instantaneous 10-30s reconnection on top-up).
3. **Adaptive Online Machine Learning**: A streaming ML microservice running River, Kalman filters, and Hoeffding trees that predicts physical energy consumption without relying on pre-existing historical datasets.
4. **Conversational AI with RAG Architecture**: A tri-lingual smart energy assistant powered by Groq LLMs and local offline rule engines that answers queries regarding consumption, savings, tariffs, account status, and complaints.
5. **Dual-Channel Omnichannel Verification**: Simultaneous OTP dispatch across Text.lk SMS and Nodemailer SMTP (Gmail) for account registration, password resets, and email verifications.
6. **Utility Operations Console**: A centralized staff command center for fleet telemetry inspection, dispute resolution, PayHere transaction reconciliation, and live system configuration.

---

## Key Innovations and Bidirectional Energy Model

### 1. Bidirectional Energy Accounting (In / Out / Net)
Physical smart meters equipped with bidirectional current transducers capture directional energy vectors every 30 to 45 seconds:
- **`In` (Imported from Grid)**: Electricity drawn from the distribution grid to power household loads.
- **`Out` (Exported to Grid)**: Surplus clean electricity generated by rooftop solar PV systems injected into the grid.
- **`Net` ($In - Out$)**: The net chargeable consumption. If $In > Out$, net power is consumed; if $Out > In$, the prosumer earns net grid energy credits.

```
                    +---------------------------+
                    |    LECO Distribution Grid  |
                    +-------------+-------------+
                                  | ^
            Imported Energy (In)  | |  Exported Energy (Out)
                                  v |
                    +-------------+-------------+
                    |   LECO AMI Smart Meter    |
                    |   Measures In & Out (kWh) |
                    +-------------+-------------+
                                  | ^
            Delivered Power       | |  Microgeneration
                                  v |
                +-----------------+---+      +-----------------+
                | Domestic Appliances |      | Solar PV Array  |
                +---------------------+      +-----------------+
```

### 2. Dual-Line Consumption Analytics
The customer dashboard renders dual-channel visual curves:
- **Red/Coral Vector (In)**: Grid import tracking across 24-hour and 7-day sliding windows.
- **Emerald Vector (Out)**: Solar generation fed back to the grid.
- **Net Metric Displays**: Net active power (kW), cumulative net energy (kWh), and real-time financial burn rates (LKR/day).

---

## End-to-End System Architecture

The platform follows a decoupled, multi-tier microservices architecture:

```mermaid
graph TD
    subgraph IoT and Edge Layer
        MTR[AMI Smart Meter Simulator / Hardware]
    end

    subgraph Presentation Tier
        CP[Customer Portal<br/>React 19 + Vite :5173]
        SP[Staff Portal<br/>React 19 + Vite :5174]
    end

    subgraph Application Core
        API[Node.js + Express API :3000]
        WS[Socket.io Real-Time Engine]
        RAG[RAG Knowledge Engine]
        PG[Prompt Security Guard]
        AUTH[Auth and Dual OTP Manager]
        TARIFF[PUCSL Tariff Engine]
        PDF[PDFKit Document Generator]
    end

    subgraph Machine Learning Microservice
        ML[Python FastAPI + Uvicorn :8000]
        RIVER[River Online Learning Ensemble]
        KALMAN[24-Channel Kalman Filter]
        DRIFT[ADWIN Concept Drift Detector]
    end

    subgraph Data Tier
        DB[(Neon Serverless PostgreSQL)]
    end

    subgraph External Gateways
        GROQ[Groq Cloud LLM API]
        SMS[Text.lk SMS Gateway]
        SMTP[Gmail SMTP / Nodemailer]
        PAYHERE[PayHere Payment Gateway]
    end

    MTR -->|REST Telemetry Ingestion| API
    CP -->|REST / JWT Cookie| API
    CP <-->|Bidirectional WebSockets| WS
    SP -->|REST / JWT Cookie| API
    SP <-->|Staff WebSockets| WS

    API --> AUTH
    API --> TARIFF
    API --> PDF
    API --> RAG
    RAG --> GROQ
    API --> PG

    API -->|Async Telemetry Stream| ML
    ML --> RIVER
    ML --> KALMAN
    ML --> DRIFT
    ML -->|Read Aggregates| DB

    API -->|Connection Pool| DB
    AUTH --> SMS
    AUTH --> SMTP
    API --> PAYHERE
```

---

## Technology Stack

### Frontend Applications (`frontend/customer` and `frontend/staff`)
- **Core Engine**: React 19, TypeScript, Vite.
- **Styling Architecture**: Tailwind CSS v4, custom HSL color tokens, dark mode with deep black glassmorphism.
- **Component Primitives**: Radix UI, shadcn/ui.
- **Icons**: Lucide React (strictly zero emojis across all interfaces).
- **Visualizations**: Recharts (responsive dual-channel area and line charts).
- **Internationalization (i18n)**: Native tri-lingual translation contexts (English, Sinhala, Tamil).
- **Real-Time Client**: Socket.io Client with auto-reconnection and exponential backoff.

### Backend REST API (`backend`)
- **Runtime**: Node.js (ES6+ CommonJS), Express.js.
- **Database Driver**: `pg` (node-postgres) with connection pooling and serverless disconnect resilience.
- **Real-Time Transport**: Socket.io server with isolated room partitioning (`meter_{id}`, `user_{id}`).
- **Authentication**: JWT stored in `HttpOnly`, `SameSite=Strict` secure cookies; Bcrypt salted PIN hashing.
- **Communication Clients**: Nodemailer (SMTP), Text.lk REST API.
- **Document Generation**: PDFKit (PUCSL-compliant bills and payment receipts).
- **Testing**: Node.js native test runner (`node:test`, `node:assert/strict`).

### Machine Learning Service (`ml`)
- **Runtime**: Python 3.12+, FastAPI, Uvicorn.
- **Streaming Machine Learning**: River (online regression, Hoeffding adaptive trees, prequential evaluation).
- **Scientific Computing**: NumPy, SciPy, Pandas.
- **Database Connector**: `asyncpg` for PostgreSQL connection pooling.
- **Test Framework**: `pytest`, `pytest-asyncio`.

### Cloud Database Tier
- **Provider**: Neon Serverless PostgreSQL with SSL encryption (`sslmode=require`).

---

## Deep Dive: Machine Learning Forecasting Engine

The LECO Machine Learning Microservice (`ml/`) is an adaptive, online streaming inference engine engineered specifically for domestic electricity consumption forecasting under Sri Lanka's non-linear PUCSL domestic block tariff structure.

### Architectural Philosophy
1. **Zero Cold-Start Dependency**: Operates immediately upon meter activation without requiring months of historical training data.
2. **Prequential Evaluation (Test-Then-Train)**: Models predict the incoming metric $H+1$ first, record the prediction error, and only then update their weights with the true ground truth.
3. **Physical Energy Prediction vs Financial Calculation**: Models predict physical units ($\text{kWh}$); the deterministic tariff engine computes financial liability ($\text{LKR}$).
4. **Missing Telemetry Safety**: Telemetry gaps are explicitly flagged; missing pulses are never treated as zero consumption.

```mermaid
graph TD
    PULSE[Meter Telemetry Pulse 30-45s] --> INGEST[API /api/ml/telemetry/ingest]
    INGEST --> PREPROC[Preprocessing: Deduplication & Rollover Check]
    PREPROC --> FEAT[Feature Engine: Cyclical Time & Multi-Scale Lags]
    FEAT --> MODELS{Online Models}
    
    MODELS --> M1[EWMA + 24-Channel Kalman Filter]
    MODELS --> M2[River Online Linear SGDRegressor]
    MODELS --> M3[Adaptive Random Forest Hoeffding Trees]

    M1 --> ENSEMBLE[Softmax Adaptive Ensemble]
    M2 --> ENSEMBLE
    M3 --> ENSEMBLE

    ENSEMBLE --> ADWIN[ADWIN Concept Drift Detection]
    ENSEMBLE --> SIM[Non-Linear PUCSL Balance Depletion Simulator]
    
    SIM --> PREP[Prepaid Balance Lifetime & Depletion Date]
    SIM --> POST[Postpaid Monthly Bill Projection]
    SIM --> DEM[Next-Month Recommended Topup]
```

### Feature Engineering and Cyclical Encodings
Incoming telemetry readings are transformed into structured feature vectors:

1. **Cyclical Temporal Encodings**:
   $$\text{hour\_sin} = \sin\left(\frac{2\pi \cdot \text{hour}}{24}\right), \quad \text{hour\_cos} = \cos\left(\frac{2\pi \cdot \text{hour}}{24}\right)$$
   $$\text{dow\_sin} = \sin\left(\frac{2\pi \cdot \text{dow}}{7}\right), \quad \text{dow\_cos} = \cos\left(\frac{2\pi \cdot \text{dow}}{7}\right)$$
2. **Multi-Scale Lag Buffers**:
   - Lag 1 Hour ($L_1$): Immediate momentum.
   - Lag 2 Hours ($L_2$): Short-term rate of change.
   - Lag 24 Hours ($L_{24}$): Diurnal cycle anchor (same hour yesterday).
   - Lag 168 Hours ($L_{168}$): Weekly periodicity anchor (same day and hour last week).
3. **Rolling Aggregate Statistics**:
   - 6-Hour Rolling Mean and Standard Deviation.
   - 24-Hour Rolling Consumption and Volatility Index.
4. **Exponential Moving Averages**:
   - Fast EWMA ($\alpha = 0.3$): High sensitivity to sudden usage shifts.
   - Slow EWMA ($\alpha = 0.05$): Baseline consumption stability.

### Online Streaming Algorithms
The engine deploys a three-tiered model ensemble running concurrently:

1. **24-Channel Diurnal Kalman Filter + EWMA**:
   Maintains 24 discrete state estimates corresponding to each hour of the day. Handles newly initialized meters by tracking the time-of-day baseline with instantaneous adaptation.
2. **Online Linear SGD Regressor (`river.linear_model.LinearRegression`)**:
   Online gradient descent optimization with $L_2$ regularization, adapting to gradual changes in household appliances, occupancy, and daily routines.
3. **Adaptive Random Forest (`river.forest.ARFRegressor`)**:
   Streaming ensemble of Hoeffding Trees utilizing statistical split tests (Hoeffding bound) to capture complex non-linear consumption patterns and interaction terms without full dataset retraining.

### Dynamic Softmax Weighting and Loss Memory
Individual model predictions are weighted dynamically according to their recent rolling Mean Absolute Scaled Error (MASE):

$$w_i = \frac{\exp(-\lambda \cdot \text{MASE}_i)}{\sum_{j=1}^M \exp(-\lambda \cdot \text{MASE}_j)}$$

$$\hat{y}_{\text{ensemble}} = \sum_{i=1}^M w_i \cdot \hat{y}_i$$

Models with lower recent errors automatically receive higher prediction influence.

### ADWIN Concept Drift Detection
Household consumption behaviors shift abruptly when new high-power appliances (air conditioners, electric vehicle chargers) are installed, or during holiday periods. The **ADWIN (Adaptive Windowing)** algorithm continuously monitors the stream of prediction residuals:
- If a statistically significant difference between sub-windows is detected ($p < 0.001$), ADWIN flags a **Concept Drift Event**.
- The model variance window is shrunk, learning rates are temporarily boosted, and older historical weights are rapidly decayed to adapt to the new regime.

### 5-Stage Cold-Start Progressive Strategy
To guarantee seamless operation from minute 1 to year 5, the ML pipeline transitions through 5 distinct cold-start tiers:

| Stage | Data Window | Active Engines | Operational Characteristics |
|---|---|---|---|
| **NO_HISTORY** | 0 to 2 samples | Population Baseline Prior | Assigns default prior ($0.35\text{ kWh/h}$) based on domestic averages. |
| **DAY_1_BASELINE** | 3 to 24 hours | EWMA + Diurnal Kalman | Quickly forms the 24-hour diurnal usage profile. |
| **DAYS_2_TO_7_LINEAR** | 25 to 168 hours | Kalman + Online Linear Regression | Captures weekday vs. weekend divergence and trend lines. |
| **DAYS_7_TO_30_FOREST** | 169 to 720 hours | Full Ensemble + Hoeffding Forest | Detects non-linear multi-appliance interactions. |
| **MATURE_ENSEMBLE** | > 720 hours | Dynamic Ensemble with ADWIN Drift | Full autonomous streaming adaptation with active drift monitoring. |

### Non-Linear PUCSL Balance Depletion Simulation
Standard division ($\text{Days} = \frac{\text{Balance}}{\text{Daily Cost}}$) produces massive errors under block tariffs because marginal rates escalate when usage crosses from Group A to Group B or C.

The simulation pipeline executes an iterative day-by-day projection:
1. Advance simulation step $t \in [1, 60\text{ days}]$.
2. If billing cycle exceeds 30 days, reset cumulative $\text{cycleKWh} = 0$.
3. Compute cumulative cycle usage: $\text{cycleKWh}_{t} = \text{cycleKWh}_{t-1} + \hat{y}_t$.
4. Compute total PUCSL billing liability: $\text{Liability}_t = f_{\text{PUCSL}}(\text{cycleKWh}_t)$.
5. Calculate incremental daily debit: $\Delta D_t = \text{Liability}_t - \text{Liability}_{t-1}$.
6. Deduct from simulated balance: $B_t = B_{t-1} - \Delta D_t$.
7. Stop when $B_t \le 0$; interpolate fractional days to yield the exact predicted depletion timestamp.

Multi-scenario confidence bands are simulated:
- **Optimistic ($0.85 \times \text{Forecast}$)**: Yields Maximum Days Remaining.
- **Normal ($1.00 \times \text{Forecast}$)**: Yields Baseline Estimated Days.
- **Conservative ($1.15 \times \text{Forecast}$)**: Yields Minimum Days Remaining.

### ML Microservice REST API Reference
- `POST /api/ml/telemetry/ingest`: High-frequency pulse ingestion (30-45s cadence).
- `POST /api/ml/telemetry/batch`: Batch telemetry synchronization.
- `GET /api/ml/forecast/hourly/{meter_id}`: 24-step recursive hourly forecast with confidence intervals.
- `GET /api/ml/forecast/prepaid/{meter_id}?balance={amount}`: Non-linear tariff balance depletion projection.
- `GET /api/ml/forecast/postpaid/{meter_id}`: End-of-cycle bill projection.
- `GET /api/ml/forecast/demand/{meter_id}`: Next-month total energy demand and recommended top-up.
- `GET /api/ml/models/status/{meter_id}`: Active model weights, sample counts, and cold-start phase.
- `GET /api/ml/models/drift/{meter_id}`: Historical concept drift log.
- `GET /api/ml/health`: Microservice health check and engine telemetry.

---

## Deep Dive: Conversational AI and Tri-Lingual RAG Chatbot

The LECO Smart Energy Assistant (`backend/src/modules/chatbot/`) is a Retrieval-Augmented Generation (RAG) conversational agent that provides real-time customer support regarding electricity usage, savings tips, billing disputes, account management, and smart meter operations.

```mermaid
graph TD
    USER[Customer Prompt] --> GUARD[Prompt Security Guard: Anti-Injection & Zero-Emoji]
    GUARD --> LANG[Language Detector: EN / SI / TA]
    GUARD --> CONTEXT[Context Hydrator: Live PostgreSQL Telemetry Snapshot]
    GUARD --> RAG[TF-IDF Vector RAG Retriever: LECO Domain Knowledge Base]
    
    CONTEXT --> PROMPT_ASSEMBLER[Secure Prompt Assembler with XML Boundaries]
    RAG --> PROMPT_ASSEMBLER
    LANG --> PROMPT_ASSEMBLER

    PROMPT_ASSEMBLER --> ENGINE_DECISION{Groq API Available?}
    
    ENGINE_DECISION -->|Yes| GROQ[Groq Cloud LLM: Qwen / Llama 3.3]
    ENGINE_DECISION -->|No / Timeout / 429| OFFLINE[Tri-Lingual Offline Knowledge Engine]

    GROQ --> SANITIZER[Output Sanitizer & Emoji Eliminator]
    OFFLINE --> SANITIZER
    
    SANITIZER --> ACTIONS[Action Detector: Navigation Buttons]
    ACTIONS --> CLIENT[Structured Response to Customer UI]
```

### Conversational Architecture
1. **Input Reception**: Captures customer inquiries via REST (`POST /api/chat`) or WebSockets.
2. **Security Sandboxing**: Sanitizes prompt injection patterns and wraps user queries in `<untrusted_user_query>` XML enclosures.
3. **Context Hydration**: Queries PostgreSQL to build a live operational snapshot of the customer's account.
4. **Domain Retrieval (RAG)**: Indexes and extracts relevant PUCSL tariff clauses, outage rules, and energy conservation techniques.
5. **LLM Inference**: Groq high-speed cloud inference with sub-second response times.
6. **Zero-Downtime Fallback**: Autonomous tri-lingual offline engine if external APIs are unavailable.
7. **Action Recommendation**: Appends interactive dashboard navigation links based on customer intent.

### RAG Knowledge Base and TF-IDF Semantic Retriever
The knowledge repository (`lecoKnowledgeDocs.js`) indexes authoritative domain documentation:
- **PUCSL Block Tariffs**: Rate tiers, boundary transitions, fixed charges, and fuel adjustment surcharges.
- **Time-of-Use (TOU) Schedules**: Day (05:30-18:30), Peak (18:30-22:30), and Off-Peak (22:30-05:30) operational strategies.
- **Prepaid & Lifeline Management**: Low-balance warnings, night disconnection protection, and automated debt recovery.
- **Payment & Recharging**: PayHere instant online top-up, bank transfer clearing, and verification tokens.
- **Hardware & Telemetry**: Smart meter LED indicator codes, relay disconnection mechanisms, and solar net-metering.
- **Complaints & Outages**: Breakdown logging, billing disputes, and the 24/7 National Emergency Hotline (**1987**).

The vector retriever (`ragRetriever.js`) tokenizes queries, eliminates domain stop-words, and calculates TF-IDF cosine similarity scores to inject the top 2-3 most relevant documents directly into the LLM system context.

### Prompt Positioning and Jailbreak Security Guard
To protect enterprise utility infrastructure against malicious prompt injection attacks, `promptGuard.js` applies multi-stage defense-in-depth:
- **Jailbreak Detection**: Neutralizes adversarial triggers (`"ignore all previous instructions"`, `"you are now DAN"`, `"act as an unrestricted AI"`).
- **Prompt Positioning Sandbox**: Untrusted user text is strictly bounded inside XML tags (`<untrusted_user_query>`) alongside explicit system constraints prohibiting role drift.
- **System Extraction Immunity**: Refuses attempts to dump internal system prompts, database connection strings, or environment tokens.
- **Zero-Emoji Enforcement**: Strips all Unicode emojis from both user inputs and model outputs, maintaining strict professional enterprise UI compliance.

### Dynamic Context Hydration from Live Database
Before generating answers, `contextBuilder.js` queries PostgreSQL to construct an individualized user snapshot:
```json
{
  "meterNumber": "LECO-008492",
  "balance": "Rs. 1,420.50",
  "status": "Connected",
  "lifelineActive": false,
  "todayKwh": "4.2 kWh",
  "monthlyKwh": "84.5 kWh",
  "predictedDays": "~18 days (Range: 15 - 21 days)",
  "burnRate": "Rs. 82.40 / day",
  "currentTariffGroup": "Group B (61-180 kWh)",
  "touStatus": "Day Rate (05:30 - 18:30)",
  "recentPayments": [
    { "amount": "Rs. 1,000.00", "date": "2026-10-24", "status": "Success" }
  ]
}
```
When a user asks *"How much power do I have left?"*, the assistant does not speak in generalities; it replies using their exact live balance and burn rate.

### Dual-Engine Redundancy: Groq Cloud LLM and Offline Engine
- **Primary Cloud Engine (`groqClient.js`)**: Executes high-throughput inference using `qwen/qwen3.8-27b` and `llama-3.3-70b-versatile`. Configured with an 8-second circuit-breaker timeout and automatic rate-limit (HTTP 429) backoff.
- **Tri-Lingual Offline Engine (`offlineEngine.js`)**: A deterministic rule and template engine that runs locally in Node.js. If Groq is unconfigured or offline, it synthesizes responses across all 5 core domains (Usage, Savings, Account, Complaints, General) with 100% availability.

### Tri-Lingual Engine (English, Sinhala, Tamil)
The assistant natively supports all three official languages of Sri Lanka:
- **English (`en`)**: Primary operational interface.
- **Sinhala (`si`)**: Native script support (සිංහල), utilizing Sinhala energy terms (විදුලි පරිභෝජනය, ගාස්තු කාණ්ඩ, ක්ෂණික ගෙවීම්).
- **Tamil (`ta`)**: Native script support (தமிழ்), utilizing Tamil utility terms (மின்சார பயன்பாடு, கட்டண நிலுவை, அவசர உதவி).

Language is automatically inferred from customer dashboard settings or dynamically detected from input character Unicode ranges.

### Interactive Dashboard Actions and Value Highlighting
Responses return structured action recommendations:
- `payments`: Navigates to the balance recharge modal.
- `history`: Opens the payment ledger.
- `complaints`: Launches the technician dispatch and dispute form.
- `settings`: Opens user profile and security preferences.
- `overview`: Jumps to the main fleet telemetry monitor.

Special entities within chat text are automatically styled in high-contrast badges:
- **Currency Values** (`Rs. 1,450.00`): Glowing emerald badge.
- **Energy Quantities** (`14.5 kWh`, `2.4 kW`): Glowing cyan badge.
- **Time Windows** (`18:30 - 22:30`): Purple TOU badge.
- **Tariff Groups** (`Block 2`, `Group B`): Amber classification badge.

---

## Prepaid Billing, PUCSL Tariffs, and Financial Engine

### PUCSL 2026 Domestic Block Tariff Structure
Electricity billing adheres to the official Public Utilities Commission of Sri Lanka (PUCSL) block tariff regulations. The tariff group is determined by **total 30-day cumulative consumption**:

| Consumption Group | Billing Block | Energy Rate (LKR/kWh) | Fixed Charge (LKR/month) | Application Criteria |
|---|---|---|---|---|
| **Group A: Total 0–60 kWh** | 0–30 kWh | 5.00 | 80.00 | Total usage $\le 30\text{ kWh}$ |
| **Group A: Total 0–60 kWh** | 31–60 kWh | 9.00 | 210.00 | Total usage is $31–60\text{ kWh}$ |
| **Group B: Total 61–180 kWh** | 0–60 kWh | 14.00 | — | First 60 units once total exceeds 60 |
| **Group B: Total 61–180 kWh** | 61–90 kWh | 20.00 | 400.00 | Total usage is $61–90\text{ kWh}$ |
| **Group B: Total 61–180 kWh** | 91–120 kWh | 28.00 | 1,000.00 | Total usage is $91–120\text{ kWh}$ |
| **Group B: Total 61–180 kWh** | 121–180 kWh | 44.00 | 1,500.00 | Total usage is $121–180\text{ kWh}$ |
| **Group C: Total > 180 kWh** | 0–180 kWh | 32.50 | — | First 180 units once total exceeds 180 |
| **Group C: Total > 180 kWh** | Above 180 kWh | 100.00 | 2,500.00 | Total usage $> 180\text{ kWh}$ |

#### Boundary Transitions
- Crossing **60 to 61 kWh**: Bill jumps from LKR 630 to LKR 1,260 (+LKR 630).
- Crossing **180 to 181 kWh**: Bill jumps from LKR 6,420 to LKR 8,450 (+LKR 2,030).

### PayHere Payment Gateway and Cryptographic Verification
Online balance top-ups integrate with Sri Lanka's leading digital payment processor, **PayHere**:
1. **Checkout Tokenization**: Client requests a signed checkout payload (`POST /api/payments/payhere/checkout`).
2. **MD5 HMAC Signature**:
   $$\text{Hash} = \text{MD5}(\text{MerchantID} + \text{OrderID} + \text{Amount} + \text{Currency} + \text{MD5}(\text{MerchantSecret}))$$
3. **Server-to-Server IPN Callback**: PayHere notifies `/api/payments/payhere/notify` via secure POST webhook.
4. **Signature Verification**: Validates incoming `md5sig` against recalculation. Tampered payloads are rejected with HTTP 400.
5. **Atomic Balance Top-up**: Credits meter balance, settles Lifeline overdraft debts, logs transaction reference, and emits real-time WebSocket updates.

### Automated Statement and PDF Receipt Generation
The server embeds a PDF generation pipeline using `PDFKit` (`pdfService.js`):
- **Official Monthly Statements**: Renders customer account metadata, meter number, 30-day consumption summary, block tariff rate breakdown, fixed charges, fuel surcharges, and total bill.
- **Recharge Receipts**: Generates downloadable PDF receipts containing unique transaction identifiers (`TXN-...`), previous balance, credited amount, new balance, and digital authenticity watermarks.

---

## Dual-Channel Verification and Communication Gateways

Security-critical operations (Customer Registration, Password Reset, and Email Verification) execute synchronized dual-channel OTP delivery:

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer / Browser
    participant API as Express Auth Controller
    participant DB as Neon PostgreSQL
    participant SMS as Text.lk SMS API
    participant SMTP as Gmail SMTP (Nodemailer)

    User->>API: POST /api/auth/register (Phone & Email)
    API->>API: Generate Cryptographic 6-Digit OTP
    API->>DB: Store Hash with 10-Minute Expiration Window
    
    par Dual Omnichannel Dispatch
        API->>SMS: Dispatch SMS (Trilingual Masked Template)
        SMS-->>User: SMS Received (6-digit code)
    and
        API->>SMTP: Dispatch Formatted HTML Email (Zero-Emoji Template)
        SMTP-->>User: Email Received (Letter-spaced 6-digit code)
    end

    User->>API: POST /api/auth/register/confirm (Enters OTP)
    API->>DB: Verify Code & Mark email_verified = TRUE
    API-->>User: Issue Session JWT & Grant Dashboard Access
```

### Text.lk SMS Gateway (`smsService.js`)
- Dispatches transactional SMS alerts to Sri Lankan mobile networks (Mobitel, Dialog, Airtel, Hutch).
- Phone number normalization ensures local formats (`07X-XXXXXXX`) are parsed to international standard (`947XXXXXXXX`).
- Dynamic sender ID support (defaults to `TextLKDemo` or registered utility masks).

### Nodemailer Email Gateway with Google App Passwords (`emailService.js`)
- Direct integration with Google SMTP (`smtp.gmail.com:465` SSL).
- Supports Google 16-character App Passwords generated under 2-Step Verification.
- Automated sanitization strips spaces from copied app passwords (`abcd efgh ijkl mnop` $\to$ `abcdefghijklmnop`).
- Responsive, zero-emoji HTML email template featuring LECO corporate branding, high-contrast typography, and security warning notices.

### Dual OTP Synchronization
- Both SMS and Email receive the identical 6-digit verification code.
- Users can verify using whichever communication channel reaches their device first.
- Rate-limited generation prevents brute-force abuse (maximum 5 attempts per window).

---

## Staff Operations Command and System Settings

The Staff Portal (`frontend/staff`) provides an administrative command center for grid engineers and support supervisors.

### Fleet Operations and Telemetry Triage
- **Smart Meters Fleet Command**: Live monitoring of all connected meters, active balances, emergency credit states, daily kWh averages, and remote relay actuation (Cutoff / Reconnect).
- **Complaints Queue**: Triage customer disputes, update resolution stages (Investigating, Field Dispatched, Resolved), and push resolution notices.
- **PayHere Payment Ledger**: Review raw IPN callbacks, digital signatures, and execute manual reconciliations.

### Remote System Settings and API Key Management
Staff can configure production API credentials at runtime without restarting servers or editing `.env` files:
- **Groq API Key and Model**: Update LLM tokens and switch models (`llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`).
- **Text.lk SMS Gateway**: Update SMS API bearer token and sender ID mask.
- **PayHere Gateway**: Update Merchant ID, Secret, and toggle Sandbox vs. Live mode.
- **Email Gateway**: Update sender Gmail address, App Password, and run live diagnostic test emails.

### Customer Feature Toggles and Maintenance Mode
Staff can remotely enable or disable features on the customer portal in real time:
- `feature_ai_chatbot`: Toggle customer AI assistant visibility.
- `feature_online_topup`: Enable or disable PayHere checkout.
- `feature_ml_prediction`: Toggle consumption forecasting cards.
- `feature_lifeline_mode`: Enable or disable Emergency Credit overdraft.
- `feature_complaints_portal`: Toggle ticket submission portal.
- `feature_solar_telemetry`: Toggle solar PV net-export displays.
- `maintenance_mode`: Broadcast an advisory banner to all customer sessions with custom messaging.

---

## Database Schema and Data Dictionary

The Neon PostgreSQL database initializes 9 core relational tables:

```mermaid
erDiagram
    USERS ||--o{ METERS : owns
    USERS ||--o{ PAYMENTS : executes
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ COMPLAINTS : files
    METERS ||--o{ METER_READINGS : records
    METERS ||--o{ PAYMENTS : credited_to
    METERS ||--o{ COMPLAINTS : targets

    USERS {
        int id PK
        string email UK
        string phone UK
        string password_hash
        string role
        boolean email_verified
        timestamp created_at
    }

    METERS {
        int id PK
        int user_id FK
        string meter_number UK
        string account_number
        string pin_hash
        decimal balance
        string status
        decimal daily_average
        boolean emergency_credit_active
        timestamp created_at
    }

    METER_READINGS {
        int id PK
        int meter_id FK
        date reading_date
        int reading_hour
        decimal import_kwh
        decimal export_kwh
        timestamp created_at
    }

    PAYMENTS {
        int id PK
        int user_id FK
        int meter_id FK
        decimal amount
        string payment_method
        string transaction_id UK
        string status
        timestamp created_at
    }

    COMPLAINTS {
        int id PK
        int user_id FK
        int meter_id FK
        string category
        string subject
        text description
        string status
        timestamp created_at
    }

    EMAIL_SETTINGS {
        int id PK
        string sender_email
        string app_password
        string smtp_host
        int smtp_port
        boolean is_active
        timestamp updated_at
    }

    EMAIL_LOGS {
        int id PK
        string recipient
        string subject
        string purpose
        string status
        string message_id
        timestamp created_at
    }

    SYSTEM_SETTINGS {
        string key PK
        text value
        string category
        boolean is_secret
        timestamp updated_at
    }
```

---

## Security, Hardening, and Concurrency Protections

1. **Idempotency Control**: Payment top-ups require an `Idempotency-Key` header. Duplicate submissions are intercepted via PostgreSQL unique constraints and replayed without re-debiting.
2. **Cryptographic PIN Protection**: Smart meter PINs are hashed with Bcrypt (10 salt rounds). Hardware verification uses constant-time comparison to prevent timing attacks.
3. **Session Cookie Security**: JWTs are transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Strict` cookies, immune to JavaScript XSS exfiltration.
4. **Origin Whitelisting**: State-changing endpoints validate browser `Origin` headers against trusted customer and staff domains.
5. **Database Resilience Engine**: All pool queries run through an automatic retry handler that absorbs transient serverless disconnects and network drops.
6. **Input Sanitization**: Global recursive middleware strips HTML, script tags, and SQL injection vectors before payloads reach controllers.
7. **Strict No-Emoji Rule**: Enterprise standard eliminating all emoji characters from UI designs, emails, SMS alerts, and chatbot responses.

---

## Installation, Local Development, and Verification

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [Python](https://www.python.org/) 3.12 or higher
- [Neon PostgreSQL](https://neon.tech/) account or local PostgreSQL instance

### 1. Repository Setup
```bash
git clone https://github.com/kalharaCK/LECO-Smart-Electricity-Meter.git
cd LECO-Smart-Electricity-Meter
```

### 2. Backend Configuration & Startup
```bash
cd backend
npm install
cp .env.example .env
```
Edit `backend/.env` with your credentials:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@ep-host.neon.tech/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
STAFF_URL=http://localhost:5174

# Email Gateway (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM="LECO Smart Care" <your_email@gmail.com>

# SMS Gateway (Text.lk)
SMS_API_TOKEN=your_textlk_token
SMS_SENDER_ID=TextLKDemo

# AI & LLM Engine
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```
Run database migrations and start server:
```bash
npm run dev
# Backend listening on http://localhost:3000
```

### 3. Machine Learning Microservice Startup
```bash
cd ../ml
python -m venv .venv
.venv\Scripts\activate   # Windows
source .venv/bin/activate # Linux/macOS
pip install -r requirements.txt
python -m uvicorn ml.main:app --host 127.0.0.1 --port 8000 --reload
# ML service running on http://127.0.0.1:8000
```

### 4. Customer Portal Startup
```bash
cd ../frontend/customer
npm install
npm run dev
# Customer Portal live on http://localhost:5173
```

### 5. Staff Portal Startup
```bash
cd ../frontend/staff
npm install
npm run dev -- --port 5174
# Staff Operations Console live on http://localhost:5174
```

### Verification and Test Suites
```bash
# Backend Test Suite (96/96 passing)
cd backend
npm test

# ML Test Suite (24/24 passing)
cd ../ml
pytest -o pythonpath=. test

# Production Builds
cd ../frontend/customer && npm run build
cd ../frontend/staff && npm run build
```

---

## Future Roadmap and License

- **Hardware MQTT Broker**: Direct CoAP and MQTT protocol gateway for ESP32 hardware meters.
- **Dynamic Time-of-Use Auto-Scheduling**: Automatic domestic appliance scheduling during off-peak windows (22:30-05:30).
- **Prosumer Solar P2P Energy Trading**: Blockchain-backed local energy marketplace allowing neighbors to trade surplus solar credits.

Developed for the **LECO Smart Electricity Metering Project**. Designed and engineered with modern web and machine learning standards.
