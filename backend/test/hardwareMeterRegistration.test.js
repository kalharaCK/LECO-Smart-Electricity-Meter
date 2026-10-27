const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.JWT_SECRET = 'controller-test-secret-with-more-than-thirty-two-characters';

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { 
  registerMeterForStaff, 
  assignMeterToCustomerForStaff, 
  getUnregisteredHardwareMetersForStaff 
} = require('../src/controllers/meterController');

function createResponseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

test('registerMeterForStaff updates and provisions an unassigned hardware meter without 409 conflict', async () => {
  const originalQuery = pool.query;
  const mockQueries = [];

  pool.query = async (queryText, values) => {
    mockQueries.push({ text: queryText, values });
    if (/SELECT id, user_id, meter_number FROM meters/i.test(queryText)) {
      // Meter exists in meters table from hardware telemetry, but user_id is NULL (unclaimed)
      return { 
        rows: [{ 
          id: 19, 
          meter_number: 'METER-001', 
          user_id: null 
        }] 
      };
    }
    if (/UPDATE meters SET/i.test(queryText)) {
      return {
        rows: [{
          id: 19,
          meter_number: 'METER-001',
          account_number: values[0],
          registered_nic: values[1],
          staff_passcode: values[3],
          balance: values[4],
          status: 'Connected',
          name: values[5]
        }]
      };
    }
    if (/INSERT INTO payments/i.test(queryText)) {
      return { rows: [{ id: 101 }] };
    }
    if (/INSERT INTO staff_activity_logs/i.test(queryText)) {
      return { rows: [{ id: 201 }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      body: {
        meter_number: 'METER-001',
        account_number: 'ACC-METER-001',
        registered_nic: '199012345678',
        passcode: '719302',
        initial_balance: 1500,
        name: 'Hardware Lab Test Meter'
      }
    };
    const res = createResponseStub();

    await registerMeterForStaff(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.meter.meter_number, 'METER-001');
    assert.equal(res.body.passcode, '719302');
  } finally {
    pool.query = originalQuery;
  }
});

test('registerMeterForStaff rejects already claimed meter with 409 conflict', async () => {
  const originalQuery = pool.query;

  pool.query = async (queryText) => {
    if (/SELECT id, user_id, meter_number FROM meters/i.test(queryText)) {
      return { 
        rows: [{ 
          id: 10, 
          meter_number: 'METER-CLAIMED', 
          user_id: 5 // Already claimed
        }] 
      };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      body: {
        meter_number: 'METER-CLAIMED',
        account_number: 'ACC-CLAIMED',
        registered_nic: '199012345678'
      }
    };
    const res = createResponseStub();

    await registerMeterForStaff(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already registered and claimed/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('assignMeterToCustomerForStaff requires staff authorization password', async () => {
  const req = {
    user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
    params: { meterId: 19 },
    body: { customerId: 2 }
  };
  const res = createResponseStub();

  await assignMeterToCustomerForStaff(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Staff authorization password is required/i);
});

test('assignMeterToCustomerForStaff rejects invalid staff password with 401', async () => {
  const originalQuery = pool.query;
  const staffHash = await bcrypt.hash('correctPassword123', 10);

  pool.query = async (queryText) => {
    if (/SELECT password FROM users WHERE id/i.test(queryText)) {
      return { rows: [{ password: staffHash }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      params: { meterId: 19 },
      body: { customerId: 2, staffPassword: 'wrongPassword' }
    };
    const res = createResponseStub();

    await assignMeterToCustomerForStaff(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Incorrect staff authorization password/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('assignMeterToCustomerForStaff successfully assigns meter to customer and returns voucher', async () => {
  const originalQuery = pool.query;
  const staffHash = await bcrypt.hash('staffPassword123', 10);

  pool.query = async (queryText, values) => {
    if (/SELECT password FROM users WHERE id/i.test(queryText)) {
      return { rows: [{ password: staffHash }] };
    }
    if (/SELECT \* FROM meters WHERE id/i.test(queryText)) {
      return { 
        rows: [{ 
          id: 19, 
          meter_number: 'METER-001', 
          account_number: 'ACC-METER-001',
          staff_passcode: '719302',
          balance: 1500,
          status: 'Connected',
          name: 'Smart Hardware Meter METER-001'
        }] 
      };
    }
    if (/SELECT id, email, full_name, mobile_number, nic, role FROM users WHERE id = \$1/i.test(queryText)) {
      return { 
        rows: [{ 
          id: 5, 
          email: 'customer.perera@leco.lk', 
          full_name: 'Kamal Perera',
          mobile_number: '0771234567',
          nic: '198812345678',
          role: 'customer'
        }] 
      };
    }
    if (/UPDATE meters SET/i.test(queryText)) {
      return {
        rows: [{
          id: 19,
          user_id: values[0],
          registered_nic: values[1],
          staff_passcode: values[2],
          pin: values[3],
          balance: values[4],
          name: values[5],
          status: 'Connected',
          meter_number: 'METER-001',
          account_number: 'ACC-METER-001'
        }]
      };
    }
    if (/INSERT INTO notifications/i.test(queryText)) {
      return { rows: [{ id: 99 }] };
    }
    if (/INSERT INTO staff_activity_logs/i.test(queryText)) {
      return { rows: [{ id: 101 }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      params: { meterId: 19 },
      body: { 
        customerId: 5, 
        staffPassword: 'staffPassword123',
        passcode: '719302',
        initialBalance: 2000,
        name: 'Residence Solar Smart Meter'
      }
    };
    const res = createResponseStub();

    await assignMeterToCustomerForStaff(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.voucher.meterNumber, 'METER-001');
    assert.equal(res.body.voucher.customerName, 'Kamal Perera');
    assert.equal(res.body.voucher.customerEmail, 'customer.perera@leco.lk');
    assert.equal(res.body.voucher.passcode, '719302');
    assert.equal(res.body.voucher.balance, 2000);
  } finally {
    pool.query = originalQuery;
  }
});

test('getUnregisteredHardwareMetersForStaff returns hardware telemetry meters list', async () => {
  const originalQuery = pool.query;

  pool.query = async (queryText) => {
    if (/FROM meter_readings mr/i.test(queryText)) {
      return {
        rows: [{
          meter_id: 'METER-001',
          meter_db_id: 19,
          account_number: 'ACC-METER-001',
          status: 'Connected',
          balance: '1500.00',
          staff_passcode: '719302',
          is_claimed: false,
          total_telemetry_records: 67,
          latest_voltage: '2291',
          latest_current: '0',
          latest_power: '0',
          latest_energy: '6019'
        }]
      };
    }
    return { rows: [] };
  };

  try {
    const req = { user: { id: 1, role: 'staff' } };
    const res = createResponseStub();

    await getUnregisteredHardwareMetersForStaff(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.hardwareMeters.length, 1);
    assert.equal(res.body.hardwareMeters[0].meter_id, 'METER-001');
    assert.equal(res.body.hardwareMeters[0].is_claimed, false);
    assert.equal(res.body.hardwareMeters[0].total_telemetry_records, 67);
  } finally {
    pool.query = originalQuery;
  }
});
