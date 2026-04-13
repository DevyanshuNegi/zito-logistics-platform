require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { LoginOtp, User, sequelize } = require('../src/models');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000/api/v1';

const TEST_USERS = [
  {
    key: 'super_admin',
    full_name: 'Vishal Admin',
    email: 'superadmin@zito.co.ke',
    phone: '0712000001',
    password: 'Admin@1234',
    role: 'super_admin',
  },
  {
    key: 'operations_admin',
    full_name: 'Ops Admin',
    email: 'ops@zito.co.ke',
    phone: '0712000002',
    password: 'Admin@1234',
    role: 'operations_admin',
  },
  {
    key: 'finance_admin',
    full_name: 'Finance Admin',
    email: 'finance@zito.co.ke',
    phone: '0712000003',
    password: 'Admin@1234',
    role: 'finance_admin',
  },
  {
    key: 'customer',
    full_name: 'John Kamau',
    email: 'john@customer.co.ke',
    phone: '0712111001',
    password: 'Customer@1234',
    role: 'customer',
  },
];

const results = [];

const record = (name, passed, details) => {
  results.push({ name, passed, details });
};

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
};

const ensureUser = async (user) => {
  const existing = await User.findOne({ where: { email: user.email } });
  if (existing) return existing;

  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(user),
  });

  if (response.status !== 201) {
    throw new Error(`Registration failed for ${user.role}: ${JSON.stringify(response.body)}`);
  }

  return User.findOne({ where: { email: user.email } });
};

const loginAndVerify = async (user) => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (loginResponse.status !== 200) {
    throw new Error(`Login failed for ${user.role}: ${JSON.stringify(loginResponse.body)}`);
  }

  const otpRow = await LoginOtp.findOne({
    where: { type: 'login' },
    include: [{ model: User, as: 'user', required: true, where: { email: user.email } }],
    order: [['created_at', 'DESC']],
  });

  if (!otpRow) {
    throw new Error(`No OTP row found for ${user.email}`);
  }

  const verifyResponse = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      contact: user.email,
      otp: otpRow.otp,
      type: 'login',
    }),
  });

  if (verifyResponse.status !== 200) {
    throw new Error(`OTP verify failed for ${user.role}: ${JSON.stringify(verifyResponse.body)}`);
  }

  const token = verifyResponse.body?.data?.accessToken || verifyResponse.body?.data?.token;
  if (!token) {
    throw new Error(`No token returned for ${user.role}`);
  }

  return token;
};

const run = async () => {
  try {
    const createdUsers = {};
    for (const user of TEST_USERS) {
      createdUsers[user.key] = await ensureUser(user);
      record(`register:${user.role}`, true, `ready (${createdUsers[user.key].id})`);
    }

    const tokens = {};
    for (const user of TEST_USERS.slice(0, 3)) {
      tokens[user.key] = await loginAndVerify(user);
      record(`auth:${user.role}`, true, 'login + otp verified');
    }

    const noTokenResponse = await request('/admin/stats');
    record(
      'access:no-token-admin-stats',
      noTokenResponse.status === 401,
      `status=${noTokenResponse.status}`
    );

    const superStats = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${tokens.super_admin}` },
    });
    record('super_admin:admin-stats', superStats.status === 200, `status=${superStats.status}`);

    const superSettings = await request('/admin/system-settings', {
      headers: { Authorization: `Bearer ${tokens.super_admin}` },
    });
    record('super_admin:system-settings', superSettings.status === 200, `status=${superSettings.status}`);

    const opsStats = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${tokens.operations_admin}` },
    });
    record('operations_admin:admin-stats', opsStats.status === 200, `status=${opsStats.status}`);

    const opsSettings = await request('/admin/system-settings', {
      headers: { Authorization: `Bearer ${tokens.operations_admin}` },
    });
    record('operations_admin:system-settings-denied', opsSettings.status === 403, `status=${opsSettings.status}`);

    const opsPayments = await request('/payment', {
      headers: { Authorization: `Bearer ${tokens.operations_admin}` },
    });
    record('operations_admin:payments-denied', opsPayments.status === 403, `status=${opsPayments.status}`);

    const opsFinancialReport = await request('/admin/reports/financial', {
      headers: { Authorization: `Bearer ${tokens.operations_admin}` },
    });
    record(
      'operations_admin:financial-report-denied',
      opsFinancialReport.status === 403,
      `status=${opsFinancialReport.status}`
    );

    const financePayments = await request('/payment', {
      headers: { Authorization: `Bearer ${tokens.finance_admin}` },
    });
    record('finance_admin:payments', financePayments.status === 200, `status=${financePayments.status}`);

    const financeContracts = await request('/contract', {
      headers: { Authorization: `Bearer ${tokens.finance_admin}` },
    });
    record('finance_admin:contracts', financeContracts.status === 200, `status=${financeContracts.status}`);

    const financeSettings = await request('/admin/system-settings', {
      headers: { Authorization: `Bearer ${tokens.finance_admin}` },
    });
    record('finance_admin:system-settings-denied', financeSettings.status === 403, `status=${financeSettings.status}`);

    const customer = createdUsers.customer;
    const superViewAs = await request('/customer/bookings', {
      headers: {
        Authorization: `Bearer ${tokens.super_admin}`,
        'X-View-As-User': customer.id,
      },
    });
    record('super_admin:view-as-customer', superViewAs.status === 200, `status=${superViewAs.status}`);

    const opsViewAs = await request('/customer/bookings', {
      headers: {
        Authorization: `Bearer ${tokens.operations_admin}`,
        'X-View-As-User': customer.id,
      },
    });
    record('operations_admin:view-as-denied', opsViewAs.status === 403, `status=${opsViewAs.status}`);

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
