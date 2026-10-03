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
| `pin` | `VARCHAR(255)` | Not Null | Security activation PIN |
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
| `GET` | `/api/meters/:meterId/consumption` | Fetch 7-day & today consumption | `{ today: { net, import, export }, chartData: [...] }` |
| `POST` | `/api/meters/:meterId/recharge` | Top up prepaid credit | `{ amount: number, paymentMethod: string }` |
| `GET` | `/api/meters/payments/history` | Get user payment transaction ledger | `Array<PaymentRecord>` (supports `?meterId=`) |

### Notification Endpoints (`/api/notifications`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/notifications` | Fetch user alerts and activity events |
| `PUT` | `/api/notifications/:id/read` | Mark individual notification as read |

---

## 🧮 Calculation Logic & Algorithms

### 1. Net Energy Calculation
$$\text{Net Energy (kWh)} = \sum \text{Consumption (Import)} - \sum \text{Energy Export}$$
- If $\text{Net} > 0$: The prosumer consumed more energy than generated.
- If $\text{Net} < 0$: The prosumer exported excess solar power to the grid.

### 2. Days Remaining Estimation
$$\text{Days Remaining} = \left\lfloor \frac{\text{Current Balance (Rs.)}}{\text{Daily Average Burn Rate (Rs.)}} \right\rfloor$$
- If $\text{Daily Average} \le 0$ or balance is depleted, defaults safely to $0$ days.

### 3. Daily Telemetry Aggregation
```sql
SELECT 
  reading_date,
  SUM(consumption) AS total_import,
  SUM(energy_export) AS total_export,
  SUM(consumption - energy_export) AS net_consumption
FROM consumption_logs
WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY reading_date
ORDER BY reading_date ASC;
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

## 🔮 Future Roadmap

- [ ] **Hardware Protocol Integration**: Direct MQTT / CoAP listener for physical ESP32 / Arduino smart energy monitoring ICs.
- [ ] **Time-of-Use (TOU) Pricing Engine**: Dynamic tariff calculation matching Peak, Off-Peak, and Day energy costs.
- [ ] **Automated Low-Balance SMS/Email Alerts**: Automated webhooks triggered when remaining days drop below 3 days.
- [ ] **Mobile Application**: Native mobile interface using React Native / Flutter with push notifications.
- [ ] **Solar ROI Estimator**: Financial analytics estimating solar panel payback periods from historic grid exports.

---

## 📄 License & Attribution
Developed for LECO Smart Electricity Metering Project. Designed and built with modern open-source web standards.
