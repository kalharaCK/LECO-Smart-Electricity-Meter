/**
 * User Context & Predictions Aggregator
 * Gathers complete real-time customer data:
 * - Meter telemetry (balance, connection status, emergency credit buffer)
 * - Consumption patterns (today's usage, current billing cycle kWh)
 * - Weekly trend comparison (last 7 days vs previous 7 days)
 * - ML Predictions (days remaining, daily burn rate, PUCSL tariff tier)
 * - Recent payments & active complaints
 * - Real-time Time-of-Use (TOU) window (Peak, Day, Off-Peak)
 */

const { pool } = require('../../../config/db');
const { getWalletLifetimePrediction } = require('../../prediction');

/**
 * Determine current Time-of-Use phase in Sri Lanka Standard Time (UTC +5:30)
 */
function getCurrentTOUPhase() {
  const now = new Date();
  // Convert to UTC+5:30
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const slTime = new Date(utcMs + 5.5 * 3600000);

  const hours = slTime.getHours();
  const minutes = slTime.getMinutes();
  const timeVal = hours * 60 + minutes;

  // Peak: 18:30 (1110 mins) to 22:30 (1350 mins)
  if (timeVal >= 1110 && timeVal < 1350) {
    return {
      phase: "PEAK",
      name: "Peak Hours",
      window: "18:30 - 22:30",
      ratePerKwh: 54.00,
      advisory: "High rate window active. Please turn off high-draw appliances (irons, water pumps, heaters, AC, EV chargers) until 22:30."
    };
  }
  // Off-Peak: 22:30 (1350 mins) to 05:30 (330 mins)
  if (timeVal >= 1350 || timeVal < 330) {
    return {
      phase: "OFF_PEAK",
      name: "Off-Peak Hours",
      window: "22:30 - 05:30",
      ratePerKwh: 13.00,
      advisory: "Lowest tariff window active. Best time to run water pumps, washing machines, and recharge EVs."
    };
  }
  // Day: 05:30 to 18:30
  return {
    phase: "DAY",
    name: "Day Hours",
    window: "05:30 - 18:30",
    ratePerKwh: 25.00,
    advisory: "Standard daytime tariff window active."
  };
}

/**
 * Build complete user data context snapshot
 *
 * @param {number} userId - The authenticated customer ID
 * @param {number} [specificMeterId] - Optional specific meter ID
 * @returns {Promise<object>} Complete user context object
 */
