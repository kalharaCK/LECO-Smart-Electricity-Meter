"""
Unit tests for the Python PUCSL domestic tariff implementation.
Asserts mathematical equivalence with PUCSL regulations and Node.js implementation.
"""

import pytest
from ml.tariff.tariff_engine import calculate_domestic_bill, calculate_incremental_charge


def test_group_a_zero_to_thirty():
    """Group A (0 - 30 kWh): 5.00 LKR/kWh, Fixed 80.00 LKR"""
    res = calculate_domestic_bill(20)
    assert res["group"] == "Group A (0-30)"
    assert res["energy_charge"] == 100.00
    assert res["fixed_charge"] == 80.00
    assert res["total_charge"] == 180.00
    assert res["effective_rate"] == 9.00


def test_group_a_thirty_to_sixty():
    """Group A (31 - 60 kWh): First 30 @ 5, next @ 9, Fixed 210.00 LKR"""
    res = calculate_domestic_bill(50)
    assert res["group"] == "Group A (31-60)"
    # 30 * 5 = 150; 20 * 9 = 180; total energy = 330
    assert res["energy_charge"] == 330.00
    assert res["fixed_charge"] == 210.00
    assert res["total_charge"] == 540.00


def test_group_b_sixty_to_ninety():
    """Group B (61 - 90 kWh): First 60 @ 14, next @ 20, Fixed 400.00 LKR"""
    res = calculate_domestic_bill(75)
    assert res["group"] == "Group B (61-90)"
    # 60 * 14 = 840; 15 * 20 = 300; total energy = 1140
    assert res["energy_charge"] == 1140.00
    assert res["fixed_charge"] == 400.00
    assert res["total_charge"] == 1540.00


def test_group_c_above_one_eighty():
    """Group C (> 180 kWh): First 180 @ 32.50, remaining @ 100, Fixed 2500.00 LKR"""
    res = calculate_domestic_bill(200)
    assert res["group"] == "Group C (>180)"
    # 180 * 32.50 = 5850; 20 * 100 = 2000; total energy = 7850
    assert res["energy_charge"] == 7850.00
    assert res["fixed_charge"] == 2500.00
    assert res["total_charge"] == 10350.00


def test_incremental_charge_calculation():
    """Validates non-linear incremental cost when adding delta_kwh to current_cycle_kwh."""
    # From 25 kWh to 28 kWh within 0-30 tier: 3 kWh * 5.00 = 15.00
    inc_1 = calculate_incremental_charge(25.0, 3.0)
    assert inc_1 == 15.00

    # From 30 kWh to 35 kWh crosses Group A threshold (fixed charge increases from 80 to 210):
    # bill at 30: 30*5 + 80 = 230
    # bill at 35: 30*5 + 5*9 + 210 = 150 + 45 + 210 = 405
    # incremental = 405 - 230 = 175.00
    inc_2 = calculate_incremental_charge(30.0, 5.0)
    assert inc_2 == 175.00
