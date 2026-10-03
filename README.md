# LECO Smart Electricity Meter Portal ⚡

> **An advanced, end-to-end Smart Prepaid Electricity Metering & Bidirectional Grid Analytics Platform** developed for modern utility providers (LECO - Lanka Electricity Company) and prosumers.

---

## 📑 Table of Contents
1. [Executive Summary & Concept](#-executive-summary--concept)
2. [Key Innovations & Domain Model](#-key-innovations--domain-model)
3. [System Architecture](#-system-architecture)
4. [Technology Stack](#-technology-stack)
5. [Database Schema & Data Dictionary](#-database-schema--data-dictionary)
6. [Core Functional Modules](#-core-functional-modules)
7. [REST API Specification](#-rest-api-specification)
8. [Calculation Logic & Algorithms](#-calculation-logic--algorithms)
9. [Security, Concurrency & Data Integrity](#-security-concurrency--data-integrity)
10. [Local Development & Environment Setup](#-local-development--environment-setup)
11. [Future Roadmap](#-future-roadmap)

---

## 🌟 Executive Summary & Concept

Traditional electricity metering systems depend on manual meter reading, post-paid billing cycles, delayed fault detection, and one-directional power tracking. With the rapid rise of domestic rooftop solar generation (photovoltaic net-metering), modern consumers have evolved into **prosumers**—entities that both consume power from the grid and inject surplus energy back into it.

The **LECO Smart Electricity Meter Portal** is a cloud-integrated smart utility solution engineered to provide:
1. **Real-Time Bidirectional Power Monitoring**: Continuous tracking of Imported energy (**In**) from the national grid and Exported solar energy (**Out**) to the grid, displaying net billing values ($Net = In - Out$).
2. **Prepaid Smart Metering**: Instant prepaid credit recharging, proactive balance depletion warnings, and algorithmic run-out projections.
3. **Transparent Financial Ledger**: Immediate transaction recording, downloadable/printable digital receipts, and historic balance audit trails.
4. **Customer Empowerment & Dispute Reduction**: Self-service meter linking, dispute/complaint tracking, and real-time operational alerts.
5. **Staff & Utility Fleet Oversight**: Administrative dashboard for fleet health checks, load auditing, and customer dispute resolution.

---

## ⚡ Key Innovations & Domain Model

### 1. Bidirectional Energy Accounting (In / Out / Net)
Electricity meters in this system measure two distinct directional vectors:
* **`In` (Imported from Grid)**: Electricity drawn from the utility grid to power domestic appliances.
* **`Out` (Exported to Grid)**: Clean electricity produced by rooftop solar or microgeneration systems fed back into the utility grid.
* **`Net` ($In - Out$)**: The actual billed or credited energy. If $In > Out$, the consumer pays for net energy consumed; if $Out > In$, the prosumer generates net grid credit.

```
                    ┌───────────────────────────┐
                    │      Utility Grid         │
                    └─────────────┬─────────────┘
                                  │ ▲
            Power Imported (In)   │ │  Power Exported (Out)
                                  ▼ │
                    ┌─────────────┴─────────────┐
                    │   LECO Smart Meter (IoT)  │
                    │   Measures In & Out (kWh) │
                    └─────────────┬─────────────┘
                                  │ ▲
            Power Delivered       │ │  Solar Microgeneration
                                  ▼ │
               ┌──────────────────┴──┐      ┌─────────────────┐
               │ Domestic Appliances │      │ Solar PV Panels │
               └─────────────────────┘      └─────────────────┘
```

### 2. Dual-Line Analytical Visualizations
Rather than flattening consumption into a single ambiguous number, the dashboard presents a dual-channel visualization:
- **Red Line (In)**: Real-time and historic grid consumption.
- **Green Line (Out)**: Solar generation exported back to the grid.
- **Net Stat Cards**: Summary metric highlighting net energy consumption and daily financial average.

---

## 🏗 System Architecture

The project is structured as a decoupled, multi-tier system composed of two frontend applications, a Node.js REST API service, and a managed PostgreSQL database.

```mermaid
graph TD
    subgraph Client Applications
        CP[Customer Portal<br/>React + Vite :5173]
        SP[Staff Portal<br/>React + Vite :5174]
    end

    subgraph Backend Microservice
        API[Node.js + Express API :3000]
        AUTH[Auth Middleware & JWT]
        MTR[Meter & Consumption Controller]
        PAY[Recharge & Payment Engine]
        NOTIF[Notification Service]
    end

    subgraph Data Tier
        DB[(PostgreSQL Neon Cloud)]
    end

    CP -->|REST API / Bearer JWT| API
    SP -->|REST API / Bearer JWT| API
    API --> AUTH
    AUTH --> MTR
    AUTH --> PAY
    AUTH --> NOTIF
    MTR -->|pg Pool Query| DB
    PAY -->|Atomic Balance Update| DB
    NOTIF -->|Insert & Read| DB
```

---

## 🛠 Technology Stack

### Frontend Ecosystem (`frontend/customer` & `frontend/staff`)
- **Framework**: [React 19](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/) for type safety.
- **Build Tooling**: [Vite](https://vitejs.dev/) with Hot Module Replacement (HMR).
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with custom gradient design tokens and glassmorphism.
- **UI Architecture**: [Radix UI](https://www.radix-ui.com/) primitives + [shadcn/ui](https://ui.shadcn.com/) component library.
- **Icons**: [Lucide React](https://lucide.dev/).
- **Data Visualization**: [Recharts](https://recharts.org/) for responsive dual-channel area and line graphs.
- **Client Routing**: [React Router v7](https://reactrouter.com/).

### Backend Service (`backend`)
- **Runtime**: [Node.js](https://nodejs.org/) (ES6+ CommonJS).
- **Web Framework**: [Express.js](https://expressjs.com/).
- **Database Driver**: [`pg` (node-postgres)](https://node-postgres.com/) connection pooling.
- **Security & Cryptography**:
  - `bcryptjs` for salted password hashing.
  - `jsonwebtoken` (JWT) for stateless bearer authentication.
  - `google-auth-library` for Google OAuth 2.0 social login verification.
- **Development Watcher**: Native Node `--watch` flag.

### Database (`Neon Serverless PostgreSQL`)
- Cloud-native PostgreSQL with connection pooling, automated table creation, and SSL encryption (`sslmode=require`).

---

## 🗄 Database Schema & Data Dictionary

The database initializes 5 core relational entities upon server launch (`backend/src/config/db.js`):

```mermaid
erDiagram
    USERS ||--o{ METERS : owns
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ PAYMENTS : executes
    METERS ||--o{ CONSUMPTION_LOGS : records
    METERS ||--o{ PAYMENTS : credited_to
    METERS ||--o{ NOTIFICATIONS : triggers

    USERS {
        int id PK
        string email
        string password
        string role
        timestamp created_at
    }

    METERS {
        int id PK
        int user_id FK
        string meter_number
        string account_number
        string pin
        decimal balance
        string status
        decimal daily_average
        string name
        timestamp created_at
    }

    CONSUMPTION_LOGS {
        int id PK
        int meter_id FK
        date reading_date
        int reading_hour
        decimal consumption
        decimal energy_export
        timestamp created_at
    }

    PAYMENTS {
        int id PK
        int user_id FK
        int meter_id FK
        decimal amount
        string payment_method
        string transaction_id
        decimal previous_balance
        decimal new_balance
        string status
        timestamp created_at
    }

    NOTIFICATIONS {
        int id PK
        int user_id FK
        int meter_id FK
        string type
        string title
        text message
        boolean is_read
        timestamp created_at
    }
```

### Table Definitions

#### 1. `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | Primary Key | Unique user identifier |
| `email` | `VARCHAR(255)` | Unique, Not Null | Account email address |
| `password` | `VARCHAR(255)` | Not Null | Bcrypt salted hash |
| `role` | `VARCHAR(50)` | Default `'customer'` | Role: `'customer'` or `'staff'` |
| `created_at` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` | Account registration date |

#### 2. `meters`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | Primary Key | Unique meter record identifier |
| `user_id` | `INTEGER` | Foreign Key (`users.id`) | Owner user reference |
| `meter_number` | `VARCHAR(100)` | Unique, Not Null | Hardware/serial ID stamped on meter |
| `account_number` | `VARCHAR(100)` | Not Null | Utility utility billing account number |
| `pin` | `VARCHAR(255)` | Not Null | Bcrypt salted hash (one-way cryptographic hash for hardware security) |
| `balance` | `DECIMAL(10,2)` | Default `0.00` | Current available prepaid balance (Rs.) |
| `status` | `VARCHAR(50)` | Default `'Connected'` | `'Connected'`, `'Disconnected'`, `'Suspended'` |
| `daily_average` | `DECIMAL(10,2)` | Default `0.00` | Computed daily burn rate in Rs. |
| `name` | `VARCHAR(100)` | Default `'Home'` | User-friendly meter alias (e.g. Home, Factory) |
| `created_at` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` | Date meter was linked |

#### 3. `consumption_logs`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | Primary Key | Telemetry record ID |
| `meter_id` | `INTEGER` | Foreign Key (`meters.id`) | Source meter reference |
| `reading_date` | `DATE` | Not Null | Date of energy recording (YYYY-MM-DD) |
| `reading_hour` | `INTEGER` | Not Null | Hour of day (0 to 23) |
| `consumption` | `DECIMAL(10,2)` | Not Null | Energy imported (**In**) from grid in kWh |
| `energy_export`| `DECIMAL(10,2)` | Default `0.00` | Energy exported (**Out**) to grid in kWh |
| `created_at` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` | Record insertion timestamp |

#### 4. `payments`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | Primary Key | Transaction primary key |
| `user_id` | `INTEGER` | Foreign Key (`users.id`) | User who paid |
| `meter_id` | `INTEGER` | Foreign Key (`meters.id`) | Meter that received credit |
| `amount` | `DECIMAL(10,2)` | Not Null | Amount topped up in Rs. |
| `payment_method`| `VARCHAR(50)` | Default `'card'` | `'card'`, `'wallet'`, `'bank'` |
| `transaction_id`| `VARCHAR(100)` | Unique, Not Null | Unique reference code (`TXN-...`) |
| `previous_balance`| `DECIMAL(10,2)`| Not Null | Meter balance prior to transaction |
| `new_balance` | `DECIMAL(10,2)` | Not Null | Meter balance after credit applied |
| `status` | `VARCHAR(50)` | Default `'Success'` | Transaction settlement status |
| `created_at` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` | Payment timestamp |

#### 5. `notifications`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `SERIAL` | Primary Key | Notification ID |
| `user_id` | `INTEGER` | Foreign Key (`users.id`) | Recipient user |
| `meter_id` | `INTEGER` | Foreign Key (`meters.id`) | Associated meter (optional) |
| `type` | `VARCHAR(50)` | Not Null | `'alert'`, `'success'`, `'info'` |
| `title` | `VARCHAR(255)` | Not Null | Short notification header |
| `message` | `TEXT` | Not Null | Detailed notification body |
| `is_read` | `BOOLEAN` | Default `FALSE` | Read status |
| `created_at` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` | Creation timestamp |

---

## 💻 Core Functional Modules

### 1. Dashboard Overview (`OverviewSection.tsx`)
- **Balance Card**: Live prepaid balance, daily cost average, and days-remaining estimation.
- **Direct Recharge Triggers**: Both header "Quick Recharge Now" and card "Recharge Now" buttons link directly to the payment page.
- **Real-Time Net KPI Tiles**:
  - `Today — Net (In − Out)`
  - `This Week — Net (In − Out)`
  - `Live Power — Net (In − Out)`
- **7-Day Dual-Line Usage Graph**: Visualizes hourly aggregated grid imports vs. solar exports with kWh tooltips.
- **Recent Activity Feed**: Real-time event notifications with direct shortcut to full payment history.
- **Empty State**: Friendly onboard guidance when no meters are yet registered.

### 2. Smart Meter Registration (`AddMeterSection.tsx`)
- Allows users to register new or existing physical meters via `meterNumber`, `accountNumber`, and verification `pin`.
- Automatic seeding of initial 30 days of hourly telemetry data upon linking.
- Confirmation card displaying linked meter details with a 1-click **"View in Overview"** navigation button.

### 3. Unified Payment & Recharge Engine (`PaymentsSection.tsx`)
- **Multi-Meter Target Selection**: Displays current meter balance and allows selecting between multiple meters.
- **Flexible Amounts**: Quick preset buttons (Rs. 500, 1000, 2000, 5000) or custom numeric input (minimum Rs. 100).
- **Payment Methods**: Credit/Debit Cards, Mobile Wallets/QR, and Online Bank Transfers.
- **Atomic Settlement**: Calls `POST /api/meters/:meterId/recharge`, atomically increments balance, records payment, and emits a notification.
- **Digital Receipt Screen**: Shows unique `TXN-` reference, before/after balances, with direct navigation to **Payment History** or **Overview**.

### 4. Comprehensive Payment History (`PaymentHistorySection.tsx`)
- **Summary Metrics**: All-time total recharged (Rs.), total successful top-ups, and latest transaction details.
- **Live Search & Filter**: Instant filtering by Transaction ID, Meter Number, or payment method (Card / Wallet / Bank).
- **Transaction Table**: Formatted date/time, copyable Transaction ID, meter alias, balance impact ($Prev \to New$), and status badge.
- **Interactive Receipt Modal**: Clean dialog allowing prosumers to review line items and trigger browser printing.

---

## 📡 REST API Specification

All protected endpoints require an `Authorization: Bearer <JWT>` header.

### Authentication Endpoints (`/api/auth`)
| Method | Endpoint | Description | Request Body |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user | `{ email, password, role? }` |
| `POST` | `/api/auth/login` | Email/password login | `{ email, password }` |
| `POST` | `/api/auth/google` | Google OAuth token exchange | `{ credential }` |

### Meter & Telemetry Endpoints (`/api/meters`)
| Method | Endpoint | Description | Response / Payload |
|---|---|---|---|
| `GET` | `/api/meters` | Get user's linked meters | `Array<Meter>` |
| `POST` | `/api/meters/add` | Link a smart meter | `{ meterNumber, accountNumber, pin }` |
| Method | Endpoint | Description | Response / Payload |
|---|---|---|---|
| `GET` | `/api/meters` | Get user's linked meters | `Array<Meter>` |
| `POST` | `/api/meters/add` | Link a smart meter | `{ meterNumber, accountNumber, pin }` |
| `GET` | `/api/meters/:meterId/consumption` | Fetch consumption stats & prediction | `{ today, chartData, prediction: {...} }` |
| `GET` | `/api/meters/:meterId/prediction` | Fetch standalone wallet prediction | `{ walletBalance, estimatedDaysRemaining, ... }` |
| `POST` | `/api/meters/:meterId/recharge` | Top up prepaid credit | `{ amount: number, paymentMethod: string }` |
| `GET` | `/api/meters/payments/history` | Get user payment transaction ledger | `Array<PaymentRecord>` (supports `?meterId=`) |

### Notification Endpoints (`/api/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | Fetch user alerts and activity events |
| `PUT` | `/api/notifications/:id/read` | Mark individual notification as read |

---

## 🧮 Calculation Logic & Tariff Prediction Engine

### 1. PUCSL-Approved Domestic Block Tariff (Official 2026 Structure)

> **Key Implementation Principle**: The tariff structure is selected from **TOTAL 30-day billing-period consumption first**. Rows are **NOT** treated as one progressive continuous slab table.

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

#### Exact Calculation Formulas:
* **Group A ($0 \le \text{kWh} \le 30$)**:
  $$\text{Bill} = (\text{kWh} \times 5.00) + 80.00$$
* **Group A ($31 \le \text{kWh} \le 60$)**:
  $$\text{Bill} = (30 \times 5.00) + ((\text{kWh} - 30) \times 9.00) + 210.00$$
* **Group B ($61 \le \text{kWh} \le 90$)**:
  $$\text{Bill} = (60 \times 14.00) + ((\text{kWh} - 60) \times 20.00) + 400.00$$
* **Group B ($91 \le \text{kWh} \le 120$)**:
  $$\text{Bill} = (60 \times 14.00) + (30 \times 20.00) + ((\text{kWh} - 90) \times 28.00) + 1,000.00$$
* **Group B ($121 \le \text{kWh} \le 180$)**:
  $$\text{Bill} = (60 \times 14.00) + (30 \times 20.00) + (30 \times 28.00) + ((\text{kWh} - 120) \times 44.00) + 1,500.00$$
* **Group C ($\text{kWh} > 180$)**:
  $$\text{Bill} = (180 \times 32.50) + ((\text{kWh} - 180) \times 100.00) + 2,500.00$$

#### Boundary Transition Repricing:
At **61 kWh** and **181 kWh**, earlier units are retroactively repriced under the new structure and fixed charges shift:
- Crossing $60 \to 61\text{ kWh}$: Bill jumps from LKR 630 to LKR 1,260 (+$630\text{ LKR}$).
- Crossing $180 \to 181\text{ kWh}$: Bill jumps from LKR 6,420 to LKR 8,450 (+$2,030\text{ LKR}$).

---

### 2. LECO Wallet Lifetime Estimation Algorithm

> Simple division ($\text{Days} = \frac{\text{Balance}}{\text{Daily kWh} \times \text{Rate}}$) fails under nonlinear block tariffs because marginal rates jump and cycle rollovers occur.

Our prediction engine (`backend/src/services/predictionEngine.js`) implements the official **LECO 3-step pipeline**:

#### Step 1: Explainable Historical kWh Usage Predictor
$$\text{recentAverage} = (0.50 \times \text{Avg}_{7d}) + (0.30 \times \text{Avg}_{14d}) + (0.20 \times \text{Avg}_{30d})$$
$$\text{predictedDailyKWh} = (0.60 \times \text{recentAverage}) + (0.40 \times \text{sameWeekdayAverage})$$
* **Confidence Rating**:
  - $\ge 30$ historical days $\implies$ **HIGH** confidence
  - $7–29$ historical days $\implies$ **MEDIUM** confidence
  - $< 7$ historical days $\implies$ **LOW** confidence

#### Step 2: Day-by-Day Nonlinear Wallet Simulation
1. Advance simulation date day-by-day ($t = 1, 2, \dots$):
2. If billing cycle exceeds 30 days $\implies$ reset cumulative $\text{cycleKWh} = 0$, $\text{chargedLiability} = 0$.
3. Compute cumulative cycle usage: $\text{projectedKWh} = \text{cycleKWh} + \text{predictedKWh}_t$.
4. Calculate new bill liability: $\text{newLiability} = \text{tariffEngine.calculateDomesticBill}(\text{projectedKWh})$.
5. Deduct only the incremental delta:
   $$\text{incrementalDebit} = \text{newLiability} - \text{chargedLiability}$$
   $$\text{balance} \leftarrow \text{balance} - \text{incrementalDebit}$$
6. Stop when $\text{balance} \le 0$; return accumulated days with fractional final day interpolation.

#### Step 3: Multi-Scenario Uncertainty Range
The simulation is executed under 3 usage scenarios:
* **Low Usage Scenario ($0.85 \times \text{prediction}$)** $\implies$ yields **Maximum Days Remaining**
* **Normal Usage Scenario ($1.00 \times \text{prediction}$)** $\implies$ yields **Main Estimated Days**
* **High Usage Scenario ($1.15 \times \text{prediction}$)** $\implies$ yields **Minimum Days Remaining**

```
Wallet Balance: LKR 3,970.00
Current Cycle Usage: 82.0 kWh (Group B)
Estimated Remaining: ~26 Days (Range: 22 - 30 days)
```

---

## 🔒 Security, Concurrency & Data Integrity

1. **Stateless JWT Authorization**: User sessions authenticate via signed JSON Web Tokens (`HS256`) checked in `authMiddleware.js`.
2. **Access Control & Ownership Verification**: Meter actions (recharge, readings, alerts) verify ownership (`user_id = req.user.id`) to prevent unauthorized cross-tenant operations.
3. **Password Security**: Bcrypt one-way salting with 10 salt rounds before database persistence.
4. **Atomic Balances**: Payment recharges increment meter balances and log ledger entries within strict validation boundaries.
5. **Sanitized Inputs & Parameterized Queries**: All database queries use parameterized placeholders (`$1, $2, ...`) via `pg`, eliminating SQL Injection risks.

---

## 🚀 Local Development & Environment Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- [npm](https://www.npmjs.com/) v9.0.0 or higher
- PostgreSQL instance or a free [Neon](https://neon.tech/) database URL

### 1. Clone Repository
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
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```
Start the backend server in watch mode:
```bash
npm run dev
# Server listening on http://localhost:3000
```

### 3. Customer Frontend Startup
```bash
cd ../frontend/customer
npm install
npm run dev
# Customer Portal live on http://localhost:5173
```

### 4. Staff Portal Startup
```bash
cd ../frontend/staff
npm install
npm run dev -- --port 5174
# Staff Portal live on http://localhost:5174
```

---

## 🔒 Security Architecture

### Phase 1: Financial Transaction Security (Idempotency)
- **Threat**: Double-charges and wallet balance inconsistencies caused by network lag or repeated user clicks.
- **Solution**: 
  - Unique UUID v4 idempotency keys generated on the client upon recharge screen invocation.
  - Client transmits `Idempotency-Key` via HTTP request headers.
  - Backend performs atomic checking via Neon PostgreSQL table constraints (`UNIQUE` index).
  - Uses row-level locking (`SELECT ... FOR UPDATE`) in an atomic transaction.
  - Replays existing payment records with `isIdempotentReplay: true` if an identical request is re-submitted.

### Phase 2: Hardware & Database Secret Protection (Cryptographic PIN Hashing)
- **Threat**: Plain-text hardware PINs leaking in a database breach, enabling unauthorized attackers to hijack meters.
- **Solution**:
  - Meter PINs are treated strictly like passwords.
  - One-way hashing algorithm (`bcryptjs` with 10 salt rounds) applied before writing to database storage.
  - Existing database records automatically migrated to bcrypt hashes during bootstrap.
  - Verification on linking (`/api/meters/add`) executes constant-time `bcrypt.compare(pin, meter.pin)` rather than raw equality.
  - All public meter queries (`getUserMeters`, `addMeter`) explicitly omit the `pin` column from database `SELECT` and `RETURNING` clauses.

---

## 🔮 Future Roadmap

- [ ] **Hardware Protocol Integration**: Direct MQTT / CoAP listener for physical ESP32 / Arduino smart energy monitoring ICs.
- [ ] **Time-of-Use (TOU) Pricing Engine**: Dynamic tariff calculation matching Peak, Off-Peak, and Day energy costs.
- [ ] **Automated Low-Balance SMS/Email Alerts**: Automated webhooks triggered when remaining days drop below 3 days.
- [ ] **Mobile Application**: Native mobile interface using React Native / Flutter with push notifications.
- [ ] **Solar ROI Estimator**: Financial analytics estimating solar panel payback periods from historic grid exports.

---

## 📄 License & Attribution
Developed for LECO Smart Electricity Metering Project. Designed and built with modern open-source web standards.