async function buildUserContext(userId, specificMeterId = null) {
  const context = {
    user: null,
    meters: [],
    primaryMeter: null,
    todayUsage: { importKwh: 0, exportKwh: 0, netKwh: 0 },
    cycleUsage: { netKwh: 0, daysInCycle: new Date().getDate() },
    weeklyTrend: null,
    prediction: null,
    recentPayments: [],
    recentComplaints: [],
    currentTOU: getCurrentTOUPhase(),
    hasMeters: false
  };

  try {
    // 1. Fetch User Details
    const userRes = await pool.query(
      `SELECT id, name, email, phone FROM users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length > 0) {
      context.user = userRes.rows[0];
    }

    // 2. Fetch User Meters
    const metersRes = await pool.query(
      `SELECT id, meter_number, account_number, name, balance, status, 
              emergency_credit_limit, emergency_credit_active, created_at
       FROM meters 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [userId]
    );

    if (metersRes.rows.length === 0) {
      return context;
    }

    context.hasMeters = true;
    context.meters = metersRes.rows.map(m => ({
      id: m.id,
      meterNumber: m.meter_number,
      accountNumber: m.account_number,
      name: m.name,
      balance: parseFloat(m.balance || 0),
      status: m.status,
      emergencyCreditActive: Boolean(m.emergency_credit_active),
      emergencyCreditLimit: parseFloat(m.emergency_credit_limit || 500)
    }));

    // Select primary meter
    const activeMeter = specificMeterId
      ? context.meters.find(m => m.id === specificMeterId) || context.meters[0]
      : context.meters[0];
    context.primaryMeter = activeMeter;

    const meterId = activeMeter.id;

    // 3. Fetch Today's Consumption
    try {
      const todayRes = await pool.query(
        `SELECT COALESCE(SUM(consumption), 0) as import_kwh, 
                COALESCE(SUM(energy_export), 0) as export_kwh
         FROM consumption_logs
         WHERE meter_id = $1 AND reading_date = CURRENT_DATE`,
        [meterId]
      );
      const imp = parseFloat(todayRes.rows[0]?.import_kwh || 0);
      const exp = parseFloat(todayRes.rows[0]?.export_kwh || 0);
      context.todayUsage = {
        importKwh: Math.round(imp * 10) / 10,
        exportKwh: Math.round(exp * 10) / 10,
        netKwh: Math.round(Math.max(0, imp - exp) * 10) / 10
      };
    } catch (e) {
      console.warn('[contextBuilder] Error fetching todayUsage:', e.message);
    }

    // 4. Fetch Current Month Cycle Consumption
    try {
      const cycleRes = await pool.query(
        `SELECT COALESCE(SUM(consumption), 0) as cycle_import, 
                COALESCE(SUM(energy_export), 0) as cycle_export
         FROM consumption_logs
         WHERE meter_id = $1 AND reading_date >= date_trunc('month', CURRENT_DATE)`,
        [meterId]
      );
      const cImp = parseFloat(cycleRes.rows[0]?.cycle_import || 0);
      const cExp = parseFloat(cycleRes.rows[0]?.cycle_export || 0);
      context.cycleUsage = {
        netKwh: Math.round(Math.max(0, cImp - cExp) * 10) / 10,
        daysInCycle: new Date().getDate()
      };
    } catch (e) {
      console.warn('[contextBuilder] Error fetching cycleUsage:', e.message);
    }

    // 5. Fetch Weekly Trend (Last 7 Days vs Previous 7 Days)
    try {
      const thisWeekRes = await pool.query(
        `SELECT COALESCE(SUM(consumption), 0) as total_import, COALESCE(SUM(energy_export), 0) as total_export 
         FROM consumption_logs 
         WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '7 days'`,
        [meterId]
      );
      const lastWeekRes = await pool.query(
        `SELECT COALESCE(SUM(consumption), 0) as total_import, COALESCE(SUM(energy_export), 0) as total_export 
         FROM consumption_logs 
         WHERE meter_id = $1 AND reading_date >= CURRENT_DATE - INTERVAL '14 days' AND reading_date < CURRENT_DATE - INTERVAL '7 days'`,
        [meterId]
      );

      const twImport = parseFloat(thisWeekRes.rows[0]?.total_import || 0);
      const twExport = parseFloat(thisWeekRes.rows[0]?.total_export || 0);
      const twNet = Math.max(0, twImport - twExport);

      const lwImport = parseFloat(lastWeekRes.rows[0]?.total_import || 0);
      const lwExport = parseFloat(lastWeekRes.rows[0]?.total_export || 0);
      const lwNet = Math.max(0, lwImport - lwExport);

      const diffKwh = Math.round((twNet - lwNet) * 10) / 10;
      let percentageChange = 0;
      if (lwNet > 0) {
        percentageChange = Math.round(((twNet - lwNet) / lwNet) * 100);
      }

      context.weeklyTrend = {
        thisWeekNetKwh: Math.round(twNet * 10) / 10,
        lastWeekNetKwh: Math.round(lwNet * 10) / 10,
        differenceKwh: Math.abs(diffKwh),
        trend: diffKwh > 0 ? "increased" : diffKwh < 0 ? "decreased" : "same",
        percentageChange: Math.abs(percentageChange)
      };
    } catch (e) {
      console.warn('[contextBuilder] Error fetching weeklyTrend:', e.message);
    }

    // 6. ML Wallet Lifetime & Days Remaining Prediction
    try {
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

      const pred = getWalletLifetimePrediction({
        walletBalance: activeMeter.balance,
        currentCycleKWh: context.cycleUsage.netKwh,
        currentCycleDay: context.cycleUsage.daysInCycle,
        dailyHistory: historyResult.rows.map(r => ({
          date: r.date,
          consumption: parseFloat(r.consumption || 0),
          dayOfWeek: r.day_of_week
        })),
        emergencyCreditLimit: activeMeter.emergencyCreditLimit,
        emergencyCreditActive: activeMeter.emergencyCreditActive
      });

      context.prediction = {
        estimatedDaysRemaining: pred.estimatedDaysRemaining,
        estimatedMinDays: pred.estimatedMinDays,
        estimatedMaxDays: pred.estimatedMaxDays,
        averageDailyUsageKwh: pred.averageDailyUsageKwh,
        currentTariffGroup: pred.currentTariffGroup,
        isLifelineActive: pred.isLifelineActive,
        lifelineRemaining: pred.lifelineRemaining,
        lifelineUsed: pred.lifelineUsed
      };
    } catch (e) {
      console.warn('[contextBuilder] Error computing prediction:', e.message);
    }

    // 7. Recent Payment Transactions
    try {
      const payRes = await pool.query(
        `SELECT amount, payment_method, transaction_id, previous_balance, new_balance, status, created_at
         FROM payments
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [userId]
      );
      context.recentPayments = payRes.rows.map(p => ({
        amount: parseFloat(p.amount),
        method: p.payment_method,
        transactionId: p.transaction_id,
        status: p.status,
        date: new Date(p.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        previousBalance: parseFloat(p.previous_balance || 0),
        newBalance: parseFloat(p.new_balance || 0)
      }));
    } catch (e) {
      console.warn('[contextBuilder] Error fetching payments:', e.message);
    }

    // 8. Recent Complaints
    try {
      const compRes = await pool.query(
        `SELECT ticket_number, complaint_type, subject, status, created_at
         FROM complaints
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 2`,
        [userId]
      );
      context.recentComplaints = compRes.rows.map(c => ({
        ticketNumber: c.ticket_number,
        category: c.complaint_type,
        subject: c.subject,
        status: c.status,
        date: new Date(c.created_at).toLocaleDateString()
      }));
    } catch (e) {
      // Complaints table may be empty or non-existent
    }

  } catch (error) {
    console.error('[contextBuilder] Fatal error constructing user context:', error);
  }

  return context;
}

/**
 * Format user context into a compact markdown summary for LLM prompt injection
 */
function formatContextForPrompt(ctx) {
  if (!ctx.hasMeters || !ctx.primaryMeter) {
    return "No smart meters currently linked to this customer account.";
  }

  const m = ctx.primaryMeter;
  const pred = ctx.prediction || {};
  const tou = ctx.currentTOU;
  const lastPay = ctx.recentPayments[0];

  return `
CUSTOMER METER SNAPSHOT:
- Meter Number: ${m.meterNumber} (Account: ${m.accountNumber})
- Connection Status: ${m.status}
- Current Prepaid Balance: Rs. ${m.balance.toFixed(2)}
- Emergency Credit (Lifeline): ${m.emergencyCreditActive ? `ACTIVE (Remaining buffer: Rs. ${(pred.lifelineRemaining || 0).toFixed(2)})` : `Available up to Rs. ${m.emergencyCreditLimit.toFixed(2)}`}
- Today's Net Usage: ${ctx.todayUsage.netKwh} kWh (Import: ${ctx.todayUsage.importKwh} kWh, Solar Export: ${ctx.todayUsage.exportKwh} kWh)
- Current Month Cumulative: ${ctx.cycleUsage.netKwh} kWh consumed in ${ctx.cycleUsage.daysInCycle} days
- Current PUCSL Block Tier: ${pred.currentTariffGroup || "Domestic Block"}

PREDICTION & USAGE PATTERNS:
- Estimated Days of Power Remaining: ~${pred.estimatedDaysRemaining ?? "N/A"} days (Range: ${pred.estimatedMinDays ?? "N/A"}-${pred.estimatedMaxDays ?? "N/A"} days)
- Average Daily Burn Rate: ${pred.averageDailyUsageKwh ?? "N/A"} kWh/day
${ctx.weeklyTrend ? `- Weekly Consumption Trend: ${ctx.weeklyTrend.thisWeekNetKwh} kWh this week vs ${ctx.weeklyTrend.lastWeekNetKwh} kWh last week (${ctx.weeklyTrend.trend} by ${ctx.weeklyTrend.percentageChange}%)` : ""}

TIME-OF-USE STATUS RIGHT NOW:
- Current Phase: ${tou.name} (${tou.window}) at Rs. ${tou.ratePerKwh.toFixed(2)}/kWh
- Advisory: ${tou.advisory}

RECENT TRANSACTIONS & SUPPORT:
${lastPay ? `- Last Recharge: Rs. ${lastPay.amount.toFixed(2)} via ${lastPay.method.toUpperCase()} on ${lastPay.date} (Ref: ${lastPay.transactionId})` : "- No previous recharges on record."}
${ctx.recentComplaints.length > 0 ? `- Active Complaint: Ticket ${ctx.recentComplaints[0].ticketNumber} (${ctx.recentComplaints[0].category} - Status: ${ctx.recentComplaints[0].status})` : "- No pending complaints."}
`.trim();
}

module.exports = {
  buildUserContext,
  formatContextForPrompt,
  getCurrentTOUPhase
};
