const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';
process.env.JWT_SECRET = 'controller-test-secret-with-more-than-thirty-two-characters';

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { addMeter, registerMeterForStaff, regenerateMeterPasscodeForStaff } = require('../src/controllers/meterController');
const { resetCustomerPasswordForStaff } = require('../src/controllers/staffCustomerController');

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

test('registerMeterForStaff requires meter_number, account_number, and registered_nic', async () => {
  const req = {
    user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
    body: { meter_number: '', account_number: 'ACC-123', registered_nic: '199512345678' }
  };
  const res = createResponseStub();

  await registerMeterForStaff(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /Meter number is required/i);
});

test('registerMeterForStaff successfully provisions new meter with generated passcode and NIC', async () => {
  const originalQuery = pool.query;
  const mockQueries = [];

  pool.query = async (queryText, values) => {
    mockQueries.push({ text: queryText, values });
    if (/SELECT id FROM meters/i.test(queryText)) {
      return { rows: [] }; // No existing meter
    }
    if (/INSERT INTO meters/i.test(queryText)) {
      return {
        rows: [{
          id: 42,
          meter_number: values[0],
          account_number: values[1],
          pin: values[2],
          staff_passcode: values[3],
          registered_nic: values[4],
          balance: values[5],
          status: 'Connected',
          name: values[6],
          created_at: new Date()
        }]
      };
    }
    if (/INSERT INTO staff_activity_logs/i.test(queryText)) {
      return { rows: [{ id: 1 }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      body: {
        meter_number: 'MTR-99001',
        account_number: 'ACC-99001',
        registered_nic: '199012345678',
        passcode: '882190'
      }
    };
    const res = createResponseStub();

    await registerMeterForStaff(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.meter.meter_number, 'MTR-99001');
    assert.equal(res.body.meter.registered_nic, '199012345678');
    assert.equal(res.body.passcode, '882190');
  } finally {
    pool.query = originalQuery;
  }
});

test('regenerateMeterPasscodeForStaff fails if staff authorization password is wrong', async () => {
  const originalQuery = pool.query;
  const staffHash = await bcrypt.hash('correct_staff_pass', 10);

  pool.query = async (queryText) => {
    if (/SELECT password FROM users/i.test(queryText)) {
      return { rows: [{ password: staffHash }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk' },
      params: { meterId: 42 },
      body: { staffPassword: 'wrong_password' }
    };
    const res = createResponseStub();

    await regenerateMeterPasscodeForStaff(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Incorrect staff authorization password/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('addMeter blocks linking if customer account NIC does not match meter registered_nic (Anti-Theft)', async () => {
  const originalQuery = pool.query;
  const pinHash = await bcrypt.hash('778899', 10);

  pool.query = async (queryText) => {
    if (/SELECT id, nic, email, full_name FROM users/i.test(queryText)) {
      // Customer has a different NIC
      return { rows: [{ id: 10, nic: '200155667788', email: 'thief@example.com', full_name: 'Impostor' }] };
    }
    if (/SELECT id, user_id, meter_number/i.test(queryText)) {
      // Meter is registered under legitimate owner's NIC
      return {
        rows: [{
          id: 55,
          user_id: null,
          meter_number: 'MTR-LECO-55',
          account_number: 'ACC-LECO-55',
          pin: pinHash,
          staff_passcode: '778899',
          registered_nic: '198511223344', // Legitimate owner NIC
          name: 'Home',
          balance: 100
        }]
      };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 10 },
      body: {
        meterNumber: 'MTR-LECO-55',
        accountNumber: 'ACC-LECO-55',
        pin: '778899',
        name: 'Stolen Meter Link'
      }
    };
    const res = createResponseStub();

    await addMeter(req, res);

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /Anti-Theft Protection/i);
    assert.match(res.body.message, /Your account NIC does not match/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('addMeter rejects incorrect staff passcode', async () => {
  const originalQuery = pool.query;
  const pinHash = await bcrypt.hash('654321', 10);

  pool.query = async (queryText) => {
    if (/SELECT id, nic, email, full_name FROM users/i.test(queryText)) {
      return { rows: [{ id: 10, nic: '198511223344', email: 'owner@example.com', full_name: 'Real Owner' }] };
    }
    if (/SELECT id, user_id, meter_number/i.test(queryText)) {
      return {
        rows: [{
          id: 55,
          user_id: null,
          meter_number: 'MTR-LECO-55',
          account_number: 'ACC-LECO-55',
          pin: pinHash,
          staff_passcode: '654321',
          registered_nic: '198511223344',
          name: 'Home',
          balance: 100
        }]
      };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 10 },
      body: {
        meterNumber: 'MTR-LECO-55',
        accountNumber: 'ACC-LECO-55',
        pin: '000000', // Invalid passcode
        name: 'Home'
      }
    };
    const res = createResponseStub();

    await addMeter(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /Invalid Meter Passcode/i);
  } finally {
    pool.query = originalQuery;
  }
});

test('addMeter links meter successfully when customer NIC and staff passcode match', async () => {
  const originalQuery = pool.query;
  const pinHash = await bcrypt.hash('654321', 10);

  pool.query = async (queryText, values) => {
    if (/SELECT id, nic, email, full_name FROM users/i.test(queryText)) {
      return { rows: [{ id: 10, nic: '198511223344', email: 'owner@example.com', full_name: 'Real Owner' }] };
    }
    if (/SELECT id, user_id, meter_number/i.test(queryText)) {
      return {
        rows: [{
          id: 55,
          user_id: null,
          meter_number: 'MTR-LECO-55',
          account_number: 'ACC-LECO-55',
          pin: pinHash,
          staff_passcode: '654321',
          registered_nic: '198511223344',
          name: 'Home',
          balance: 100
        }]
      };
    }
    if (/UPDATE meters/i.test(queryText)) {
      return {
        rows: [{
          id: 55,
          user_id: 10,
          meter_number: 'MTR-LECO-55',
          account_number: 'ACC-LECO-55',
          registered_nic: '198511223344',
          balance: 100,
          status: 'Connected',
          name: values[1]
        }]
      };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 10 },
      body: {
        meterNumber: 'MTR-LECO-55',
        accountNumber: 'ACC-LECO-55',
        pin: '654321',
        name: 'My Living Room'
      }
    };
    const res = createResponseStub();

    await addMeter(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Meter linked successfully');
    assert.equal(res.body.meter.meter_number, 'MTR-LECO-55');
    assert.equal(res.body.meter.registered_nic, '198511223344');
  } finally {
    pool.query = originalQuery;
  }
});

test('resetCustomerPasswordForStaff successfully updates customer password with staff authorization', async () => {
  const originalQuery = pool.query;
  const staffHash = await bcrypt.hash('StaffSecure123', 10);
  let updatedPasswordHash = null;

  pool.query = async (queryText, values) => {
    if (/SELECT password FROM users WHERE id = \$1/i.test(queryText)) {
      return { rows: [{ password: staffHash }] };
    }
    if (/SELECT id, email, full_name, mobile_number, nic FROM users WHERE id = \$1 AND role = \$2/i.test(queryText)) {
      return {
        rows: [{
          id: 25,
          email: 'customer25@example.com',
          full_name: 'Nimal Perera',
          mobile_number: '0771234567',
          nic: '199211223344'
        }]
      };
    }
    if (/UPDATE users SET password = \$1 WHERE id = \$2/i.test(queryText)) {
      updatedPasswordHash = values[0];
      return { rows: [] };
    }
    if (/INSERT INTO staff_activity_logs/i.test(queryText)) {
      return { rows: [{ id: 1 }] };
    }
    return { rows: [] };
  };

  try {
    const req = {
      user: { id: 1, email: 'staff@leco.lk', role: 'staff' },
      params: { customerId: 25 },
      body: {
        staffPassword: 'StaffSecure123',
        newPassword: 'BrandNewCustomerPass99!',
        reason: 'Customer verified in person with national ID'
      }
    };
    const res = createResponseStub();

    await resetCustomerPasswordForStaff(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /successfully reset/i);

    // Verify the password was hashed with bcrypt
    assert.ok(updatedPasswordHash);
    const matches = await bcrypt.compare('BrandNewCustomerPass99!', updatedPasswordHash);
    assert.equal(matches, true);
  } finally {
    pool.query = originalQuery;
  }
});
