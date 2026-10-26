# LECO Smart Electricity Meter Architecture

## 1. System Overview

The LECO Smart Electricity Meter system is an enterprise-grade utility management platform providing real-time telemetry, automated PUCSL tariff calculation, explainable consumption forecasting, and remote grid management.

```
+-----------------------------------------------------------------------+
|                           CLIENT TIER                                 |
|   +---------------------------------+  +----------------------------+ |
|   |  Customer Self-Care Portal     |  |  Staff Grid Control Center | |
|   |  (React 18, Vite, Tailwind CSS)|  |  (React 18, Vite, Lucide)  | |
|   +---------------------------------+  +----------------------------+ |
+-----------------------------------|-----------------------------------+
                                    | HTTPS / WSS
+-----------------------------------|-----------------------------------+
|                           API SERVER                                  |
|   +---------------------------------------------------------------+   |
|   |  Express.js REST Engine & Socket.io Gateway                   |   |
|   |  - HTTP-Only Cookie Authentication (JWT)                      |   |
|   |  - Helmet CSP & Origin Validation Middleware                  |   |
|   |  - Rate Limiters & Input Sanitizers                           |   |
|   +---------------------------------------------------------------+   |
|        |                  |                   |              |        |
|        v                  v                   v              v        |
|   +-----------+    +---------------+    +-----------+  +------------+ |
|   | Tariff    |    | Prediction    |    | Chatbot   |  | SMS Gateway| |
|   | Engine    |    | Engine        |    | Module    |  | Module     | |
|   +-----------+    +---------------+    +-----------+  +------------+ |
+-----------------------------------|-----------------------------------+
                                    | Connection Pool (pg)
+-----------------------------------|-----------------------------------+
|                           DATA TIER                                   |
|   +---------------------------------------------------------------+   |
|   |  PostgreSQL Database (Neon Cloud / Local)                     |   |
|   |  - Row-Level Locking (SELECT FOR UPDATE) for Transactions     |   |
|   |  - Performance Indexes for High-Frequency Telemetry Reads     |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

---

## 2. PUCSL Domestic Tariff Computation Engine (D-1)

Sri Lanka Public Utilities Commission (PUCSL) mandates a progressive stepped block structure for residential consumers:

### Group 1 (Monthly Consumption <= 60 kWh)
- Tier 1 (00 - 30 kWh): Rs. 8.00 / kWh | Fixed Charge: Rs. 150.00
- Tier 2 (31 - 60 kWh): Rs. 20.00 / kWh | Fixed Charge: Rs. 300.00

### Group 2 (Monthly Consumption > 60 kWh)
Once aggregate consumption exceeds 60 kWh in a billing cycle, the user transitions to Group 2 with higher marginal rates applied retroactively across all tiers:
- Tier 1 (00 - 60 kWh): Rs. 25.00 / kWh
- Tier 2 (61 - 90 kWh): Rs. 35.00 / kWh | Fixed Charge: Rs. 400.00
- Tier 3 (91 - 120 kWh): Rs. 50.00 / kWh | Fixed Charge: Rs. 1,000.00
- Tier 4 (121 - 180 kWh): Rs. 50.00 / kWh | Fixed Charge: Rs. 1,500.00
- Tier > 180 kWh: Rs. 75.00 / kWh | Fixed Charge: Rs. 2,000.00

---

## 3. Explainable Consumption Forecasting Algorithm

Rather than relying on opaque black-box models, the LECO system uses a deterministic weighted historical formula that balances short-term patterns with day-of-week seasonality:

```
recentAverage = 0.50 * last7DayAverage + 0.30 * last14DayAverage + 0.20 * last30DayAverage
predictedDailyKWh = 0.60 * recentAverage + 0.40 * sameWeekdayAverage
```

### Wallet Lifetime Simulation
1. The simulation computes daily liabilities step-by-step from day `t=1` forward.
2. For each simulated day, consumption is added to the cycle accumulator to determine whether tariff group boundaries are crossed.
3. Fixed charges and energy charges are debited daily.
4. When prepaid balance hits Rs. 0:
   - If Lifeline Mode is active, overdraft extends up to Rs. 500 limit.
   - If Lifeline Mode is inactive, depletion day marks estimated disconnection date.

---

## 4. Lifeline Mode (Emergency Credit Overdraft)

To protect families against sudden disconnections during night hours or weekends when recharges cannot be immediately completed:
- Consumers with balance <= Rs. 100 can activate an overdraft buffer of Rs. 500.
- When activated, the meter relay remains connected even when balance is negative.
- Upon subsequent recharge, the accumulated overdraft is recovered before net positive balance is credited.
