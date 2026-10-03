const OpenAI = require('openai');
const { pool } = require('../config/db');
const { getWalletLifetimePrediction } = require('./predictionEngine');
const { calculateDomesticBill } = require('./tariffEngine');

// Initialize OpenAI client if key is present
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// System prompt defines bot personality, knowledge boundary, and strict accuracy rules
const SYSTEM_PROMPT = `You are the LECO Smart Energy Assistant for the Lanka Electricity Company (LECO) Smart Prepaid Electricity Meter platform.
Your job is to help the consumer understand their electricity usage, prepaid balance, PUCSL domestic block tariff calculation, and Lifeline Mode (Emergency Credit).
Rules:
1. Be polite, concise, encouraging, and helpful.
2. If the user asks about their data (balance, top-up, usage, predictions, lifeline status), always use the provided tools to fetch it.
3. NEVER invent or guess numbers, transactions, or dates.
4. Currency is always in Sri Lankan Rupees (Rs. or LKR). Energy is in kilowatt-hours (kWh).
5. Explain concepts simply (e.g. PUCSL block tariffs, net metering with solar exports, Lifeline Mode overdraft).
6. If the user asks a question completely unrelated to electricity, LECO, utility billing, or power consumption, politely decline to answer.`;

/**
 * Tool 1: Get the user's most recent successful top-up / recharge transaction
 */
async function getLastTopup(userId) {
  try {
    const res = await pool.query(
      `SELECT p.amount, p.payment_method, p.transaction_id, p.previous_balance, p.new_balance, 
              p.status, p.created_at, m.meter_number
       FROM payments p
       JOIN meters m ON p.meter_id = m.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return { found: false, message: "No recharge transactions found for this account yet." };
    }

    const row = res.rows[0];
    return {
      found: true,
      amount: parseFloat(row.amount),
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      previousBalance: parseFloat(row.previous_balance),
      newBalance: parseFloat(row.new_balance),
      meterNumber: row.meter_number,
      date: new Date(row.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    };
  } catch (err) {
    console.error("Error in getLastTopup:", err);
    return { error: "Failed to query payments ledger" };
  }
}

/**
 * Tool 2: Compare weekly electricity usage (last 7 days vs previous 7 days)
 */
async function compareWeeklyUsage(meterId, userId) {
  try {
    // Verify meter belongs to user
    const meterQuery = await pool.query(
      `SELECT id, meter_number FROM meters WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );
    if (meterQuery.rows.length === 0) {
      return { error: "Meter not found or access denied." };
    }

    const thisWeekRes = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [meterId]
    );

    const lastWeekRes = await pool.query(
      `SELECT SUM(consumption) as total_import, SUM(energy_export) as total_export 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '14 days' AND reading_date < CURRENT_DATE - INTERVAL '7 days'`,
      [meterId]
    );

    const thisWeekImport = parseFloat(thisWeekRes.rows[0]?.total_import || 0);
    const thisWeekExport = parseFloat(thisWeekRes.rows[0]?.total_export || 0);
    const thisWeekNet = Math.max(0, thisWeekImport - thisWeekExport);

    const lastWeekImport = parseFloat(lastWeekRes.rows[0]?.total_import || 0);
    const lastWeekExport = parseFloat(lastWeekRes.rows[0]?.total_export || 0);
    const lastWeekNet = Math.max(0, lastWeekImport - lastWeekExport);

    const diffKwh = Math.round((thisWeekNet - lastWeekNet) * 10) / 10;
    let percentageChange = 0;
    if (lastWeekNet > 0) {
      percentageChange = Math.round(((thisWeekNet - lastWeekNet) / lastWeekNet) * 100);
    }

    return {
      meterNumber: meterQuery.rows[0].meter_number,
      thisWeekNetKwh: Math.round(thisWeekNet * 10) / 10,
      lastWeekNetKwh: Math.round(lastWeekNet * 10) / 10,
      thisWeekImport: Math.round(thisWeekImport * 10) / 10,
      thisWeekExport: Math.round(thisWeekExport * 10) / 10,
      differenceKwh: Math.abs(diffKwh),
      trend: diffKwh > 0 ? "increased" : diffKwh < 0 ? "decreased" : "same",
      percentageChange: Math.abs(percentageChange)
    };
  } catch (err) {
    console.error("Error in compareWeeklyUsage:", err);
    return { error: "Failed to compare weekly usage" };
  }
}

