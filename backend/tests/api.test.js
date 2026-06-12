/**
 * ZITO API Test Suite
 * Regression smoke suite for active API flows, updated to match current NestJS routes and models.
 * Run: ZITO_ENABLE_DB_REGRESSION=1 npm run test
 */

jest.setTimeout(60000);

const request = require('supertest');
const app = process.env.ZITO_TEST_API_ORIGIN || 'http://127.0.0.1:5000';
const { PrismaClient, UserRole, AccountStatus } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const runDbRegression = process.env.ZITO_ENABLE_DB_REGRESSION === '1';
const describeDbRegression = runDbRegression ? describe : describe.skip;

// Test users storage
let testUsers = {};
let authTokens = {};
let testBooking = null;

// Test configuration
const API_BASE = '/api/v1';

// Helper: Create test user with relations for drivers
async function createTestUser(role, email, password = 'Test123!') {
  const hashedPassword = await bcrypt.hash(password, 10);

  let prismaRole = UserRole.CUSTOMER;
  if (role === 'super_admin') prismaRole = UserRole.SUPER_ADMIN;
  else if (role === 'operations_admin' || role === 'finance_admin' || role === 'admin') prismaRole = UserRole.ADMIN;
  else if (role === 'driver') prismaRole = UserRole.DRIVER;
  else if (role === 'transporter') prismaRole = UserRole.TRANSPORTER;
  else if (role === 'agent') prismaRole = UserRole.AGENT;

  const user = await prisma.user.create({
    data: {
      fullName: `Test ${role}`,
      email,
      phone: `+254700${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      password: hashedPassword,
      role: prismaRole,
      status: AccountStatus.ACTIVE
    }
  });

  if (prismaRole === UserRole.DRIVER) {
    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        isOnline: true,
        isAvailable: true,
        rating: 4.8,
        currentLatitude: -1.286389,
        currentLongitude: 36.817223,
      }
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: `TST${String(Date.now()).slice(-5)}`,
        type: 'VAN',
        status: 'ACTIVE',
        verificationStatus: 'APPROVED',
        capacityKg: 1200,
        driverId: driver.id,
        ownerUserId: user.id,
      }
    });

    user.driverId = driver.id;
    user.vehicleId = vehicle.id;
  }

  return user;
}

// Helper: Login and get token (supports unified 3-step auth flow)
async function loginUser(email, password = 'Test123!') {
  // Step 1: POST /auth/login
  const loginRes = await request(app)
    .post(`${API_BASE}/auth/login`)
    .send({ email });
  
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    throw new Error(`Login step 1 failed: ${JSON.stringify(loginRes.body)}`);
  }

  const tempToken1 = loginRes.body.data.temp_token;
  const otp = loginRes.body.data.debugOtp || '123456';

  // Step 2: POST /auth/verify-otp
  const verifyRes = await request(app)
    .post(`${API_BASE}/auth/verify-otp`)
    .set('Authorization', `Bearer ${tempToken1}`)
    .send({ otp });

  if (verifyRes.status !== 200 && verifyRes.status !== 201) {
    throw new Error(`Login step 2 failed: ${JSON.stringify(verifyRes.body)}`);
  }

  // If requires password
  if (verifyRes.body.data?.requiresPassword) {
    const tempToken2 = verifyRes.body.data.temp_token;
    // Step 3: POST /auth/complete-email-login
    const completeRes = await request(app)
      .post(`${API_BASE}/auth/complete-email-login`)
      .set('Authorization', `Bearer ${tempToken2}`)
      .send({ password });

    if (completeRes.status !== 200 && completeRes.status !== 201) {
      throw new Error(`Login step 3 failed: ${JSON.stringify(completeRes.body)}`);
    }

    return completeRes.body.data.token;
  }

  return verifyRes.body.data.token;
}

// Optimized scoped database cleaner
async function cleanupTestData() {
  const staleUsers = await prisma.user.findMany({
    where: { email: { contains: '@test.com' } },
    select: { id: true, driverProfile: { select: { id: true } } }
  });

  if (staleUsers.length === 0) return;

  const userIds = staleUsers.map(u => u.id);
  const driverIds = staleUsers.map(u => u.driverProfile?.id).filter(Boolean);

  try {
    // Delete assignments for our drivers or bookings
    await prisma.driverAssignment.deleteMany({
      where: {
        OR: [
          { driverId: { in: driverIds } },
          { booking: { customerId: { in: userIds } } }
        ]
      }
    });

    // Delete booking stops
    await prisma.bookingStop.deleteMany({
      where: {
        booking: { customerId: { in: userIds } }
      }
    });

    // Delete bookings
    await prisma.booking.deleteMany({
      where: {
        customerId: { in: userIds }
      }
    });

    // Delete shifts
    if (driverIds.length > 0) {
      await prisma.driverShift.deleteMany({
        where: { driverId: { in: driverIds } }
      });
    }

    // Delete vehicles
    await prisma.vehicle.deleteMany({
      where: { ownerUserId: { in: userIds } }
    });

    // Delete drivers
    await prisma.driver.deleteMany({
      where: { userId: { in: userIds } }
    });

    // Delete audit logs
    await prisma.auditLog.deleteMany({
      where: { userId: { in: userIds } }
    });

    // Delete users
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });

    // Delete rate cards we might have left
    await prisma.rateCard.deleteMany({});
  } catch (err) {
    console.warn('[Cleanup] Error during optimized cleanup:', err.message);
  }
}

describe('Health Smoke Test', () => {
  test('GET /health - API is running and reports service status', async () => {
    const res = await request(app).get(`${API_BASE}/health`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });
});

describeDbRegression('ZITO API regression smoke tests', () => {
  
  // ==================== SETUP ====================
  beforeAll(async () => {
    // Run cleanup to prevent conflicts
    await cleanupTestData();

    // Seed active RateCard for COURIER / VAN
    await prisma.rateCard.create({
      data: {
        vehicleType: 'VAN',
        serviceType: 'COURIER',
        countryCode: 'KE',
        localityType: 'ANY',
        baseFare: 100.0,
        ratePerKm: 10.0,
        perStopRate: 5.0,
        minDistance: 0.0,
        surgeMultiplier: 1.0,
        isActive: true
      }
    });

    // Create test users for each role
    testUsers.super_admin = await createTestUser('super_admin', 'super@test.com');
    testUsers.operations_admin = await createTestUser('operations_admin', 'ops@test.com');
    testUsers.finance_admin = await createTestUser('finance_admin', 'finance@test.com');
    testUsers.customer = await createTestUser('customer', 'customer@test.com');
    testUsers.driver = await createTestUser('driver', 'driver@test.com');
    testUsers.transporter = await createTestUser('transporter', 'transporter@test.com');
    testUsers.agent = await createTestUser('agent', 'agent@test.com');

    // Wipe shift history for our driver specifically to bypass rest limits/active shift conflicts
    if (testUsers.driver.driverId) {
      await prisma.driverShift.deleteMany({ where: { driverId: testUsers.driver.driverId } });
    }
    
    // Login all users
    for (const [role, user] of Object.entries(testUsers)) {
      authTokens[role] = await loginUser(user.email);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // ==================== 1. HEALTH & AUTH ====================
  describe('1. Health and Auth', () => {
    test('GET /health - API is running', async () => {
      const res = await request(app).get(`${API_BASE}/health`);
      expect(res.status).toBe(200);
    });

    test('POST /auth/login - All roles can login', async () => {
      for (const [role, user] of Object.entries(testUsers)) {
        const res = await request(app)
          .post(`${API_BASE}/auth/login`)
          .send({ email: user.email });
        
        expect([200, 201]).toContain(res.status);
        expect(res.body.data?.temp_token).toBeDefined();
      }
    });
  });

  // ==================== 2. ROLE LOGIN & LANDING ====================
  describe('2. Role Login and Landing Routes', () => {
    test('super_admin lands on dashboard / stats', async () => {
      const res = await request(app)
        .get(`${API_BASE}/analytics/dashboard`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      expect(res.status).toBe(200);
    });

    test('finance_admin lands on reports', async () => {
      const res = await request(app)
        .get(`${API_BASE}/reconciliation/daily-report`)
        .set('Authorization', `Bearer ${authTokens.finance_admin}`);
      expect(res.status).toBe(200);
    });

    test('customer lands on customer portal', async () => {
      const res = await request(app)
        .get(`${API_BASE}/customer/bookings`)
        .set('Authorization', `Bearer ${authTokens.customer}`);
      expect(res.status).toBe(200);
    });

    test('driver starts shift (PRD §44.1)', async () => {
      // Check dashboard
      const res = await request(app)
        .get(`${API_BASE}/driver/payroll/summary`)
        .set('Authorization', `Bearer ${authTokens.driver}`);
      expect(res.status).toBe(200);

      // Start mandatory shift before online toggle
      const shiftRes = await request(app)
        .post(`${API_BASE}/drivers/shift/start`)
        .set('Authorization', `Bearer ${authTokens.driver}`)
        .send({ attendance_status: 'PRESENT' });
      
      if (shiftRes.status !== 200 && shiftRes.status !== 201) {
        console.error('[SHIFT ERROR BODY]', JSON.stringify(shiftRes.body));
      }
      
      expect([200, 201]).toContain(shiftRes.status);
      expect(shiftRes.body.data).toHaveProperty('shift_id');
    });
  });

  // ==================== 3. ROLE ACCESS CONTROL ====================
  describe('3. Role Access Control Matrix', () => {
    test('customer denied admin and finance pages', async () => {
      const deniedPaths = ['/reconciliation/dashboard', '/reconciliation/daily-report', '/contracts', '/users'];
      
      for (const path of deniedPaths) {
        const res = await request(app)
          .get(`${API_BASE}${path}`)
          .set('Authorization', `Bearer ${authTokens.customer}`);
        
        expect([403, 404]).toContain(res.status);
      }
    });

    test('driver denied admin and finance pages', async () => {
      const deniedPaths = ['/reconciliation/dashboard', '/reconciliation/daily-report', '/contracts', '/users'];
      
      for (const path of deniedPaths) {
        const res = await request(app)
          .get(`${API_BASE}${path}`)
          .set('Authorization', `Bearer ${authTokens.driver}`);
        
        expect([403, 404]).toContain(res.status);
      }
    });

    test('super_admin allowed on all admin pages', async () => {
      const adminPaths = ['/reconciliation/dashboard', '/contracts', '/users'];
      
      for (const path of adminPaths) {
        const res = await request(app)
          .get(`${API_BASE}${path}`)
          .set('Authorization', `Bearer ${authTokens.super_admin}`);
        
        expect(res.status).toBe(200);
      }
    });
  });

  // ==================== 4. CORE ADMIN OPERATIONS ====================
  describe('4. Core Admin Operations', () => {
    test('GET /analytics/dashboard - PRD §5.1 KPIs', async () => {
      const res = await request(app)
        .get(`${API_BASE}/analytics/dashboard`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('board');
    });

    test('POST /users/internal - Create user', async () => {
      const res = await request(app)
        .post(`${API_BASE}/users/internal`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .send({
          fullName: 'New Test Driver',
          email: `newdriver_${Date.now()}@test.com`,
          phone: `+254701${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
          role: 'DRIVER',
          password: 'TestPassword123!'
        });
      
      expect([200, 201]).toContain(res.status);
    });
  });

  // ==================== 5. VEHICLE & COMPLIANCE ====================
  describe('5. Vehicle and Compliance Setup', () => {
    test('GET /fleet - List vehicles', async () => {
      const res = await request(app)
        .get(`${API_BASE}/fleet`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });

    test('Driver compliance status check', async () => {
      const res = await request(app)
        .get(`${API_BASE}/drivers`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });
  });

  // ==================== 6. BOOKING LIFECYCLE ====================
  describe('6. Booking Lifecycle', () => {
    test('POST /customer/bookings - Create booking', async () => {
      const idempotencyKey = crypto.randomUUID();
      const res = await request(app)
        .post(`${API_BASE}/customer/bookings`)
        .set('Authorization', `Bearer ${authTokens.customer}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          serviceType: 'COURIER',
          vehicleType: 'VAN',
          idempotencyKey,
          stops: [
            {
              sequence: 1,
              address: 'Nairobi CBD',
              latitude: -1.286389,
              longitude: 36.817223,
              contactName: 'Sender Test',
              contactPhone: '+254700000000',
              stopType: 'PICKUP'
            },
            {
              sequence: 2,
              address: 'Westlands',
              latitude: -1.263889,
              longitude: 36.802223,
              contactName: 'Receiver Test',
              contactPhone: '+254700000001',
              stopType: 'DELIVERY'
            }
          ],
          cargoType: 'Documents',
          cargoWeightKg: 1
        });
      
      if (res.status !== 200 && res.status !== 201) {
        console.error('[BOOKING ERROR BODY]', JSON.stringify(res.body));
      }
      
      expect([200, 201]).toContain(res.status);
      if (res.body.data?.booking || res.body.booking) {
        testBooking = res.body.data?.booking || res.body.booking;
      }
    });

    test('GET /admin/bookings - List bookings', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/bookings`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });

    test('PATCH /admin/bookings/:id/assign - Assign driver', async () => {
      if (!testBooking) return;
      
      const res = await request(app)
        .patch(`${API_BASE}/admin/bookings/${testBooking.id}/assign`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .send({ 
          driverId: testUsers.driver.driverId,
          vehicleId: testUsers.driver.vehicleId
        });
      
      expect([200, 201]).toContain(res.status);
    });

    test('PATCH /driver/trips/:id/status - Driver accepts', async () => {
      if (!testBooking) return;
      
      const res = await request(app)
        .patch(`${API_BASE}/driver/trips/${testBooking.id}/status`)
        .set('Authorization', `Bearer ${authTokens.driver}`)
        .send({ status: 'ACCEPTED' });
      
      expect([200, 201]).toContain(res.status);
    });

    test('GET /driver/payroll - Driver earnings (PRD §44.2)', async () => {
      const res = await request(app)
        .get(`${API_BASE}/driver/payroll`)
        .set('Authorization', `Bearer ${authTokens.driver}`);
      
      expect(res.status).toBe(200);
    });
  });

  // ==================== 7. PAYMENTS & REPORTS ====================
  describe('7. Reconciliation / Daily Reports', () => {
    test('GET /reconciliation/daily-report - Daily reconciliation snapshot', async () => {
      const res = await request(app)
        .get(`${API_BASE}/reconciliation/daily-report`)
        .set('Authorization', `Bearer ${authTokens.finance_admin}`);
      
      expect(res.status).toBe(200);
    });
  });

  // ==================== 10. AUDIT QUEUE ====================
  describe('10. Audit Queue / Approvals Checks', () => {
    test('GET /audit/approvals - View approvals queue', async () => {
      const res = await request(app)
        .get(`${API_BASE}/audit/approvals`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });
  });
});
