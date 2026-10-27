# LECO Smart Electricity Meter API Specification

## 1. Authentication & Security Policy

### Session Credentials
- **Mechanism**: Secure HTTP-only cookies (`token`), with optional `Authorization: Bearer <JWT>` header support for native and programmatic clients.
- **CSRF & Origin Protection**: All state-changing methods (`POST`, `PATCH`, `DELETE`) require a valid browser `Origin` matching trusted portal origins.
- **Brute-Force Safeguard**: In-memory rate limiters enforce sliding windows across login, registration OTP requests, and meter linking attempts.

---

## 2. Customer Endpoints

### Authentication
- `POST /api/auth/register/send-otp` - Dispatch 6-digit registration OTP to Sri Lankan mobile number.
- `POST /api/auth/register/verify-otp` - Verify SMS OTP and complete customer profile creation.
- `POST /api/auth/login` - Authenticate customer credentials and issue secure session cookie.
- `GET /api/auth/me` - Retrieve authenticated user profile.
- `POST /api/auth/logout` - Clear session cookie.

### Meters & Telemetry
- `GET /api/meters` - List all smart meters owned by authenticated customer.
- `POST /api/meters/add` - Link new smart meter (validates meter number, account number, and 4-digit PIN).
- `GET /api/meters/:meterId/consumption` - Retrieve historical hourly and daily kWh consumption.
- `GET /api/prediction/meter/:meterId` - Calculate explainable weighted daily usage and wallet lifetime forecast.
- `POST /api/meters/:meterId/emergency-credit` - Activate Lifeline Mode (Rs. 500 emergency buffer).

### Energy Assistant Chatbot
- `GET /api/chat/status` - Check assistant engine readiness (OpenAI Tool Calling or Local Heuristics).
- `POST /api/chat` - Query assistant regarding balance, days left, weekly usage comparisons, and tariffs.

### Complaints & Settings
- `GET /api/complaints` - List user complaints.
- `POST /api/complaints` - Submit technical or billing inquiry.
- `GET /api/settings` - Retrieve alert thresholds and notification preferences.
- `PATCH /api/settings` - Update budget and threshold parameters.

---

## 3. Staff Grid Operations Endpoints

- `GET /api/staff/meters` - Paginated grid-wide meter directory with live status and balances.
- `POST /api/meters/:meterId/toggle-relay` - Remotely disconnect or reconnect meter relay.
- `POST /api/meters/:meterId/staff-topup` - Apply manual administrative relief top-up.
- `GET /api/complaints/all` - Administrative ticket queue with resolution status.
- `PATCH /api/complaints/:id/resolve` - Record resolution notes and close ticket.
- `GET /api/payments/payhere-transactions` - Audit log of PayHere gateway transactions.
- `POST /api/staff/sms/send` - Send manual customer notifications via SMS gateway.

---

## 4. Payment Gateway Webhook (PayHere)

- `POST /api/payments/payhere-notify`
  - Direct server-to-server callback from PayHere payment gateway.
  - Verifies MD5 checksum signature against merchant secret.
  - Executes database transaction with row-level lock (`SELECT ... FOR UPDATE`).
  - Updates meter balance and emits real-time WebSocket update to customer room.

---

## 5. WebSocket Telemetry Events

- **Rooms**:
  - `meter_<id>`: Scoped strictly to the authenticated owner of the meter.
  - `user_<id>`: Targeted customer alerts and SMS mirroring.
  - `all_meters`: Dedicated staff grid overview room.
  - `staff_room`: Real-time complaint ticketing stream.
- **Events**:
  - `meter_update`: Emitted when balance, kWh consumption, or relay status updates.
  - `notification`: Emitted when alerts, recharges, or lifeline events occur.
  - `complaint_update`: Emitted when ticket status changes.
