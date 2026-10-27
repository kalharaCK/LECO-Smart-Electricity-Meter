const test = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

const { buildPaymentReceiptPdf, buildMeterStatementPdf } = require('../src/services/pdfReportService');

test('buildPaymentReceiptPdf produces valid standard PDF binary buffer with magic header', async () => {
  const mockPayment = {
    transaction_id: 'TXN-998811',
    order_id: 'LECO-ORD-1234',
    payhere_payment_id: 'PH-5544',
    amount: 2500.00,
    previous_balance: 450.00,
    new_balance: 2950.00,
    status: 'Success',
    payment_method: 'PayHere Online',
    meter_number: 'LECO-COL-9901',
    account_number: 'ACC-883921',
    customer_name: 'Sunil Perera',
    mobile_number: '+94 77 123 4567',
    created_at: '2026-10-27T01:30:00.000Z'
  };

  const buffer = await buildPaymentReceiptPdf(mockPayment);

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 5000);
  // Verify PDF-1.3 standard magic header bytes
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('buildPaymentReceiptPdf gracefully handles minimal and fallback payment fields', async () => {
  const minimalPayment = {
    transaction_id: 'TXN-MINIMAL-1',
    amount: 500.00,
    previous_balance: 0.00,
    new_balance: 500.00
  };

  const buffer = await buildPaymentReceiptPdf(minimalPayment);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('buildMeterStatementPdf generates valid monthly consumption statement PDF', async () => {
  const statementData = {
    meter: {
      meter_number: 'LECO-COL-9901',
      account_number: 'ACC-883921',
      name: 'Primary Residence',
      balance: 1850.50,
      status: 'Connected',
      tariff_type: 'Domestic D-1 (PUCSL Block Tariff)'
    },
    user: {
      full_name: 'Sunil Perera',
      email: 'customer@leco.lk',
      mobile_number: '+94 77 123 4567'
    },
    logs: [
      { reading_date: '2026-10-20', consumption: 4.5, energy_export: 1.2 },
      { reading_date: '2026-10-21', consumption: 5.0, energy_export: 0.8 },
      { reading_date: '2026-10-22', consumption: 6.2, energy_export: 1.5 }
    ],
    payments: [
      { transaction_id: 'TXN-01', amount: 2000, new_balance: 2450, payment_method: 'PayHere', created_at: '2026-10-15' }
    ],
    periodLabel: '01 Oct 2026 - 31 Oct 2026'
  };

  const buffer = await buildMeterStatementPdf(statementData);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 5000);
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});

test('buildMeterStatementPdf calculates PUCSL Group A domestic tariffs for low consumption', async () => {
  const lowUsageData = {
    meter: { meter_number: 'LECO-TEST-01', balance: 500 },
    user: { full_name: 'Lifeline User' },
    logs: [
      { reading_date: '2026-10-01', consumption: 25.0, energy_export: 0 }
    ],
    payments: []
  };

  const buffer = await buildMeterStatementPdf(lowUsageData);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
});
