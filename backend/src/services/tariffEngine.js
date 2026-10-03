/**
 * Sri Lankan PUCSL Domestic Block Tariff Engine
 * Reference: PUCSL End-User Domestic Electricity Tariff (Effective May 2026 / Continued July 2026)
 *
 * Structure Principle:
 * Total consumption in a 30-day billing period determines the tariff group (A, B, or C).
 * DO NOT treat all rows as one progressive slab table.
 *
 * Group A (Total 0 - 60 kWh):
 *   - 0 - 30 kWh:  LKR 5.00 / kWh, Fixed Charge: LKR 80.00 (when total <= 30)
 *   - 31 - 60 kWh: LKR 9.00 / kWh, Fixed Charge: LKR 210.00 (when total 31 - 60)
 *
 * Group B (Total 61 - 180 kWh):
 *   - First 60 units (0 - 60): LKR 14.00 / kWh (no fixed charge for this row)
 *   - 61 - 90 kWh:   LKR 20.00 / kWh, Fixed Charge: LKR 400.00 (when total 61 - 90)
 *   - 91 - 120 kWh:  LKR 28.00 / kWh, Fixed Charge: LKR 1,000.00 (when total 91 - 120)
 *   - 121 - 180 kWh: LKR 44.00 / kWh, Fixed Charge: LKR 1,500.00 (when total 121 - 180)
 *
 * Group C (Total > 180 kWh):
 *   - 0 - 180 kWh:   LKR 32.50 / kWh
 *   - Above 180 kWh: LKR 100.00 / kWh
 *   - Fixed Charge:  LKR 2,500.00
 */

/**
 * Calculates electricity bill for a given total kWh consumption in a 30-day cycle.
 * @param {number} kwh - Total kWh consumed in the billing cycle
 * @returns {{ group: string, energyCharge: number, fixedCharge: number, totalCharge: number, effectiveRate: number }}
 */
function calculateDomesticBill(kwh) {
  const usage = Math.max(0, Number(kwh) || 0);

  let group = "";
  let energyCharge = 0;
  let fixedCharge = 0;

  if (usage <= 60) {
    // Group A (0 - 60 kWh)
    group = usage <= 30 ? "Group A (0-30)" : "Group A (31-60)";

    if (usage <= 30) {
      energyCharge = usage * 5.0;
      fixedCharge = 80.0;
    } else {
      energyCharge = 30 * 5.0 + (usage - 30) * 9.0;
      fixedCharge = 210.0;
    }
  } else if (usage <= 180) {
    // Group B (61 - 180 kWh)
    if (usage <= 90) {
      group = "Group B (61-90)";
      energyCharge = 60 * 14.0 + (usage - 60) * 20.0;
      fixedCharge = 400.0;
    } else if (usage <= 120) {
      group = "Group B (91-120)";
      energyCharge = 60 * 14.0 + 30 * 20.0 + (usage - 90) * 28.0;
      fixedCharge = 1000.0;
    } else {
      group = "Group B (121-180)";
      energyCharge = 60 * 14.0 + 30 * 20.0 + 30 * 28.0 + (usage - 120) * 44.0;
      fixedCharge = 1500.0;
    }
  } else {
    // Group C (> 180 kWh)
    group = "Group C (>180)";
    energyCharge = 180 * 32.5 + (usage - 180) * 100.0;
    fixedCharge = 2500.0;
  }

  const totalCharge = Math.round((energyCharge + fixedCharge) * 100) / 100;
  const effectiveRate = usage > 0 ? Math.round((totalCharge / usage) * 100) / 100 : 0;

  return {
    group,
    kwh: Math.round(usage * 100) / 100,
    energyCharge: Math.round(energyCharge * 100) / 100,
    fixedCharge: Math.round(fixedCharge * 100) / 100,
    totalCharge,
    effectiveRate,
  };
}

module.exports = {
  calculateDomesticBill,
};
