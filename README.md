# LECO Smart Electricity Metering & Bidirectional Grid Analytics Platform

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Tests-158%2F158%20Passing-brightgreen)]()

> An enterprise-grade, end-to-end Smart Prepaid Electricity Metering, Bidirectional Net-Metering, Adaptive Streaming Machine Learning, and Conversational AI Platform engineered for modern utility providers (Lanka Electricity Company - LECO) and domestic prosumers.

---

## Table of Contents
1. [Executive Summary and Platform Overview](#1-executive-summary-and-platform-overview)
2. [Key Innovations and Bidirectional Energy Accounting](#2-key-innovations-and-bidirectional-energy-accounting)
3. [Master System Topology and Architecture](#3-master-system-topology-and-architecture)
4. [Technology Stack Matrix](#4-technology-stack-matrix)
5. [Complete Sub-System Component Breakdown](#5-complete-sub-system-component-breakdown)
6. [Deep Dive: Machine Learning Forecasting Engine](#6-deep-dive-machine-learning-forecasting-engine)
   - [Architectural Philosophy](#61-architectural-philosophy)
   - [Data Ingestion and Preprocessing Pipeline](#62-data-ingestion-and-preprocessing-pipeline)
   - [Feature Engineering and Multi-Scale Cyclical Encodings](#63-feature-engineering-and-multi-scale-cyclical-encodings)
   - [Hybrid Online Streaming Algorithms](#64-hybrid-online-streaming-algorithms)
   - [Dynamic Softmax Weighting and Loss Memory](#65-dynamic-softmax-weighting-and-loss-memory)
   - [ADWIN Concept Drift Detection and Recovery](#66-adwin-concept-drift-detection-and-recovery)
   - [5-Stage Progressive Cold-Start Lifecycle](#67-5-stage-progressive-cold-start-lifecycle)
   - [Non-Linear PUCSL Balance Depletion Simulation](#68-non-linear-pucsl-balance-depletion-simulation)
   - [Solar PV Net Generation and Battery Degradation Forecasting](#69-solar-pv-net-generation-and-battery-degradation-forecasting)
   - [ML Microservice REST API Specification](#610-ml-microservice-rest-api-specification)
7. [Deep Dive: Conversational AI and Tri-Lingual RAG Chatbot](#7-deep-dive-conversational-ai-and-tri-lingual-rag-chatbot)
   - [Conversational Engine Architecture](#71-conversational-engine-architecture)
   - [TF-IDF Semantic Vector RAG Retriever](#72-tf-idf-semantic-vector-rag-retriever)
   - [7-Layer Security Prompt Guard and Sandboxing](#73-7-layer-security-prompt-guard-and-sandboxing)
   - [Dynamic Context Hydration from Live PostgreSQL](#74-dynamic-context-hydration-from-live-postgresql)
   - [Dual-Engine Redundancy: Groq Cloud LLM and Offline Engine](#75-dual-engine-redundancy-groq-cloud-llm-and-offline-engine)
   - [Tri-Lingual Engine (English, Sinhala, Tamil)](#76-tri-lingual-engine-english-sinhala-tamil)
   - [5 Core Conversational Domains and Intent Resolution](#77-5-core-conversational-domains-and-intent-resolution)
   - [Interactive Dashboard Actions and Special Value Highlighting](#78-interactive-dashboard-actions-and-special-value-highlighting)
8. [Prepaid Billing, PUCSL Tariffs, and Financial Engine](#8-prepaid-billing-pucsl-tariffs-and-financial-engine)
   - [PUCSL 2026 Domestic Block Tariff Structure](#81-pucsl-2026-domestic-block-tariff-structure)
   - [Non-Linear Tariff Boundary Transitions](#82-non-linear-tariff-boundary-transitions)
   - [PayHere Payment Gateway and Cryptographic IPN Verification](#83-payhere-payment-gateway-and-cryptographic-ipn-verification)
   - [Automated Statement and PDF Receipt Generation](#84-automated-statement-and-pdf-receipt-generation)
9. [Dual-Channel Verification and Communication Gateways](#9-dual-channel-verification-and-communication-gateways)
   - [Text.lk SMS Gateway Integration](#91-textlk-sms-gateway-integration)
   - [Nodemailer Email Gateway with Google App Passwords](#92-nodemailer-email-gateway-with-google-app-passwords)
   - [Dual-Channel OTP Synchronization Engine](#93-dual-channel-otp-synchronization-engine)
10. [Staff Operations Command and System Settings](#10-staff-operations-command-and-system-settings)
    - [Smart Meters Fleet Management and Telemetry Triage](#101-smart-meters-fleet-management-and-telemetry-triage)
    - [Remote Dynamic System Settings and API Key Management](#102-remote-dynamic-system-settings-and-api-key-management)
    - [Remote Feature Control Switches and Maintenance Mode](#103-remote-feature-control-switches-and-maintenance-mode)
11. [Database Schema and Complete Data Dictionary](#11-database-schema-and-complete-data-dictionary)
12. [Enterprise Security, Hardening, and Concurrency Controls](#12-enterprise-security-hardening-and-concurrency-controls)
13. [Installation, Local Development, and Verification Guide](#13-installation-local-development-and-verification-guide)
14. [Future Roadmap and License](#14-future-roadmap-and-license)

---

## 1. Executive Summary and Platform Overview

Traditional utility grids operate under post-paid, manual-read paradigms characterized by delayed billing cycles, prolonged outage detection, and one-directional power flows. The rapid proliferation of domestic rooftop solar photovoltaic (PV) generation has transformed conventional electricity consumers into **prosumers**—distributed micro-generators who consume energy from the utility grid while simultaneously injecting excess clean electricity back into the distribution network.

The **LECO Smart Electricity Meter Platform** is a smart utility management and analytics platform engineered to bridge consumer self-service with utility fleet operations. The system delivers:

1. **High-Frequency Bidirectional Telemetry (30-45s Cadence)**: Ingests active load readings, separates imported power from exported solar generation, and maintains live net-metered balances ($Net = In - Out$).
2. **Prepaid Smart Metering & Remote Relay Control**: Real-time balance debits, non-linear tariff burn rate forecasting, automated low-balance notifications, and remote latching relay actuation (instant automatic cutoff on credit exhaustion and rapid 10-30s reconnection upon successful top-up).
3. **Adaptive Online Machine Learning**: An autonomous streaming ML microservice (Python / FastAPI / River) that learns household consumption patterns on-the-fly without requiring pre-existing datasets.
4. **Conversational AI with RAG Architecture**: A tri-lingual smart energy assistant powered by Groq LLMs and a deterministic offline fallback engine, answering complex utility inquiries regarding consumption, savings, tariffs, account status, and technical complaints.
5. **Omnichannel Dual-Channel OTP Authentication**: Simultaneous verification code dispatch across Text.lk SMS and Nodemailer Gmail SMTP for registration, password reset, and profile validation.
6. **Centralized Staff Fleet Management**: An administrative operations portal providing real-time fleet health inspection, remote relay overrides, complaint dispatching, PayHere reconciliation, and live system settings configuration.

---

## 2. Key Innovations and Bidirectional Energy Accounting

### 2.1 Bidirectional Energy Accounting (In / Out / Net)
Electricity meters deployed in the system measure two distinct directional vectors:
- **`In` (Imported from Grid)**: Electricity drawn from the utility distribution grid to power household loads and domestic appliances.
- **`Out` (Exported to Grid)**: Clean electricity produced by rooftop solar PV systems or microgeneration equipment injected back into the grid.
- **`Net` ($In - Out$)**: The actual billable or creditable energy. When $In > Out$, the prosumer consumes net energy and is charged according to PUCSL domestic block rates; when $Out > In$, the prosumer generates net grid energy credits.

```
                    +------------------------------------+
                    |        LECO Distribution Grid      |
                    +------------------+-----------------+
                                       | ^
                 Power Imported (In)   | |  Power Exported (Out)
                                       v |
                    +------------------+-----------------+
                    |     LECO AMI Smart Meter (IoT)     |
                    |     Bidirectional Pulse Engine     |
                    +------------------+-----------------+
                                       | ^
                 Delivered Power       | |  Solar Generation
                                       v |
                    +------------------+-+       +-------------------+
                    | Domestic Appliances|       | Rooftop Solar PV  |
                    +--------------------+       +-------------------+
```

### 2.2 Dual-Line Analytical Visualizations
Rather than flattening consumption into a single number, both the Customer and Staff dashboards visualize power through dual-line metrics:
- **Coral/Red Vector (`In`)**: Real-time kW load and historical cumulative kWh drawn from the grid.
- **Emerald Vector (`Out`)**: Solar generation exported back to the distribution grid.
- **Net Metric Displays**: Live net power, weekly net averages, and real-time financial burn rates (LKR/day).

---

## 3. Master System Topology and Architecture

The platform follows a decoupled, multi-tier microservices architecture:

```mermaid
graph TD
    subgraph IoT and Edge Layer
        MTR[AMI Smart Meter Hardware / Simulator<br/>30-45s Ingestion Cadence]
    end

    subgraph Presentation Tier
        CP[Customer Portal<br/>React 19 + Vite :5173]
        SP[Staff Portal<br/>React 19 + Vite :5174]
    end

    subgraph Core Application Tier
        API[Node.js + Express REST API :3000]
        WS[Socket.io Real-Time WebSocket Hub]
        AUTH[Auth & Dual OTP Synchronizer]
        TARIFF[PUCSL Domestic Tariff Engine]
        PDF[PDFKit Document Factory]
        RAG[TF-IDF Vector RAG Engine]
        PG[7-Layer Prompt Security Guard]
        SETTINGS[Dynamic System Settings Service]
    end

    subgraph Machine Learning Microservice
        ML[Python FastAPI + Uvicorn :8000]
        PREPROC[Telemetry Preprocessor & Validator]
        FEAT[Cyclical Feature Engine]
        KALMAN[24-Channel Kalman Filter]
        RIVER[River Online Linear SGD Regressor]
        ARF[Adaptive Random Forest Regressor]
        ENSEMBLE[Dynamic Softmax Ensemble]
        ADWIN[ADWIN Concept Drift Monitor]
        SIM[Non-Linear Depletion Simulator]
    end

    subgraph Data Persistence Tier
        DB[(Neon Serverless PostgreSQL<br/>Connection Pooling & SSL)]
    end

    subgraph External Cloud Gateways
        GROQ[Groq Cloud LLM API<br/>Llama 3.3 / Qwen]
        SMS[Text.lk SMS Gateway]
        SMTP[Gmail SMTP / Nodemailer]
        PAYHERE[PayHere Payment Gateway]
    end

    MTR -->|HTTP POST Telemetry| API
    CP -->|REST / HttpOnly Cookie| API
    CP <-->|Bidirectional WebSockets| WS
    SP -->|REST / HttpOnly Cookie| API
    SP <-->|Staff Operational WebSockets| WS

    API --> AUTH
    API --> TARIFF
    API --> PDF
    API --> RAG
    API --> PG
    API --> SETTINGS
    RAG --> GROQ

    API -->|Async Telemetry Stream| ML
    ML --> PREPROC --> FEAT --> ENSEMBLE
    ENSEMBLE --> KALMAN
    ENSEMBLE --> RIVER
    ENSEMBLE --> ARF
    ENSEMBLE --> ADWIN
    ENSEMBLE --> SIM

    API -->|Connection Pool| DB
    ML -->|Read Aggregates| DB
    AUTH --> SMS
    API --> PAYHERE
```

### 3.1 Real-Time Telemetry and Ingestion Sequence Flow

The following sequence details how high-cadence meter telemetry flows from smart IoT edge hardware through the core ingestion pipeline to live dashboards:

```mermaid
sequenceDiagram
    autonumber
    participant Meter as Smart AMI Meter (IoT)
    participant Backend as Express REST API (:3000)
    participant DB as Neon PostgreSQL
    participant ML as ML Microservice (:8000)
    participant WS as Socket.io Gateway
    participant Portal as Customer & Staff Dashboards

    Meter->>Backend: POST /api/telemetry (Active In/Out, V, I, PF)
    Backend->>Backend: Verify PIN & Sanitize Payload
    Backend->>DB: Atomic INSERT into telemetry table
    par Real-Time Broadcast
        Backend->>WS: Emit meter_telemetry_event
        WS->>Portal: Push Live Pulse to Subscribed Rooms
    and Adaptive ML Ingestion
        Backend->>ML: POST /api/ml/telemetry/stream (Async)
        ML->>ML: Kalman Filter Update & Dynamic Softmax Adjustment
    end
    Backend-->>Meter: 200 OK (Relay State, Tariff Group, Synced Clock)
```

---

## 4. Technology Stack Matrix

| Layer | Technology | Version | Key Functionality |
|---|---|---|---|
| **Customer Frontend** | React / TypeScript / Vite | 19.x / 5.x | Self-care prosumer dashboard, live net charts, floating AI assistant |
| **Staff Frontend** | React / TypeScript / Vite | 19.x / 5.x | Grid fleet command, triage queue, PayHere ledger, system settings |
| **Styling & Design System** | Tailwind CSS v4 / Radix UI | 4.x / 1.x | Enterprise dark theme, custom HSL tokens, strictly zero emojis |
| **Backend REST API** | Node.js / Express.js | 22.x / 4.x | Core API, session management, billing solver, PDF generator |
| **Real-Time WebSockets** | Socket.io | 4.x | Event broadcasting (`meter_update`, `complaint_update`), zero-reload UI |
| **Database Tier** | Neon Serverless PostgreSQL | 16.x | Relational storage, connection pooling, automated schema migrations |
| **Machine Learning** | Python / FastAPI / Uvicorn | 3.12+ / 0.115+ | Streaming prequential inference, online ensemble, drift detection |
| **Streaming ML Engine** | River / NumPy / SciPy | 0.21+ / 1.26+ | Hoeffding tree regressors, Kalman filters, stochastic gradient descent |
| **Conversational AI** | Groq Cloud API | 0.11+ | Sub-second inference (`llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`) |
| **Vector Search / RAG** | In-Memory TF-IDF Engine | Native JS | Cosine similarity document ranking over PUCSL tariff and utility rules |
| **SMS Gateway** | Text.lk REST API v3 | API v3 | Trilingual transactional SMS notifications across Sri Lankan telcos |
| **Email Gateway** | Nodemailer (Gmail SMTP) | 6.10+ | Formatted corporate HTML email templates with 16-character App Passwords |
| **Payment Gateway** | PayHere API | v1.0 | Hosted checkout tokens, MD5 signature verification, IPN webhooks |
| **PDF Generation** | PDFKit | 0.15+ | PUCSL-compliant monthly statements and recharge receipts |

---

## 5. Complete Sub-System Component Breakdown

| Component ID | Sub-System Name | Directory / Path | Runtime / Port | Responsibility |
|---|---|---|---|---|
| **C-01** | Customer Portal | `frontend/customer` | Vite :5173 | Prosumer interface, balance monitor, payment checkout, AI assistant |
| **C-02** | Staff Portal | `frontend/staff` | Vite :5174 | Utility management, fleet command, complaints triage, settings |
| **C-03** | Core Express API | `backend/src/app.js` | Node :3000 | REST controllers, middleware pipeline, authentication, routing |
| **C-04** | Real-Time WebSocket Hub | `backend/src/config/socket.js` | Port 3000 (WS) | Pub/Sub event rooms partitioned by `meter_{id}` and `user_{id}` |
| **C-05** | Neon PostgreSQL Database | `backend/src/config/db.js` | Managed Cloud | Persistent ledger, transactional locking, connection retry engine |
| **C-06** | Adaptive ML Microservice | `ml/main.py` | FastAPI :8000 | Online energy forecasting, 24-step trajectory, depletion modeling |
| **C-07** | River Streaming Models | `ml/models/` | Python in-memory | Online Linear SGD, Adaptive Random Forest, 24-ch Kalman filter |
| **C-08** | ADWIN Drift Detector | `ml/models/drift.py` | Python in-memory | Real-time residual tracking and concept drift event mitigation |
| **C-09** | Non-Linear Prepaid Simulator | `ml/engines/prepaid_engine.py` | Python in-memory | Hour-by-hour PUCSL block tariff credit exhaustion modeling |
| **C-10** | PUCSL Tariff Solver | `backend/src/services/tariffEngine.js` | Node in-memory | Deterministic calculation of official 2026 domestic block rates |
| **C-11** | TF-IDF RAG Retriever | `backend/src/modules/chatbot/knowledge/` | Node in-memory | Semantic vector retrieval over indexed LECO domain guidelines |
| **C-12** | Groq Cloud LLM Client | `backend/src/modules/chatbot/services/groqClient.js` | HTTPS (Groq) | High-throughput LLM reasoning with circuit-breaker auto-fallback |
| **C-13** | Tri-Lingual Offline Bot | `backend/src/modules/chatbot/services/offlineEngine.js` | Node in-memory | Zero-downtime deterministic conversational engine (EN, SI, TA) |
| **C-14** | Prompt Security Guard | `backend/src/modules/chatbot/security/promptGuard.js` | Node in-memory | XML sandboxing, jailbreak defense, zero-emoji enforcement |
| **C-15** | Text.lk SMS Service | `backend/src/services/smsService.js` | HTTPS (Text.lk) | Trilingual transactional SMS dispatch and phone normalization |
| **C-16** | Nodemailer Email Service | `backend/src/services/emailService.js` | SMTP :465 (TLS) | Gmail App Password SMTP dispatch, HTML template generation |
| **C-17** | PayHere Payment Engine | `backend/src/services/payhereService.js` | HTTPS (PayHere) | Checkout tokenization, MD5 HMAC hash generation, IPN callback audit |
| **C-18** | System Settings Controller | `backend/src/services/systemSettingsService.js` | Node + DB | Live runtime API key updates and customer feature switches |

### 5.1 Core REST API Specification Matrix

The following specification details the primary REST endpoints exposed by the Core Express Application Tier:

| Domain | Method | Endpoint Path | Authentication Scope | Description |
|---|---|---|---|---|
| **Auth** | `POST` | `/api/auth/register/request-otp` | Public | Initiates dual-channel SMS/Email OTP verification |
| **Auth** | `POST` | `/api/auth/register/verify-otp` | Public | Validates OTP and registers customer profile |
| **Auth** | `POST` | `/api/auth/login` | Public | Authenticates credentials and sets `HttpOnly` cookie |
| **Auth** | `POST` | `/api/auth/logout` | Authenticated | Clears session cookie and invalidates token |
| **Meter** | `GET` | `/api/meters/my-meter` | Customer | Fetches linked smart meter info, balance, and status |
| **Meter** | `POST` | `/api/meters/link` | Customer | Cryptographically links physical meter via Serial & PIN |
| **Telemetry** | `POST` | `/api/telemetry` | Meter Device / Secret | Ingests 30-45s telemetry pulse (active in/out, V, I, PF) |
| **Telemetry** | `GET` | `/api/telemetry/history` | Customer / Staff | Fetches historical intervals with aggregation filters |
| **Billing** | `POST` | `/api/payments/payhere/initiate` | Customer | Generates PayHere checkout token and cryptographic hash |
| **Billing** | `POST` | `/api/payments/payhere/notify` | PayHere IPN | Verifies PayHere MD5 signature and credits wallet balance |
| **Billing** | `GET` | `/api/payments/receipt/:id/pdf` | Customer | Generates printable PDF payment receipt via PDFKit |
| **Chatbot** | `POST` | `/api/chatbot/message` | Customer / Staff | Sends prompt to Groq RAG / offline tri-lingual assistant |
| **Chatbot** | `GET` | `/api/chatbot/status` | Public | Returns engine availability and active LLM configuration |
| **Staff** | `GET` | `/api/staff/meters` | Staff Role | Queries all smart meters with fleet connectivity status |
| **Staff** | `POST` | `/api/staff/meters/:id/relay` | Staff Role | Remotely overrides physical relay (connect / disconnect) |
| **Staff** | `GET` | `/api/staff/settings` | Staff Admin | Inspects dynamically stored runtime system configuration |
| **Staff** | `PUT` | `/api/staff/settings` | Staff Admin | Live updates API keys, thresholds, and feature flags |
| **ML Engine** | `GET` | `/api/ml/health` | Service / Public | Reports ML model status, drift metrics, and memory pool |
| **ML Engine** | `POST` | `/api/ml/forecast/24h` | Backend Inter-service | Computes 24-hour progressive load forecast trajectory |
| **ML Engine** | `POST` | `/api/ml/balance/depletion` | Backend Inter-service | Simulates non-linear PUCSL tariff wallet credit exhaustion |

### 5.2 WebSocket Real-Time Events Catalog

The Socket.io gateway establishes low-latency bidirectional pub/sub channels partitioned by cryptographically authenticated user sessions and meter rooms:

| Event Name | Direction | Room Scope | Payload Attributes | Description |
|---|---|---|---|---|
| `join_meter` | Client $\to$ Server | `meter_{id}` | `{ meterId: number }` | Subscribes client session to real-time meter pulse events |
| `leave_meter` | Client $\to$ Server | `meter_{id}` | `{ meterId: number }` | Unsubscribes client session when navigating away from dashboard |
| `meter_update` | Server $\to$ Client | `meter_{id}`, `all_meters` | `balance, kwLoad, voltage, status` | Broadcasts immediate 30-45s telemetry and balance debits |
| `notification` | Server $\to$ Client | `user_{id}` | `title, message, type, timestamp` | Pushes instant low-balance alerts, top-up receipts, and warnings |
| `complaint_update` | Server $\to$ Client | `user_{id}`, `staff_room` | `ticketId, status, notes, updated_at` | Synchronizes complaint resolution stages between staff & consumer |
| `settings_updated` | Server $\to$ Client | `staff_room` | `category, key, timestamp` | Live-notifies staff consoles when system API keys are modified |

---

## 6. Deep Dive: Machine Learning Forecasting Engine

The LECO Machine Learning Service (`ml/`) is an adaptive, online streaming inference engine engineered specifically for domestic electricity consumption forecasting under Sri Lanka's non-linear PUCSL domestic block tariff structure.

### 6.1 Architectural Philosophy
1. **Zero Cold-Start Dependency**: Operates immediately upon smart meter activation without requiring months of historical baseline datasets.
2. **Prequential Evaluation (Test-Then-Train)**: Models predict the incoming metric $H+1$ first, record the residual prediction error, and only then update their weights with the ground-truth observation.
3. **Physical Energy Prediction vs. Financial Calculation**: Models predict physical units ($\text{kWh}$); the deterministic tariff engine computes financial liability ($\text{LKR}$).
4. **Missing Telemetry Safety**: Telemetry gaps are explicitly flagged; missing pulses are never assumed to represent zero energy consumption.

```
Incoming Telemetry Pulse (30-45s)
               |
               v
      Ingestion & Validation
 (Deduplication, Rollover Check)
               |
               v
     Feature Engineering Engine
 (Cyclical Encodings & Lag Buffers)
               |
  +------------+------------+
  |                         |
  v                         v
Model 1: 24-Channel       Model 2: Online SGD      Model 3: Adaptive
Kalman Filter + EWMA      Linear Regressor         Random Forest
  |                         |                         |
  +------------+------------+-------------------------+
               |
               v
    Dynamic Softmax Ensemble
  (Weighted by Recent MASE Loss)
               |
               v
    ADWIN Concept Drift Engine
  (Monitors Prediction Residuals)
               |
               v
  Hour-by-Hour Non-Linear PUCSL
   Balance Depletion Simulator
```

### 6.2 Data Ingestion and Preprocessing Pipeline
Incoming telemetry pulses arrive every 30 to 45 seconds from physical AMI meters or hardware simulators (`POST /api/ml/telemetry/ingest`):
1. **Pulse Deduplication**: Suppresses redundant readings if hardware transmits duplicate timestamps.
2. **Meter Counter Rollover Detection**: Detects register overflows or hardware resets (e.g., cumulative register jumping from $99,999.9\text{ kWh}$ to $0.0\text{ kWh}$).
3. **Delta Calculation**: Derives true interval consumption ($\Delta \text{kWh} = \text{Reading}_t - \text{Reading}_{t-1}$) and converts it to equivalent active load ($\text{kW} = \frac{\Delta \text{kWh}}{\Delta t_{\text{hours}}}$).
4. **Hourly Bucketing**: Aggregates readings into discrete 60-minute historical bins (`meter_hourly_aggregation` table in PostgreSQL).

### 6.3 Feature Engineering and Multi-Scale Cyclical Encodings
The feature engine (`ml/features/feature_builder.py`) converts raw timestamps and historical usage into a 16-dimensional feature vector:

1. **Cyclical Temporal Encodings**:
   $$\text{hour\_sin} = \sin\left(\frac{2\pi \cdot \text{hour}}{24}\right), \quad \text{hour\_cos} = \cos\left(\frac{2\pi \cdot \text{hour}}{24}\right)$$
   $$\text{dow\_sin} = \sin\left(\frac{2\pi \cdot \text{dow}}{7}\right), \quad \text{dow\_cos} = \cos\left(\frac{2\pi \cdot \text{dow}}{7}\right)$$
   *Mathematical Rationale*: Ensures that hour 23 (23:00) and hour 0 (00:00) have continuous Euclidean proximity rather than being separated by a distance of 23 units.
2. **Multi-Scale Lag Buffers**:
   - Lag 1 Hour ($L_1$): Immediate momentum.
   - Lag 2 Hours ($L_2$): Short-term acceleration.
   - Lag 24 Hours ($L_{24}$): Diurnal periodicity (same hour yesterday).
   - Lag 168 Hours ($L_{168}$): Weekly periodicity (same day and hour last week).
3. **Rolling Aggregate Statistics**:
   - 6-Hour Rolling Mean and Standard Deviation: Captures morning/evening active blocks.
   - 24-Hour Rolling Consumption and Volatility Index: Tracks overall daily load intensity.
4. **Exponential Moving Averages**:
   - Fast EWMA ($\alpha = 0.3$): High responsiveness to sudden load spikes.
   - Slow EWMA ($\alpha = 0.05$): Baseline household consumption stability.

### 6.4 Hybrid Online Streaming Algorithms
The engine coordinates three distinct online algorithms running concurrently:

1. **24-Channel Diurnal Kalman Filter + EWMA (`EwmaKalmanModel`)**:
   Maintains 24 discrete state estimates corresponding to each hour of the day. For each hour $h \in [0, 23]$:
   - State prediction: $\hat{x}_{t|t-1} = \hat{x}_{t-1}$
   - Covariance prediction: $P_{t|t-1} = P_{t-1} + Q$
   - Kalman Gain calculation:
     $$K_t = \frac{P_{t|t-1}}{P_{t|t-1} + R}$$
   - State update:
     $$\hat{x}_{t|t} = \hat{x}_{t|t-1} + K_t (y_t - \hat{x}_{t|t-1})$$
   - Covariance update: $P_{t|t} = (1 - K_t) P_{t|t-1}$
2. **Online Linear SGD Regressor (`OnlineLinearModel`)**:
   Powered by River (`river.linear_model.LinearRegression`). Optimizes weights via Stochastic Gradient Descent with $L_2$ regularization:
   $$\mathcal{L}(w) = \frac{1}{2} (\hat{y} - y)^2 + \frac{\alpha}{2} \|w\|_2^2$$
   $$w_{t+1} = w_t - \eta \cdot \left((\hat{y}_t - y_t) x_t + \alpha w_t\right)$$
   Where $\eta$ is an adaptive learning rate automatically scaled by River's gradient tracker.
3. **Adaptive Random Forest (`AdaptiveForestModel`)**:
   Powered by River (`river.forest.ARFRegressor`). Maintains an ensemble of streaming Hoeffding Trees. Splits on continuous features using the statistical Hoeffding Bound:
   $$\epsilon = \sqrt{\frac{R^2 \ln(1/\delta)}{2n}}$$
   Ensures that streaming splits made after observing $n$ samples are mathematically guaranteed to match batch splits with confidence $1 - \delta$.

### 6.5 Dynamic Softmax Weighting and Loss Memory
Individual model predictions are weighted dynamically according to their recent rolling Mean Absolute Scaled Error (MASE):

$$w_i = \frac{\exp(-\eta \cdot L_i)}{\sum_{j=1}^3 \exp(-\eta \cdot L_j)}$$

$$\hat{y}_{\text{ensemble}} = \sum_{i=1}^3 w_i \cdot \hat{y}_i$$

Where $L_i$ represents the exponentially smoothed absolute error for model $i$:
$$L_{i, t} = \beta L_{i, t-1} + (1 - \beta) |y_t - \hat{y}_{i, t}|$$
With smoothing factor $\beta = 0.85$ and learning rate $\eta = 0.15$. Models with lower recent errors automatically receive higher prediction weight.

#### 6.5.1 Prediction Uncertainty and Dynamic Confidence Intervals

To prevent misleading precision, the ML service returns bounded $95\%$ confidence intervals $[ \hat{y}_{\text{lower}}, \hat{y}_{\text{upper}} ]$ for every projected hourly step:

$$\sigma_t = \sqrt{ \sum_{i=1}^3 w_i (\hat{y}_{i, t} - \hat{y}_{\text{ensemble}, t})^2 + \sigma^2_{\text{residual}} } \cdot \gamma_{\text{stage}}$$

$$\hat{y}_{\text{upper}, t} = \hat{y}_{\text{ensemble}, t} + 1.96 \cdot \sigma_t$$
$$\hat{y}_{\text{lower}, t} = \max\left(0, \hat{y}_{\text{ensemble}, t} - 1.96 \cdot \sigma_t\right)$$

Where:
- $\sigma_{\text{residual}}$ is the running standard deviation of prequential residuals over the trailing 72 hours.
- $\gamma_{\text{stage}} \in [1.0, 2.5]$ is a cold-start expansion penalty that widens bands when historical sample counts are small ($N < 168$).
- Non-negativity constraint ensures physical realism ($\hat{y} \ge 0$).


### 6.6 ADWIN Concept Drift Detection and Recovery
Household consumption habits change abruptly when new appliances (e.g., air conditioners or EV chargers) are introduced, or during holiday periods. The **ADWIN (Adaptive Windowing)** algorithm (`ml/models/drift.py`) continuously tracks the stream of prediction residuals:
- ADWIN maintains a sliding window $W$ of residuals that automatically expands during stationary periods.
- When an abrupt shift occurs, ADWIN tests all sub-window splits ($W_0, W_1$):
  $$|\mu_{W_0} - \mu_{W_1}| \ge \epsilon_{\text{cut}} = \sqrt{\frac{1}{2m} \ln\left(\frac{4n}{\delta}\right)}$$
  Where $m = \frac{1}{1/n_0 + 1/n_1}$ and $\delta = 0.002$.
- When concept drift is triggered:
  1. Old sub-window $W_0$ is pruned.
  2. The ensemble learning rate $\eta$ is doubled for 24 hours.
  3. Prediction uncertainty intervals ($\sigma$) are expanded by $1.4\times$.
  4. The model accelerates adaptation to the new consumption baseline.

### 6.7 5-Stage Progressive Cold-Start Lifecycle

```
[Day 0: 0-2 samples]       --> Stage 1: NO_HISTORY (Population Baseline Prior)
                                     |
[Day 1: 3-24 samples]      --> Stage 2: FIRST_24_HOURS (EWMA + Kalman Diurnal Baseline)
                                     |
[Days 2-7: 25-168 samples] --> Stage 3: DAYS_2_TO_7 (Kalman + Online Linear SGD)
                                     |
[Days 7-30: 169-720 samples]-> Stage 4: DAYS_7_TO_30 (Full Ensemble + Hoeffding Forest)
                                     |
[Day 30+: >720 samples]    --> Stage 5: MATURE_STREAM (Fully Dynamic Softmax + ADWIN Drift)
```

| Cold-Start Stage | Observation Window | Active Models & Weights | Operational Characteristics |
|---|---|---|---|
| **`NO_HISTORY`** | 0 to 2 samples | Population Prior ($100\%$) | Assigns default prior ($0.35\text{ kWh/h}$); uncertainty score = $1.0$. |
| **`FIRST_24_HOURS`** | 3 to 24 samples | EWMA + Kalman ($100\%$) | Quickly learns the 24-hour diurnal usage profile. |
| **`DAYS_2_TO_7`** | 25 to 168 samples | Kalman ($60\%$) + Linear ($40\%$) | Captures weekday vs. weekend divergence and trend momentum. |
| **`DAYS_7_TO_30`** | 169 to 720 samples | Full Ensemble (Softmax) | Detects non-linear multi-appliance interactions. |
| **`MATURE_STREAM`** | > 720 samples | Full Ensemble + ADWIN | Full autonomous streaming adaptation with active drift monitoring. |

### 6.8 Non-Linear PUCSL Balance Depletion Simulation
Standard linear division ($\text{Days} = \frac{\text{Balance}}{\text{Daily Cost}}$) produces errors exceeding $40\%$ under block tariffs because marginal rates jump abruptly when consumption crosses from Group A to Group B or C.

The simulation pipeline (`ml/engines/prepaid_engine.py`) executes an hour-by-hour projection:
1. Advances simulation hour-by-hour ($t = 1, 2, \dots, 2160\text{ hours}$).
2. Tracks cumulative monthly cycle energy ($\text{cycleKWh}$). If a 30-day boundary is reached, resets cycle energy to 0.
3. Retrieves baseline hourly prediction $\hat{y}_t$ from the ensemble.
4. Computes the exact incremental PUCSL tariff liability:
   $$\Delta \text{Cost}_t = f_{\text{PUCSL}}(\text{cycleKWh} + \hat{y}_t) - f_{\text{PUCSL}}(\text{cycleKWh})$$
5. Deducts $\Delta \text{Cost}_t$ from the remaining simulated balance:
   $$B_t = B_{t-1} - \Delta \text{Cost}_t$$
6. Terminates when $B_t \le 0$; interpolates the final fractional hour to yield the exact predicted exhaustion timestamp.

Three distinct scenarios are simulated:
- **Optimistic ($15\text{th}$ Percentile)**: Frugal energy conservation scenario $\implies$ **Maximum Days Remaining**.
- **Expected / Median ($50\text{th}$ Percentile)**: Baseline projection $\implies$ **Estimated Days Remaining**.
- **Conservative ($85\text{th}$ Percentile)**: High-load warning scenario $\implies$ **Early Recharging Alert Threshold**.

### 6.9 Solar PV Net Generation and Battery Degradation Forecasting
For prosumers with rooftop solar installations, the engine models net grid interactions:
1. **Solar Yield Curve**: Employs a solar insolation model parameterized by hour of day, latitude ($6.927^\circ \text{N}$ Colombo), and seasonal solar elevation angle.
2. **Net Energy Formulation**:
   $$\text{Net}_t = \max(0, \text{Demand}_t - \text{Solar}_t)$$
   $$\text{Export}_t = \max(0, \text{Solar}_t - \text{Demand}_t)$$
3. **Battery Degradation & State-of-Health (SoH)**: Projects battery capacity fade using cycle-counting and depth-of-discharge (DoD) stress formulas.

### 6.10 ML Microservice REST API Specification
- `POST /api/ml/telemetry/ingest`: High-frequency pulse ingestion (30-45s cadence).
- `POST /api/ml/telemetry/batch`: Batch telemetry synchronization.
- `GET /api/ml/forecast/hourly/{meter_id}`: 24-step recursive hourly forecast with upper/lower confidence bands.
- `GET /api/ml/forecast/prepaid/{meter_id}?balance={amount}`: Non-linear tariff balance depletion projection.
- `GET /api/ml/forecast/postpaid/{meter_id}`: End-of-cycle bill projection under PUCSL tariffs.
- `GET /api/ml/forecast/demand/{meter_id}`: Next-month total energy demand and recommended top-up amount.
- `GET /api/ml/models/status/{meter_id}`: Active model weights, sample counts, and cold-start stage.
- `GET /api/ml/models/drift/{meter_id}`: Historical concept drift log and timestamped drift events.
- `GET /api/ml/health`: Microservice health check and engine telemetry.

---

## 7. Deep Dive: Conversational AI and Tri-Lingual RAG Chatbot

The LECO Smart Energy Assistant (`backend/src/modules/chatbot/`) is a conversational agent combining Retrieval-Augmented Generation (RAG), live PostgreSQL account telemetry hydration, prompt security sandboxing, and tri-lingual operational capabilities.

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer / Browser
    participant PG as Prompt Security Guard
    participant DB as PostgreSQL Database
    participant RAG as TF-IDF RAG Retriever
    participant LLM as Groq LLM Cloud
    participant OFFLINE as Tri-Lingual Offline Engine
    participant ACT as Action Detector

    User->>PG: "How many days of electricity do I have left?"
    PG->>PG: Step 1: Detect Language (en / si / ta)
    PG->>PG: Step 2: Sanitize Injection & Strip Emojis
    PG->>PG: Step 3: Wrap Query in <untrusted_user_query>
    
    par Context Gathering
        PG->>DB: Query Live Balance, Telemetry & ML Prediction
        DB-->>PG: Return User Snapshot (Balance, kWh, Days)
    and RAG Knowledge Retrieval
        PG->>RAG: Retrieve Top LECO Documents (TF-IDF Cosine Similarity)
        RAG-->>PG: Injected Chunks (Tariffs, Lifeline, Recharging)
    end

    alt Groq Cloud LLM Available
        PG->>LLM: Dispatch System Prompt + Hydrated Context + Sandboxed Query
        LLM-->>PG: Generated LLM Text (Sub-second response)
    else Groq Rate-Limited / Offline / Timeout (>8s)
        PG->>OFFLINE: Dispatch to Local Tri-Lingual Knowledge Engine
        OFFLINE-->>PG: Synthesized Domain Answer with Real Data
    end

    PG->>ACT: Scan Answer for Menu Mentions (Payments, History, Complaints)
    ACT-->>User: Structured Response (Text + Action Buttons + Metadata)
```

### 7.1 Conversational Engine Architecture
The chatbot operates through a 9-step decoupled pipeline:
1. **Request Ingestion**: Captures user message, active meter context, and conversation history via `POST /api/chat`.
2. **Language Identification**: Automatically detects whether input is in English (`en`), Sinhala (`si`), or Tamil (`ta`).
3. **Security Sandboxing**: Neutralizes prompt injection patterns and wraps text inside XML boundaries.
4. **Account Snapshot Hydration**: Queries PostgreSQL to assemble live account facts (balance, today's kWh, monthly usage, prediction, complaints).
5. **RAG Vector Search**: Indexes LECO domain documents and extracts the top 2-3 most relevant passages.
6. **Prompt Assembly**: Synthesizes system instructions, context snapshot, knowledge chunks, and the sandboxed query.
7. **Primary Cloud Inference**: Executes inference via the Groq API (`llama-3.3-70b-versatile` or `qwen/qwen3.8-27b`).
8. **Deterministic Offline Fallback**: If Groq is unavailable, times out, or returns HTTP 429, routes to the local offline engine.
9. **Action & Special Value Enrichment**: Attaches interactive navigation buttons and highlights currency, power, and time values.

### 7.2 TF-IDF Semantic Vector RAG Retriever
The internal knowledge base (`lecoKnowledgeDocs.js`) stores curated LECO utility documentation across 6 categories:
- `pucsl_domestic_tariffs`: Official 2026 tariff structure, block boundaries, fixed charges.
- `tou_time_of_use`: Peak (18:30-22:30), Day (05:30-18:30), and Off-Peak (22:30-05:30) rules.
- `lifeline_mode_emergency_credit`: Rs. 500 buffer, night disconnection protection, auto-recovery.
- `payments_and_recharging`: PayHere checkout, bank apps, transaction verification.
- `smart_meter_hardware`: LED status indicators, latching relay mechanics, solar net metering.
- `complaints_and_emergency`: Breakdown ticketing, dispute resolution, 24/7 Hotline 1987.

The vector retriever (`ragRetriever.js`) scores documents using Term Frequency-Inverse Document Frequency (TF-IDF):
$$\text{TF}(t, d) = \frac{f_{t, d}}{\sum_{t' \in d} f_{t', d}}, \quad \text{IDF}(t, D) = \ln\left(\frac{|D|}{1 + |\{d \in D : t \in d\}|}\right)$$
$$\text{Similarity}(q, d) = \frac{\vec{q} \cdot \vec{d}}{\|\vec{q}\|_2 \|\vec{d}\|_2}$$
The highest-scoring passages are extracted and injected into the LLM system prompt.

### 7.3 7-Layer Security Prompt Guard and Sandboxing
To protect against adversarial prompt injection, jailbreaking, and cross-session contamination, `promptGuard.js` applies 7 protective layers:

```
[Layer 1] Regex Pattern Matching: Flags known jailbreak triggers ("ignore previous instructions", "DAN mode")
    |
[Layer 2] XML Prompt Sandboxing: Encloses user query in <untrusted_user_query> tags
    |
[Layer 3] Delimiter Spoofing Neutralization: Strips injected XML/markdown formatting
    |
[Layer 4] System Extraction Immunity: Rejects attempts to extract system prompt or API credentials
    |
[Layer 5] Token Length & Rate Bounding: Enforces 500-character input caps and sliding rate limits
    |
[Layer 6] Strict Zero-Emoji Sanitization: Strips all Unicode emoji glyphs from inputs and outputs
    |
[Layer 7] Post-Generation Validator: Validates model output before returning response to client
```

### 7.4 Dynamic Context Hydration from Live PostgreSQL
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
When a customer asks *"How much power do I have left?"*, the assistant does not speak in generic terms; it computes an exact answer based on their live balance and burn rate.

### 7.5 Dual-Engine Redundancy: Groq Cloud LLM and Offline Engine
- **Primary Cloud Engine (`groqClient.js`)**: Executes high-throughput inference using `qwen/qwen3.8-27b` and `llama-3.3-70b-versatile`. Configured with an 8-second circuit-breaker timeout and automatic rate-limit (HTTP 429) backoff.
- **Tri-Lingual Offline Engine (`offlineEngine.js`)**: A deterministic rule and template engine that runs locally in Node.js. If Groq is unconfigured or offline, it synthesizes responses across all 5 core domains (Usage, Savings, Account, Complaints, General) with 100% availability.

### 7.6 Tri-Lingual Engine (English, Sinhala, Tamil)
The assistant natively supports all three official languages of Sri Lanka:
- **English (`en`)**: Primary operational interface.
- **Sinhala (`si`)**: Native script support (සිංහල), utilizing Sinhala energy terms (විදුලි පරිභෝජනය, ගාස්තු කාණ්ඩ, ක්ෂණික ගෙවීම්).
- **Tamil (`ta`)**: Native script support (தமிழ்), utilizing Tamil utility terms (மின்சார பயன்பாடு, கட்டண நிலுவை, அவசர உதவி).

Language is automatically inferred from customer dashboard settings or dynamically detected from input character Unicode ranges:
- Sinhala Unicode range: `\u0D80` - `\u0DFF`
- Tamil Unicode range: `\u0B80` - `\u0BFF`

### 7.7 5 Core Conversational Domains and Intent Resolution
The assistant handles 5 distinct functional categories:
1. **Electricity Usage & Live Telemetry**: Live power (kW), cumulative kWh, daily averages, and historical comparisons.
2. **Energy Saving Tips & Suggestions**: Customized saving suggestions tailored to the customer's active consumption patterns (e.g., advising night-shifting when evening peak usage is high).
3. **Account & Balance Management**: Available prepaid balance, run-out projections, and Lifeline overdraft buffer activation.
4. **Billing, Tariffs & PUCSL Inquiries**: Block tariff rate schedules, slab boundaries, fixed charges, and fuel surcharges.
5. **Complaints, Outages & Emergency Breakdown**: Technician dispatch status, breakdown filing, and direct access to Hotline **1987**.

### 7.8 Interactive Dashboard Actions and Special Value Highlighting
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

## 8. Prepaid Billing, PUCSL Tariffs, and Financial Engine

### 8.1 PUCSL 2026 Domestic Block Tariff Structure
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

### 8.2 Non-Linear Tariff Boundary Transitions
At **61 kWh** and **181 kWh**, earlier units are retroactively repriced under the higher structure:
- Crossing **60 to 61 kWh**: Bill jumps from LKR 630 to LKR 1,260 (+LKR 630).
- Crossing **180 to 181 kWh**: Bill jumps from LKR 6,420 to LKR 8,450 (+LKR 2,030).

The platform's prediction engine forecasts these boundary crossings in advance to alert consumers before they jump into higher tariff brackets.

### 8.3 PayHere Payment Gateway and Cryptographic IPN Verification
Online balance top-ups integrate with Sri Lanka's leading digital payment processor, **PayHere**:
1. **Checkout Tokenization**: Client requests a signed checkout payload (`POST /api/payments/payhere/checkout`).
2. **MD5 HMAC Signature**:
   $$\text{Hash} = \text{MD5}(\text{MerchantID} + \text{OrderID} + \text{Amount} + \text{Currency} + \text{MD5}(\text{MerchantSecret}))$$
3. **Server-to-Server IPN Callback**: PayHere notifies `/api/payments/payhere/notify` via secure POST webhook.
4. **Signature Verification**: Validates incoming `md5sig` against recalculation. Tampered payloads are rejected with HTTP 400.
5. **Atomic Balance Top-up**: Credits meter balance, settles Lifeline overdraft debts, logs transaction reference, and emits real-time WebSocket updates.

### 8.4 Automated Statement and PDF Receipt Generation
The server embeds a PDF generation pipeline using `PDFKit` (`pdfService.js`):
- **Official Monthly Statements**: Renders customer account metadata, meter number, 30-day consumption summary, block tariff rate breakdown, fixed charges, fuel surcharges, and total bill.
- **Recharge Receipts**: Generates downloadable PDF receipts containing unique transaction identifiers (`TXN-...`), previous balance, credited amount, new balance, and digital authenticity watermarks.

---

## 9. Dual-Channel Verification and Communication Gateways

### 9.1 Text.lk SMS Gateway Integration
- Dispatches transactional SMS alerts to Sri Lankan mobile networks (Mobitel, Dialog, Airtel, Hutch).
- Phone number normalization ensures local formats (`07X-XXXXXXX`) are parsed to international standard (`947XXXXXXXX`).
- Dynamic sender ID support (defaults to `TextLKDemo` or registered utility masks).

### 9.2 Nodemailer Email Gateway with Google App Passwords
- Direct integration with Google SMTP (`smtp.gmail.com:465` SSL).
- Supports Google 16-character App Passwords generated under 2-Step Verification.
- Automated sanitization strips spaces from copied app passwords (`abcd efgh ijkl mnop` $\to$ `abcdefghijklmnop`).
- Responsive, zero-emoji HTML email template featuring LECO corporate branding, high-contrast typography, and security warning notices.

### 9.3 Dual-Channel OTP Synchronization Engine
- Both SMS and Email receive the identical 6-digit verification code simultaneously.
- Users can verify using whichever communication channel reaches their device first.
- Rate-limited generation prevents brute-force abuse (maximum 5 attempts per window).

---

## 10. Staff Operations Command and System Settings

The Staff Portal (`frontend/staff`) provides an administrative command center for grid engineers and support supervisors.

### 10.1 Smart Meters Fleet Management and Telemetry Triage
- **Smart Meters Fleet Command**: Live monitoring of all connected meters, active balances, emergency credit states, daily kWh averages, and remote relay actuation (Cutoff / Reconnect).
- **Complaints Queue**: Triage customer disputes, update resolution stages (Investigating, Field Dispatched, Resolved), and push resolution notices.
- **PayHere Payment Ledger**: Review raw IPN callbacks, digital signatures, and execute manual reconciliations.

### 10.2 Remote Dynamic System Settings and API Key Management
Staff can configure production API credentials at runtime without restarting servers or editing `.env` files:
- **Groq API Key and Model**: Update LLM tokens and switch models (`llama-3.3-70b-versatile`, `qwen/qwen3.8-27b`).
- **Text.lk SMS Gateway**: Update SMS API bearer token and sender ID mask.
- **PayHere Gateway**: Update Merchant ID, Secret, and toggle Sandbox vs. Live mode.
- **Email Gateway**: Update sender Gmail address, App Password, and run live diagnostic test emails.

### 10.3 Remote Feature Control Switches and Maintenance Mode
Staff can remotely enable or disable features on the customer portal in real time:
- `feature_ai_chatbot`: Toggle customer AI assistant visibility.
- `feature_online_topup`: Enable or disable PayHere checkout.
- `feature_ml_prediction`: Toggle consumption forecasting cards.
- `feature_lifeline_mode`: Enable or disable Emergency Credit overdraft.
- `feature_complaints_portal`: Toggle ticket submission portal.
- `feature_solar_telemetry`: Toggle solar PV net-export displays.
- `maintenance_mode`: Broadcast an advisory banner to all customer sessions with custom messaging.

### 10.4 Smart Meter Telemetry Ingestion & Hardware Simulator

The platform supports both physical ESP32 AMI edge hardware and simulated pulse generators via high-frequency telemetry endpoints (`ml/feed_telemetry.py`):

#### Telemetry Pulse Payload Specification (JSON)
```json
{
  "meter_id": 101,
  "timestamp": "2026-10-28T03:45:00.000Z",
  "cumulative_kwh": 348.42,
  "prepaid_balance": 1850.50,
  "connection_type": "prepaid",
  "tariff_id": "DOMESTIC_D1",
  "billing_cycle_day": 14,
  "voltage": 230.4,
  "current_amps": 4.12,
  "power_factor": 0.96,
  "solar_export_kwh": 12.85
}
```

#### Running the Multi-Meter Telemetry Simulator
To test live dashboard graphs and ML learning streaming without physical hardware:
```bash
# Stream 100 sample intervals across linked meters
python ml/feed_telemetry.py --meters 101,102 --interval 30 --noise 0.05
```

---

## 11. Database Schema and Complete Data Dictionary

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

## 12. Enterprise Security, Hardening, and Concurrency Controls

1. **Idempotency Control**: Payment top-ups require an `Idempotency-Key` header. Duplicate submissions are intercepted via PostgreSQL unique constraints and replayed without re-debiting.
2. **Cryptographic PIN Protection**: Smart meter PINs are hashed with Bcrypt (10 salt rounds). Hardware verification uses constant-time comparison to prevent timing attacks.
3. **Session Cookie Security**: JWTs are transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Strict` cookies, immune to JavaScript XSS exfiltration.
4. **Origin Whitelisting**: State-changing endpoints validate browser `Origin` headers against trusted customer and staff domains.
5. **Database Resilience Engine**: All pool queries run through an automatic retry handler that absorbs transient serverless disconnects and network drops.
6. **Input Sanitization**: Global recursive middleware strips HTML, script tags, and SQL injection vectors before payloads reach controllers.
7. **Strict No-Emoji Rule**: Enterprise standard eliminating all emoji characters from UI designs, emails, SMS alerts, and chatbot responses.

---

## 13. Installation, Local Development, and Verification Guide

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

#### Environment Variable Specification Matrix

| Variable Name | Required | Default | Scope | Description |
|---|---|---|---|---|
| `PORT` | Optional | `3000` | Backend | HTTP Port for the Core Node.js Express Server |
| `DATABASE_URL` | **Required** | - | Backend / ML | Neon PostgreSQL connection URI with SSL mode enabled |
| `DATABASE_SSL` | Optional | `true` | Backend | Enforce verified TLS connection pooling |
| `JWT_SECRET` | **Required** | - | Backend | High-entropy secret key (>=32 chars) for signing session JWTs |
| `FRONTEND_URL` | Optional | `http://localhost:5173` | Backend | Whitelisted origin for Customer Portal CORS & cookies |
| `STAFF_FRONTEND_URL`| Optional | `http://localhost:5174` | Backend | Whitelisted origin for Staff Operations Console CORS |
| `ML_SERVICE_URL` | Optional | `http://localhost:8000` | Backend | Gateway address of the Python streaming ML microservice |
| `ML_SERVICE_TOKEN`| Optional | - | Backend / ML | Shared symmetric bearer token for inter-service communication |
| `PAYHERE_MERCHANT_ID` | Optional | - | Backend | PayHere Merchant ID for prepaid wallet top-up processing |
| `PAYHERE_MERCHANT_SECRET` | Optional | - | Backend | PayHere Merchant Secret for SHA-256 IPN checksum verification |
| `PAYHERE_SANDBOX` | Optional | `true` | Backend | Enable PayHere sandbox mode for mock payment simulations |
| `SMS_API_TOKEN` | Optional | - | Backend | Text.lk Bearer Token for dual-channel OTP and relay notifications |
| `SMS_SENDER_ID` | Optional | `TextLKDemo` | Backend | Registered Sender ID for outbound telecommunication messages |
| `GROQ_API_KEY` | Optional | - | Backend | Groq Cloud API key for high-speed Llama 3.3 / Qwen inference |
| `GROQ_MODEL` | Optional | `llama-3.3-70b-versatile` | Backend | Model identifier for Conversational RAG Engine |
| `SMTP_HOST` | Optional | `smtp.gmail.com` | Backend | Outbound mail gateway SMTP hostname |
| `SMTP_PORT` | Optional | `465` | Backend | SSL port for secure transactional email delivery |
| `SMTP_USER` | Optional | - | Backend | Authenticated Gmail address for OTP and PDF statement dispatch |
| `SMTP_PASS` | Optional | - | Backend | 16-character Google App Password (not account password) |
| `EMAIL_FROM` | Optional | `LECO Smart Care` | Backend | Sender header signature formatted for email clients |

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

## 14. Future Roadmap and License

- **Hardware MQTT Broker**: Direct CoAP and MQTT protocol gateway for physical ESP32 hardware meters.
- **Dynamic Time-of-Use Auto-Scheduling**: Automatic domestic appliance scheduling during off-peak windows (22:30-05:30).
- **Prosumer Solar P2P Energy Trading**: Blockchain-backed local energy marketplace allowing neighbors to trade surplus solar credits.

Developed for the **LECO Smart Electricity Metering Project**. Designed and engineered with modern web and machine learning standards.
