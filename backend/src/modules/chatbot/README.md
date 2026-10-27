# LECO Advanced Smart Energy Assistant Module (RAG Architecture)

## Overview
This module encapsulates all conversational AI capabilities for the Lanka Electricity Company (LECO) Smart Prepaid Electricity Meter Self Care platform. It is fully decoupled in its own modular folder with a complete Retrieval-Augmented Generation (RAG) architecture, live telemetry integration, prompt security guards, and tri-lingual capabilities (English, Sinhala, Tamil).

## Directory Architecture
```
backend/src/modules/chatbot/
├── knowledge/
│   ├── lecoKnowledgeDocs.js     # Authoritative LECO Domain Knowledge Base (PUCSL tariffs, TOU peak schedules, Lifeline, Payments, Smart Meters, 1987 Hotline)
│   └── ragRetriever.js          # RAG Semantic/Keyword Vector Retriever with TF-IDF cosine similarity scoring
├── security/
│   └── promptGuard.js           # Prompt injection defense, jailbreak mitigation, prompt positioning isolation, character sanitization, emoji elimination
├── services/
│   ├── contextBuilder.js        # Live User Data Aggregator (meter telemetry, daily/monthly kWh, ML predictions, 7d comparison, payments, complaints, TOU status)
│   ├── groqClient.js            # Groq API Client with auto-model fallback (qwen/qwen3.8-27b, etc.), timeout abort, 429 rate limit detection
│   ├── offlineEngine.js         # Tri-lingual offline rule & RAG engine (100% works without Groq API or when rate-limited)
│   └── actionDetector.js        # Navigation action buttons detector (payments, history, complaints, settings, overview)
├── chatbotService.js            # Main orchestrator uniting Context + RAG + PromptGuard + Groq + Fallback + Actions
├── chatbotController.js         # HTTP handler validating input, language detection, streaming/JSON response
├── chatbotRoutes.js             # REST API routes (POST /, GET /status)
├── index.js                     # Public module exports
└── README.md                    # Module documentation
```

## Core Features & Architecture

### 1. Dual-Engine Redundancy (Groq API + Offline Fallback)
- **Primary Engine**: High-speed LLM inference powered by **Groq API** (`GROQ_KEY` / `GROQ_API_KEY`) using `qwen/qwen3.8-27b` or fallback models (`openai/gpt-oss-120b`, `allam-2-7b`).
- **Graceful Fallback**: If Groq API is unconfigured, times out (>8s), or hits rate limits (`HTTP 429`), the assistant seamlessly shifts to the **Tri-Lingual Offline Knowledge Engine**. Users experience zero downtime and always receive accurate answers with their real-time meter telemetry.

### 2. Retrieval-Augmented Generation (RAG)
- In-memory vector and keyword retriever indexes authoritative LECO domain documentation:
  - PUCSL Domestic Block Tariff Schedule (Blocks 1-6 rates & fixed charges).
  - Time-of-Use (TOU) Peak Hours (18:30–22:30), Day (05:30–18:30), and Off-Peak (22:30–05:30).
  - Lifeline Mode & Emergency Credit Buffer (Rs. 500 buffer, night disconnection immunity).
  - Recharge methods (instant PayHere online topup, bank apps, branch counters).
  - Smart meter AMI telemetry (kW load, cumulative kWh, solar net metering).
  - Complaints portal & 24/7 Emergency Breakdown Hotline (1987).

### 3. Prompt Positioning & Injection Security Guard
- **Pattern Detection**: Blocks jailbreak phrases, instruction overrides ("ignore previous instructions", "you are now DAN"), system prompt extraction, delimiter spoofing, and SQL/XSS tokens.
- **Prompt Sandboxing**: Untrusted user text is bounded inside `<untrusted_user_query>` XML tags with strict system constraints.
- **Zero-Emoji Enforcement**: Automatically eliminates all emoji characters from queries and responses to comply with enterprise UI standards.

### 4. Full Real-Time User Data & Prediction Integration
- The assistant automatically queries PostgreSQL before generating responses to inject:
  - Live meter balance, connection status, and lifeline credit status.
  - Today's net consumption and current month's cumulative kWh.
  - Weekly consumption pattern comparison (last 7 days vs previous 7 days with % change).
  - ML wallet lifetime prediction (`estimatedDaysRemaining`, `averageDailyUsageKwh`, `currentTariffGroup`).
  - Last 3 recharge transactions and active complaint tickets.
  - Current Time-of-Use phase in Sri Lanka Standard Time (UTC+5:30).

### 5. Tri-Lingual Support
- Fully operates in **English (en)**, **Sinhala (si - සිංහල)**, and **Tamil (ta - தமிழ்)**.
- Automatically synchronizes with the customer's dashboard language selection and detects input script.

### 6. Interactive Dashboard Navigation & Menu Mentions
- Responses return structured action buttons:
  - `payments`: Navigates to balance recharge page.
  - `history`: Navigates to payment transaction history.
  - `complaints`: Navigates to dispute & outage filing.
  - `settings`: Navigates to customer account settings.
  - `overview`: Navigates to main telemetry dashboard.

### 7. Chat Special Values Highlighting
- Frontend automatically parses and highlights:
  - **Currency**: `Rs. 1,450.00` in glowing emerald badge with currency icon.
  - **Energy**: `14.5 kWh`, `2.4 kW`, `230V` in glowing cyan badge with lightning icon.
  - **Time & TOU**: `18:30 - 22:30`, `Peak Hours` in purple badge with clock icon.
  - **Slabs & Days**: `Block 2`, `Group B`, `~18 days` in amber badge with calendar icon.
  - **Status Badges**: `[LIFELINE MODE ACTIVE]`, `[CONNECTED]` with pulsating indicator dots.

## REST API Endpoints

### 1. Diagnostics & Health Status
- **Method**: `GET /api/chat/status`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response**:
```json
{
  "module": "LECO Smart Energy Assistant",
  "status": "online",
  "architecture": "RAG Knowledge Retriever + Telemetry Snapshot + Groq LLM + Offline Tri-Lingual Engine",
  "engine": "Groq High-Speed LLM (RAG Augmented)",
  "groqAvailable": true,
  "supportedLanguages": ["en", "si", "ta"],
  "securityGuards": ["Prompt Injection Defense", "Prompt Positioning Sandbox", "Zero-Emoji Enforcement"],
  "timestamp": "2026-10-27T23:00:00.000Z"
}
```

### 2. Send Message
- **Method**: `POST /api/chat`
- **Request Body**:
```json
{
  "message": "How many days left on my balance?",
  "language": "en",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "bot", "content": "Hello! I am your LECO Smart Energy Assistant." }
  ]
}
```
- **Response**:
```json
{
  "reply": "Based on your available balance of Rs. 1,250.50 and average burn rate of 4.2 kWh/day under PUCSL Block 2 (31-60 kWh), you have approximately 18 days of power remaining (range: 15-21 days).",
  "actions": [
    { "label": "Recharge Balance", "route": "payments", "variant": "primary" },
    { "label": "View History", "route": "history", "variant": "outline" }
  ],
  "language": "en",
  "source": "groq:qwen/qwen3.8-27b",
  "timestamp": "2026-10-27T23:00:01.000Z"
}
```
