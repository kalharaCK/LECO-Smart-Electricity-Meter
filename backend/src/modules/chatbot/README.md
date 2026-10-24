# LECO Chatbot Assistant Module (Decoupled Architecture)

## Overview
This module encapsulates all conversational AI capabilities for the LECO Smart Electricity Meter Self Care platform. It is fully isolated from core metering operations and WebSockets, operating strictly as a modular REST micro-service.

## Directory Structure
```
backend/src/modules/chatbot/
├── index.js              # Module exports (router, controller, service)
├── chatbotRoutes.js      # REST API route endpoints (POST /, GET /status)
├── chatbotController.js  # HTTP request sanitization & response handling
├── chatbotService.js     # AI completion engine, tool dispatcher & fallback logic
└── README.md             # Developer documentation
```

## REST API Endpoints

### 1. Chatbot Health & Engine Status
- **Method**: `GET`
- **Route**: `/api/chat/status`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response**:
```json
{
  "module": "LECO Chatbot Assistant",
  "status": "online",
  "engine": "OpenAI GPT-4o-mini (Tools Enabled)" | "Local Smart Rule Engine",
  "timestamp": "2026-10-24T05:07:05.299Z"
}
```

### 2. Process User Message
- **Method**: `POST`
- **Route**: `/api/chat`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>`
- **Request Body**:
```json
{
  "message": "How many days left on my balance?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "bot", "content": "Hello! How can I assist you with your smart meter?" }
  ]
}
```
- **Response**:
```json
{
  "reply": "Based on your available balance of Rs. 6,950.00 and average burn rate of 10.67 kWh/day..."
}
```

## Decoupled Architecture Principles
1. **No WebSocket Mixing**: Does not import or rely on socket connections. Operates over standard, cacheable HTTP REST.
2. **Dual-Engine Redundancy**:
   - If `process.env.OPENAI_API_KEY` is set, uses OpenAI `gpt-4o-mini` with native Tool Calling (function calling).
   - If OpenAI is unavailable or credentials are omitted, falls back dynamically to the local database-aware intelligent rules engine.
3. **Strict Zero-Emoji Policy**: All responses are cleaned to eliminate emoji characters, maintaining the corporate utility standard.
