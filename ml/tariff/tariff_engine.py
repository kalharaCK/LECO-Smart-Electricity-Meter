"""
Sri Lankan PUCSL Domestic Block Tariff Engine (Python Implementation)
Matches PUCSL End-User Domestic Electricity Tariff.
Provides full cycle billing and incremental billing calculations.
"""

from typing import Dict, Any
import math


def calculate_domestic_bill(kwh: float) -> Dict[str, Any]:
    """
    Calculates electricity bill for a given total kWh consumption in a 30-day cycle.

    Group A (Total 0 - 60 kWh):
      - 0 - 30 kWh:  LKR 5.00 / kWh, Fixed: LKR 80.00
      - 31 - 60 kWh: LKR 9.00 / kWh, Fixed: LKR 210.00

    Group B (Total 61 - 180 kWh):
      - 0 - 60 kWh:   LKR 14.00 / kWh
      - 61 - 90 kWh:  LKR 20.00 / kWh, Fixed: LKR 400.00
      - 91 - 120 kWh: LKR 28.00 / kWh, Fixed: LKR 1,000.00
      - 121 - 180 kWh: LKR 44.00 / kWh, Fixed: LKR 1,500.00

    Group C (Total > 180 kWh):
      - 0 - 180 kWh:   LKR 32.50 / kWh
      - > 180 kWh:     LKR 100.00 / kWh, Fixed: LKR 2,500.00
    """
    if not isinstance(kwh, (int, float)) or math.isnan(kwh) or math.isinf(kwh):
        kwh = 0.0
    usage = max(0.0, float(kwh))

    group: str = ""
    energy_charge: float = 0.0
    fixed_charge: float = 0.0

    if usage <= 60.0:
        if usage <= 30.0:
            group = "Group A (0-30)"
            energy_charge = usage * 5.0
            fixed_charge = 80.0
        else:
            group = "Group A (31-60)"
            energy_charge = (30.0 * 5.0) + ((usage - 30.0) * 9.0)
            fixed_charge = 210.0
    elif usage <= 180.0:
        if usage <= 90.0:
            group = "Group B (61-90)"
            energy_charge = (60.0 * 14.0) + ((usage - 60.0) * 20.0)
            fixed_charge = 400.0
        elif usage <= 120.0:
            group = "Group B (91-120)"
            energy_charge = (60.0 * 14.0) + (30.0 * 20.0) + ((usage - 90.0) * 28.0)
            fixed_charge = 1000.0
        else:
            group = "Group B (121-180)"
            energy_charge = (60.0 * 14.0) + (30.0 * 20.0) + (30.0 * 28.0) + ((usage - 120.0) * 44.0)
            fixed_charge = 1500.0
    else:
        group = "Group C (>180)"
        energy_charge = (180.0 * 32.5) + ((usage - 180.0) * 100.0)
        fixed_charge = 2500.0

    total_charge = round(energy_charge + fixed_charge, 2)
    effective_rate = round(total_charge / usage, 2) if usage > 0 else 0.0

    return {
        "group": group,
        "kwh": round(usage, 2),
        "energy_charge": round(energy_charge, 2),
        "fixed_charge": round(fixed_charge, 2),
        "total_charge": total_charge,
        "effective_rate": effective_rate,
        # CamelCase aliases for cross-compatibility with Node.js
        "totalCharge": total_charge,
        "energyCharge": round(energy_charge, 2),
        "fixedCharge": round(fixed_charge, 2),
        "effectiveRate": effective_rate
    }


def calculate_incremental_charge(current_cycle_kwh: float, delta_kwh: float) -> float:
    """
    Computes the incremental charge (in LKR) incurred by consuming additional delta_kwh
    above the already consumed current_cycle_kwh.
    Handles non-linear block jumps and tiered rate shifts.
    """
    base_kwh = max(0.0, float(current_cycle_kwh))
    added_kwh = max(0.0, float(delta_kwh))
    if added_kwh <= 0.0:
        return 0.0

    bill_before = calculate_domestic_bill(base_kwh)
    bill_after = calculate_domestic_bill(base_kwh + added_kwh)

    incremental = max(0.0, bill_after["total_charge"] - bill_before["total_charge"])
    return round(incremental, 2)
