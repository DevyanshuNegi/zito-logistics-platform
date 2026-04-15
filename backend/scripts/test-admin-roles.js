require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// NOTE: This script uses pure API calls — no direct DB access.
// OTP is retrieved via the /auth/otp-test-peek endpoint (dev only).
// In production, OTP would be delivered via SMS/email.

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000/api/v1';

const TEST_USERS = [
  {
    key: 'super_admin',
    full_name: 'Vishal Admin',
    email: process.env.TEST_SUPERADMIN_EMAIL || 'superadmin@zito.co.ke',
    phone: process.env.TEST_SUPERADMIN_PHONE || '0712000001',
    password: process.env.TEST_SUPERADMIN_PASSWORD || 'TestAdmin@1234',
    role: 'super_admin',
  },
  {
    key: 'operations_admin',
    full_name: 'Ops Admin',
    email: process.env.TEST_OPS_EMAIL || 'ops@zito.co.ke',
    phone: process.env.TEST_OPS_PHONE || '0712000002',
    password: process.env.TEST_OPS_PASSWORD || 'TestOps@1234',
    role: 'operations_admin',
  },
  {
    key: 'finance_admin',
    full_name: 'Finance Admin',
    email: process.env.TEST_FINANCE_EMAIL || 'finance@zito.co.ke',
    phone: process.env.TEST_FINANCE_PHONE || '0712000003',
    password: process.env.TEST_FINANCE_PASSWORD || 'TestFinance@1234',
    role: 'finance_admin',
  },
  {
    key: 'customer',
    full_name: 'John Kamau',
    email: process.env.TEST_CUSTOMER_EMAIL || 'john@customer.co.ke',
    phone: process.env.TEST_CUSTOMER_PHONE || '0712111001',
    password: process.env.TEST_CUSTOMER_PASSWORD || 'TestCustomer@1234',
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
  const response = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(user),
  });

  // 201 = created, 409 = already exists — both acceptable
  if (response.status !== 201 && response.status !== 409) {
    throw new Error(`Registration failed for ${user.role}: ${JSON.stringify(response.body)}`);
  }

  const userId = response.body?.data?.user?.id || response.body?.data?.id || null;
  return { email: user.email, role: user.role, id: userId };
};

const loginAndVerify = async (user) => {
  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (loginResponse.status !== 200) {
    throw new Error(`Login failed for ${user.role}: ${JSON.stringify(loginResponse.body)}`);
  }

  // Dev-only: peek at OTP via test endpoint (not available in production)
  // In production, OTP is delivered via SMS/email — this script would need manual input
  const otpPeek = await request(`/auth/otp-test-peek?contact=${encodeURIComponent(user.email)}&type=login`);

  if (otpPeek.status !== 200 || !otpPeek.body?.data?.otp) {
    throw new Error(`OTP peek failed for ${user.email}: ${JSON.stringify(otpPeek.body)}`);
  }

  const verifyResponse = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      contact: user.email,
      otp: otpPeek.body.data.otp,
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

const getUserIdFromToken = async (token) => {
  const meResponse = await request('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (meResponse.status !== 200) return null;
  return meResponse.body?.data?.id || meResponse.body?.data?.user?.id || null;
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

    // Login customer to get their user ID for View-As (PRD expects UUID)
    const customerToken = await loginAndVerify(TEST_USERS[3]);
    const customerId = await getUserIdFromToken(customerToken);
    if (!customerId) {
      throw new Error('Could not resolve customer user ID for View-As test');
    }

    const superViewAs = await request('/customer/bookings', {
      headers: {
        Authorization: `Bearer ${tokens.super_admin}`,
        'X-View-As-User': customerId,
      },
    });
    record('super_admin:view-as-customer', superViewAs.status === 200, `status=${superViewAs.status}`);

    const opsViewAs = await request('/customer/bookings', {
      headers: {
        Authorization: `Bearer ${tokens.operations_admin}`,
        'X-View-As-User': customerId,
      },
    });
    record('operations_admin:view-as-denied', opsViewAs.status === 403, `status=${opsViewAs.status}`);

    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    // No DB connection to close — pure API testing
  }
};

run();
