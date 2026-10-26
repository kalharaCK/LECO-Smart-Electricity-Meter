const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDomesticBill } = require('../src/services/tariffEngine');

test('domestic tariff applies the expected fixed charge and group at each boundary', () => {
  const cases = [
    [0, 'Group A (0-30)', 80],
    [30, 'Group A (0-30)', 230],
    [31, 'Group A (31-60)', 369],
    [60, 'Group A (31-60)', 630],
    [61, 'Group B (61-90)', 1260],
    [90, 'Group B (61-90)', 1840],
    [91, 'Group B (91-120)', 2468],
    [120, 'Group B (91-120)', 3280],
    [121, 'Group B (121-180)', 3824],
    [180, 'Group B (121-180)', 6420],
    [181, 'Group C (>180)', 8450],
  ];

  for (const [kwh, group, totalCharge] of cases) {
    const bill = calculateDomesticBill(kwh);
    assert.equal(bill.group, group, `group at ${kwh} kWh`);
    assert.equal(bill.totalCharge, totalCharge, `charge at ${kwh} kWh`);
  }
});

test('negative or nonnumeric usage cannot create invalid charges', () => {
  for (const input of [-10, NaN, 'not-a-number']) {
    const bill = calculateDomesticBill(input);
    assert.equal(bill.kwh, 0);
    assert.equal(bill.totalCharge, 80);
    assert.ok(Number.isFinite(bill.effectiveRate));
  }
});