/**
 * Tool 3: Get predicted days remaining based on wallet balance and PUCSL block burn rate
 */
async function getPredictedDays(meterId, userId) {
  try {
    const meterQuery = await pool.query(
      `SELECT id, meter_number, balance, status, emergency_credit_limit, emergency_credit_active 
       FROM meters WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );
    if (meterQuery.rows.length === 0) {
      return { error: "Meter not found or access denied." };
    }

    const meter = meterQuery.rows[0];
    const balance = parseFloat(meter.balance);
    const emergencyCreditLimit = parseFloat(meter.emergency_credit_limit || 500);
    const emergencyCreditActive = Boolean(meter.emergency_credit_active);

    const historyResult = await pool.query(
      `SELECT 
         reading_date::text as date,
         GREATEST(0, SUM(consumption) - SUM(energy_export)) as consumption,
         EXTRACT(DOW FROM reading_date)::int as day_of_week
       FROM consumption_logs
       WHERE meter_id = $1
       GROUP BY reading_date
       ORDER BY reading_date DESC
       LIMIT 60`,
      [meterId]
    );

    const cycleResult = await pool.query(
      `SELECT GREATEST(0, COALESCE(SUM(consumption) - SUM(energy_export), 0)) as cycle_net 
       FROM consumption_logs 
       WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
      [meterId]
    );

    const prediction = getWalletLifetimePrediction({
      walletBalance: balance,
      currentCycleKWh: parseFloat(cycleResult.rows[0]?.cycle_net || 0),
      currentCycleDay: new Date().getDate(),
      dailyHistory: historyResult.rows.map(r => ({
        date: r.date,
        consumption: parseFloat(r.consumption || 0),
        dayOfWeek: r.day_of_week
      })),
      emergencyCreditLimit,
      emergencyCreditActive
    });

    return {
      meterNumber: meter.meter_number,
      currentBalance: balance,
      connectionStatus: meter.status,
      estimatedDaysRemaining: prediction.estimatedDaysRemaining,
      estimatedMinDays: prediction.estimatedMinDays,
      estimatedMaxDays: prediction.estimatedMaxDays,
      averageDailyUsageKwh: prediction.averageDailyUsageKwh,
      currentTariffGroup: prediction.currentTariffGroup,
      isLifelineActive: prediction.isLifelineActive,
      lifelineRemaining: prediction.lifelineRemaining,
      lifelineUsed: prediction.lifelineUsed
    };
  } catch (err) {
    console.error("Error in getPredictedDays:", err);
    return { error: "Failed to calculate prediction" };
  }
}

/**
 * Tool 4: Current meter snapshot (balance, status, lifeline availability)
 */
async function getCurrentMeterStatus(meterId, userId) {
  try {
    const res = await pool.query(
      `SELECT id, meter_number, account_number, balance, status, name, 
              emergency_credit_limit, emergency_credit_active 
       FROM meters 
       WHERE id = $1 AND user_id = $2`,
      [meterId, userId]
    );
    if (res.rows.length === 0) return { error: "Meter not found." };
    const row = res.rows[0];
    return {
      meterNumber: row.meter_number,
      accountNumber: row.account_number,
      name: row.name,
      balance: parseFloat(row.balance),
      status: row.status,
      emergencyCreditActive: Boolean(row.emergency_credit_active),
      emergencyCreditLimit: parseFloat(row.emergency_credit_limit || 500)
    };
  } catch (err) {
    console.error("Error in getCurrentMeterStatus:", err);
    return { error: "Failed to fetch meter status" };
  }
}

