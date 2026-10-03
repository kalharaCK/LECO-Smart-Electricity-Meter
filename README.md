# LECO Smart Electricity Meter Portal

A full-stack smart prepaid electricity meter management system featuring real-time grid consumption analytics, two-line bidirectional power tracking (In/Out/Net), instant balance recharge, automated payment history, and staff administration.

---

## ⚡ Architecture & Features

### 👤 Customer Portal (`frontend/customer`)
- **Live Net Power Consumption**: Real-time stats calculating `In − Out` (grid import minus solar/local export).
- **Dual-Line Analytical Chart**: 7-day usage graph with distinct lines for **In (from grid)** and **Out (to grid)** in `kWh`.
- **Prepaid Balance & Projections**: Real-time remaining balance and estimated days of power remaining.
- **Smart Meter Management**: Add and link meters via Meter Number, Account Number, and PIN, with automatic status updates.
- **Instant Recharge / Payments**: Top up via Card, Mobile Wallet / QR, or Online Bank Transfer with live balance updating.
- **Payment History & Receipts**: Full transaction ledger with copyable Transaction IDs, balance impact tracking, and printable receipts.
- **Alerts & Complaints**: Instant notification feed and complaint filing system.

### 🏢 Staff Portal (`frontend/staff`)
- Customer and meter oversight dashboard.
- Consumption audit and complaint management tools.

### ⚙️ Backend API (`backend`)
- **Node.js & Express**: RESTful API service.
- **PostgreSQL (Neon)**: Database for users, smart meters, consumption logs, notifications, and payment transactions.
- **Authentication**: JWT authentication and Google OAuth support.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database (or Neon cloud database)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL DATABASE_URL and JWT_SECRET
npm run dev
```
The backend server runs on `http://localhost:3000`.

### 3. Customer Portal Setup
```bash
cd frontend/customer
npm install
npm run dev
```
The customer frontend runs on `http://localhost:5173`.

### 4. Staff Portal Setup
```bash
cd frontend/staff
npm install
npm run dev -- --port 5174
```
The staff frontend runs on `http://localhost:5174`.

---

## 🛠️ Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Node.js, Express, `pg` (node-postgres)
- **Database**: PostgreSQL (Neon Serverless)
