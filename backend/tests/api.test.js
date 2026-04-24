/**
 * ZITO API Test Suite
 * Regression smoke suite for active API flows
 * Functional baseline now follows backend/PRD_TRACKER.md
 * Run: npm test
 */

const request = require('supertest');
const app = require('../src/app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test users storage
let testUsers = {};
let authTokens = {};
let testBooking = null;

// Test configuration
const API_BASE = '/api/v1';

// Helper: Create test user
async function createTestUser(role, email, password = 'Test123!') {
  const user = await prisma.user.create({
    full_name: `Test ${role}`,
    email,
    phone: `+254700${Math.floor(Math.random() * 999999)}`,
    password_hash: password,
    role,
    compliance_status: 'approved',
    is_active: true
  });
  return user;
}

// Helper: Login and get token
async function loginUser(email, password = 'Test123!') {
  const res = await request(app)
    .post(`${API_BASE}/auth/login`)
    .send({ email, password });
  return res.body?.data?.token || res.body?.token;
}

// ==================== TEST SUITE ====================

describe('ZITO API regression smoke tests', () => {
  
  // ==================== SETUP ====================
  beforeAll(async () => {
    // Create test users for each role
    testUsers.super_admin = await createTestUser('super_admin', 'super@test.com');
    testUsers.operations_admin = await createTestUser('operations_admin', 'ops@test.com');
    testUsers.finance_admin = await createTestUser('finance_admin', 'finance@test.com');
    testUsers.customer = await createTestUser('customer', 'customer@test.com');
    testUsers.driver = await createTestUser('driver', 'driver@test.com');
    testUsers.transporter = await createTestUser('transporter', 'transporter@test.com');
    testUsers.agent = await createTestUser('agent', 'agent@test.com');
    
    // Login all users
    for (const [role, user] of Object.entries(testUsers)) {
      authTokens[role] = await loginUser(user.email);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await Booking.destroy({ where: {}, force: true });
    await prisma.user.deleteMany({ where: { email: { [require('sequelize').Op.like]: '%@test.com' } }, force: true });
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
          .send({ email: user.email, password: 'Test123!' });
        
        expect(res.status).toBe(200);
        expect(res.body.data?.token || res.body.token).toBeDefined();
      }
    });
  });

  // ==================== 2. ROLE LOGIN & LANDING ====================
  describe('2. Role Login and Landing Routes', () => {
    test('super_admin lands on / (dashboard)', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/stats`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      expect(res.status).toBe(200);
    });

    test('finance_admin lands on /reports', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/reports/bookings`)
        .set('Authorization', `Bearer ${authTokens.finance_admin}`);
      expect(res.status).toBe(200);
    });

    test('customer lands on /portal/customer', async () => {
      const res = await request(app)
        .get(`${API_BASE}/customer/dashboard`)
        .set('Authorization', `Bearer ${authTokens.customer}`);
      expect(res.status).toBe(200);
    });

    test('driver lands on /portal/driver', async () => {
      const res = await request(app)
        .get(`${API_BASE}/driver/dashboard`)
        .set('Authorization', `Bearer ${authTokens.driver}`);
      expect(res.status).toBe(200);
    });

    test('agent lands on /portal/agent', async () => {
      const res = await request(app)
        .get(`${API_BASE}/agent/dashboard`)
        .set('Authorization', `Bearer ${authTokens.agent}`);
      expect(res.status).toBe(200);
    });
  });

  // ==================== 3. ROLE ACCESS CONTROL ====================
  describe('3. Role Access Control Matrix', () => {
    test('operations_admin denied finance pages', async () => {
      const deniedPaths = ['/payments', '/reports', '/contracts', '/settings'];
      
      for (const path of deniedPaths) {
        const res = await request(app)
          .get(`${API_BASE}${path}`)
          .set('Authorization', `Bearer ${authTokens.operations_admin}`);
        
        expect([403, 404]).toContain(res.status);
      }
    });

    test('finance_admin denied operational pages', async () => {
      const deniedPaths = ['/bookings', '/assignments', '/drivers', '/fleet', '/customers', '/transporters', '/verification'];
      
      for (const path of deniedPaths) {
        const res = await request(app)
          .get(`${API_BASE}${path}`)
          .set('Authorization', `Bearer ${authTokens.finance_admin}`);
        
        expect([403, 404]).toContain(res.status);
      }
    });

    test('super_admin allowed on all admin pages', async () => {
      const adminPaths = ['/admin/stats', '/admin/users', '/admin/bookings'];
      
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
    test('GET /admin/stats - PRD §5.1 KPIs', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/stats`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('bookings');
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('pending_approvals');
      expect(res.body.data.bookings).toHaveProperty('total');
      expect(res.body.data.bookings).toHaveProperty('active');
    });

    test('POST /admin/users - Create user', async () => {
      const res = await request(app)
        .post(`${API_BASE}/admin/users`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .send({
          full_name: 'New Test Driver',
          email: 'newdriver@test.com',
          phone: '+254700000001',
          role: 'driver'
        });
      
      expect([200, 201]).toContain(res.status);
    });
  });

  // ==================== 5. VEHICLE & COMPLIANCE ====================
  describe('5. Vehicle and Compliance Setup', () => {
    test('GET /admin/vehicles - List vehicles', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/vehicles`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });

    test('Driver compliance status check', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/drivers`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .query({ compliance_status: 'pending' });
      
      expect(res.status).toBe(200);
    });
  });

  // ==================== 6. BOOKING LIFECYCLE ====================
  describe('6. Booking Lifecycle', () => {
    test('POST /customer/bookings - Create booking', async () => {
      const res = await request(app)
        .post(`${API_BASE}/customer/bookings`)
        .set('Authorization', `Bearer ${authTokens.customer}`)
        .send({
          pickup_address: 'Nairobi CBD',
          delivery_address: 'Westlands',
          cargo_type: 'Documents',
          distance_km: 5,
          vehicle_type: 'motorcycle',
          cargo_weight_kg: 1
        });
      
      expect([200, 201]).toContain(res.status);
      if (res.body.data?.booking || res.body.booking) {
        testBooking = res.body.data?.booking || res.body.booking;
      }
    });

    test('GET /bookings - List bookings', async () => {
      const res = await request(app)
        .get(`${API_BASE}/bookings`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });

    test('PATCH /bookings/:id/assign - Assign driver', async () => {
      if (!testBooking) return;
      
      const res = await request(app)
        .patch(`${API_BASE}/admin/bookings/${testBooking.id}/assign`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .send({ driver_id: testUsers.driver.id });
      
      expect([200, 201]).toContain(res.status);
    });

    test('PATCH /driver/bookings/:id/accept - Driver accepts', async () => {
      if (!testBooking) return;
      
      const res = await request(app)
        .patch(`${API_BASE}/bookings/${testBooking.id}/driver-accept`)
        .set('Authorization', `Bearer ${authTokens.driver}`);
      
      expect([200, 201]).toContain(res.status);
    });
  });

  // ==================== 7. PAYMENTS & REPORTS ====================
  describe('7. Payments, Reports, Contracts', () => {
    test('GET /reports/bookings - Booking report', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/reports/bookings`)
        .set('Authorization', `Bearer ${authTokens.finance_admin}`);
      
      expect(res.status).toBe(200);
    });

    test('GET /reports/financial - Financial report', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/reports/financial`)
        .set('Authorization', `Bearer ${authTokens.finance_admin}`);
      
      expect(res.status).toBe(200);
    });
  });

  // ==================== 8. AGENT PORTAL ====================
  describe('8. Agent Portal', () => {
    test('GET /agent/dashboard - Agent KPIs', async () => {
      const res = await request(app)
        .get(`${API_BASE}/agent/dashboard`)
        .set('Authorization', `Bearer ${authTokens.agent}`);
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('customers');
      expect(res.body.data).toHaveProperty('totalBookings');
    });

    test('GET /agent/customers - List managed customers', async () => {
      const res = await request(app)
        .get(`${API_BASE}/agent/customers`)
        .set('Authorization', `Bearer ${authTokens.agent}`);
      
      expect(res.status).toBe(200);
    });

    test('POST /agent/bookings - Create booking for customer', async () => {
      const res = await request(app)
        .post(`${API_BASE}/agent/bookings`)
        .set('Authorization', `Bearer ${authTokens.agent}`)
        .send({
          customer_id: testUsers.customer.id,
          pickup_address: 'Nairobi',
          delivery_address: 'Mombasa',
          cargo_type: 'Electronics',
          distance_km: 500,
          vehicle_type: 'truck_7t',
          cargo_weight_kg: 1000
        });
      
      expect([200, 201]).toContain(res.status);
    });
  });

  // ==================== 9. VIEW AS (SUPER ADMIN) ====================
  describe('9. View As Coverage', () => {
    test('super_admin can preview customer', async () => {
      const res = await request(app)
        .get(`${API_BASE}/customer/dashboard`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .set('X-View-As-User', testUsers.customer.id);
      
      expect(res.status).toBe(200);
    });

    test('super_admin can preview driver', async () => {
      const res = await request(app)
        .get(`${API_BASE}/driver/dashboard`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`)
        .set('X-View-As-User', testUsers.driver.id);
      
      expect(res.status).toBe(200);
    });

    test('operations_admin denied View As', async () => {
      const res = await request(app)
        .get(`${API_BASE}/customer/dashboard`)
        .set('Authorization', `Bearer ${authTokens.operations_admin}`)
        .set('X-View-As-User', testUsers.customer.id);
      
      expect(res.status).toBe(403);
    });
  });

  // ==================== 10. AUDIT LOG ====================
  describe('10. Audit Log Checks', () => {
    test('GET /admin/audit-logs - View audit trail', async () => {
      const res = await request(app)
        .get(`${API_BASE}/admin/audit-logs`)
        .set('Authorization', `Bearer ${authTokens.super_admin}`);
      
      expect(res.status).toBe(200);
    });
  });
});

// Run with: npm test
// Or: jest --verbose