// Tool definitions for OpenAI Function Calling API
const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "get_last_topup",
      description: "Get the user's most recent recharge or top-up transaction details, including amount, date, and reference ID.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_weekly_usage",
      description: "Compare net electricity usage (in kWh) for the last 7 days against the previous week (days 8-14).",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_predicted_days",
      description: "Get the estimated days of electricity remaining on the prepaid balance using the PUCSL block tariff prediction algorithm.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_meter_status",
      description: "Get current prepaid balance, meter connection status (Connected/Disconnected), and Emergency Credit (Lifeline Mode) status.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  }
];

/**
 * Execute tool based on tool call name
 */
async function executeToolCall(name, args, userId, meterId) {
  switch (name) {
    case "get_last_topup":
      return await getLastTopup(userId);
    case "compare_weekly_usage":
      return await compareWeeklyUsage(meterId, userId);
    case "get_predicted_days":
      return await getPredictedDays(meterId, userId);
    case "get_current_meter_status":
      return await getCurrentMeterStatus(meterId, userId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Intelligent local fallback responder (handles tools, queries DB, formats human answers if OpenAI key is not provided)
 */
async function generateLocalAssistantReply(userMessage, userId, meterId) {
  const lower = userMessage.toLowerCase();

  // 1. Prediction / Days remaining queries
  if (lower.includes('how many days') || lower.includes('days remaining') || lower.includes('how long') || lower.includes('run out') || lower.includes('prediction')) {
    const pred = await getPredictedDays(meterId, userId);
    if (pred.error) return "I could not retrieve your prediction data at the moment. Please verify your meter is active.";

    if (pred.isLifelineActive && pred.currentBalance < 0) {
      return `Your meter is currently in **Lifeline Mode (Emergency Credit)** with a negative balance of **Rs. ${pred.currentBalance.toFixed(2)}**. Your remaining emergency buffer is **Rs. ${pred.lifelineRemaining.toFixed(2)}**, which gives you approximately **${pred.estimatedDaysRemaining} days** of electricity remaining at your average consumption rate (${pred.averageDailyUsageKwh} kWh/day). Power will stay connected until the Rs. 500 buffer is exhausted.`;
    }

    return `Based on your available balance of **Rs. ${pred.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}** and average burn rate of **${pred.averageDailyUsageKwh} kWh/day** under the PUCSL **${pred.currentTariffGroup}**, you have approximately **${pred.estimatedDaysRemaining} days** of power remaining (estimated range: ${pred.estimatedMinDays}–${pred.estimatedMaxDays} days).`;
  }

  // 2. Recharge / Top-up queries
  if (lower.includes('topup') || lower.includes('top-up') || lower.includes('recharge') || lower.includes('last payment') || lower.includes('payment')) {
    const topup = await getLastTopup(userId);
    if (!topup.found) return "You haven't made any recharge payments yet. You can top up your balance anytime using the 'Recharge Now' button on your dashboard.";
    return `Your last recharge was for **Rs. ${topup.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}** via **${topup.paymentMethod.toUpperCase()}** on **${topup.date}** (Ref: \`${topup.transactionId}\`). Your balance updated from Rs. ${topup.previousBalance.toFixed(2)} to **Rs. ${topup.newBalance.toFixed(2)}**.`;
  }

  // 3. Weekly usage comparison queries
  if (lower.includes('compare') || lower.includes('weekly') || lower.includes('last week') || lower.includes('usage') || lower.includes('consumption')) {
    const comp = await compareWeeklyUsage(meterId, userId);
    if (comp.error) return "I could not retrieve your consumption history. Please ensure meter telemetry is connected.";

    if (comp.trend === "increased") {
      return `Over the last 7 days, your net electricity consumption was **${comp.thisWeekNetKwh} kWh** (Import: ${comp.thisWeekImport} kWh, Export: ${comp.thisWeekExport} kWh). This is an **increase of ${comp.percentageChange}% (+${comp.differenceKwh} kWh)** compared to the previous week (${comp.lastWeekNetKwh} kWh).`;
    } else if (comp.trend === "decreased") {
      return `Great news! In the last 7 days, your net usage was **${comp.thisWeekNetKwh} kWh**, which is a **decrease of ${comp.percentageChange}% (-${comp.differenceKwh} kWh)** compared to the previous week (${comp.lastWeekNetKwh} kWh). You are conserving energy!`;
    } else {
      return `Your net electricity consumption over the last 7 days was **${comp.thisWeekNetKwh} kWh**, exactly consistent with the previous week (${comp.lastWeekNetKwh} kWh).`;
    }
  }

  // 4. Balance & Emergency Credit status
  if (lower.includes('balance') || lower.includes('lifeline') || lower.includes('emergency credit') || lower.includes('status')) {
    const status = await getCurrentMeterStatus(meterId, userId);
    if (status.error) return "I could not retrieve your meter status.";
    let msg = `Your current prepaid balance is **Rs. ${status.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}** and meter status is **${status.status}**.`;
    if (status.emergencyCreditActive) {
      msg += `\n\n🚨 **Lifeline Mode is currently Active**. Your power will remain connected up to -Rs. ${status.emergencyCreditLimit.toFixed(2)}. The negative balance will be cleared automatically on your next top-up.`;
    } else if (status.balance <= 100) {
      msg += `\n\n⚠️ Your balance is low (<= Rs. 100). You are eligible to activate **Emergency Credit (Lifeline Mode)** up to Rs. 500 to prevent sudden overnight disconnections!`;
    }
    return msg;
  }

  // 5. Unrelated or general inquiries
  if (lower.includes('weather') || lower.includes('recipe') || lower.includes('joke') || lower.includes('movie')) {
    return "I am the LECO Smart Energy Assistant. I specialize in electricity consumption, prepaid smart meter management, tariffs, and recharge history. How can I help with your power supply?";
  }

  return "Hello! I am your **LECO Smart Energy Assistant**. I can help you with:\n- Estimating how many days your balance will last (`How many days left?`)\n- Reviewing your latest recharge (`What was my last top-up?`)\n- Comparing your weekly electricity usage (`Compare weekly usage`)\n- Checking your balance and Lifeline Emergency Credit status\n\nWhat would you like to know?";
}

/**
 * Main chat handler: Uses OpenAI gpt-4o-mini with native Tool Calling,
 * or seamlessly falls back to the local database-aware query engine.
 */
async function processChatMessage({ message, history = [], userId }) {
  // 1. Resolve user's primary meter
  const meterRes = await pool.query(
    `SELECT id FROM meters WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  const meterId = meterRes.rows[0]?.id;

  if (!meterId) {
    return "You do not have any smart meters connected to your account yet. Please add a meter in the 'Add Meter' section to enable energy assistant insights.";
  }

  // 2. If OpenAI API key is configured, use gpt-4o-mini with Tool Calling
  if (openai) {
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-6).map(h => ({ role: h.role === 'bot' ? 'assistant' : h.role, content: h.content || h.text })),
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        tools: TOOLS_SCHEMA,
        tool_choice: "auto",
        temperature: 0.3
      });

      const choice = response.choices[0];
      const toolCalls = choice.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        messages.push(choice.message);

        for (const toolCall of toolCalls) {
          const fnName = toolCall.function.name;
          const fnArgs = JSON.parse(toolCall.function.arguments || '{}');
          const result = await executeToolCall(fnName, fnArgs, userId, meterId);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.4
        });

        return secondResponse.choices[0].message.content;
      }

      return choice.message.content;
    } catch (apiError) {
      console.warn("OpenAI API call failed, falling back to local energy engine:", apiError.message);
    }
  }

  // 3. Fallback to local database-aware intelligent tool dispatcher
  return await generateLocalAssistantReply(message, userId, meterId);
}

module.exports = {
  processChatMessage,
  getLastTopup,
  compareWeeklyUsage,
  getPredictedDays,
  getCurrentMeterStatus
};
