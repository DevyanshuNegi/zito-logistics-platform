/**
 * Dispatch driver-facing E2E regression tests.
 *
 * Run with a backend already listening on ZITO_TEST_API_ORIGIN:
 * ZITO_ENABLE_DB_REGRESSION=1 npm test -- dispatch.e2e.test.js
 */

const jwt = require('jsonwebtoken');
const request = require('supertest');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const app = process.env.ZITO_TEST_API_ORIGIN || 'http://127.0.0.1:5000';
const prisma = new PrismaClient();
const runDbRegression = process.env.ZITO_ENABLE_DB_REGRESSION === '1';
const describeDbRegression = runDbRegression ? describe : describe.skip;

const API_BASE = '/api/v1';
const TEST_RUN_ID = `dispatch-e2e-${Date.now()}`;

function uniquePhone(index) {
  return `+25479${String(Date.now()).slice(-6)}${index}`;
}

async function createSessionToken(user) {
  const sessionId = randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);

  await prisma.idempotencyRecord.upsert({
    where: { key: `session:${sessionId}` },
    create: {
      key: `session:${sessionId}`,
      status: 'ACTIVE',
      requestHash: user.id,
      response: {
        sessionId,
        userId: user.id,
        createdAtMs: issuedAt * 1000,
        lastActivityAtMs: issuedAt * 1000,
        ipAddress: null,
        deviceInfo: null,
        invalidatedAtMs: null,
        invalidationReason: null,
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    update: {
      status: 'ACTIVE',
      requestHash: user.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      iat: issuedAt,
    },
    process.env.JWT_SECRET || 'zito-secure-secret-key',
    { expiresIn: '30m' },
  );
}

async function createUser(role, index) {
  return prisma.user.create({
    data: {
      fullName: `Dispatch E2E ${role} ${index}`,
      email: `${TEST_RUN_ID}-${role.toLowerCase()}-${index}@test.local`,
      phone: uniquePhone(index),
      role,
      status: 'ACTIVE',
    },
  });
}

async function createDriver(index) {
  const user = await createUser('DRIVER', index);
  const driver = await prisma.driver.create({
    data: {
      userId: user.id,
      isOnline: true,
      isAvailable: true,
      rating: 4.8,
      currentLatitude: -1.286389,
      currentLongitude: 36.817223,
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: `E2E${String(Date.now()).slice(-5)}${index}`,
      type: 'VAN',
      status: 'ACTIVE',
      capacityKg: 1200,
      driverId: driver.id,
      ownerUserId: user.id,
    },
  });

  return { user, driver, vehicle, token: await createSessionToken(user) };
}

async function createBooking(customerUser, driver, vehicle, index) {
  return prisma.booking.create({
    data: {
      reference: `${TEST_RUN_ID}-${index}`,
      customerId: customerUser.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'ASSIGNED',
      serviceType: 'COURIER',
      capacitySource: 'OWNED_FLEET',
      requiredVehicleType: vehicle.type,
      assignedAt: new Date(),
      cargoType: 'Documents',
      cargoWeightKg: 5,
      estimatedDistKm: 8,
    },
  });
}

async function createOfferedAssignment({ customerUser, driver, vehicle }, index) {
  const booking = await createBooking(customerUser, driver, vehicle, index);
  const assignment = await prisma.driverAssignment.create({
    data: {
      bookingId: booking.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: 'OFFERED',
      matchScore: 91,
      priorityScore: 100,
      distanceKm: 3.2,
      estimatedArrivalMinutes: 7,
    },
  });

  return { booking, assignment };
}

describeDbRegression('Driver dispatch E2E endpoints', () => {
  let customerUser;
  let primaryDriver;
  let otherDriver;
  let customerToken;
  let fixturesReady = false;

  beforeAll(async () => {
    await prisma.$connect();
    customerUser = await createUser('CUSTOMER', 1);
    customerToken = await createSessionToken(customerUser);
    primaryDriver = await createDriver(2);
    otherDriver = await createDriver(3);
    fixturesReady = true;
  });

  afterAll(async () => {
    if (!fixturesReady) {
      await prisma.$disconnect().catch(() => undefined);
      return;
    }

    await prisma.driverAssignment.deleteMany({
      where: { booking: { reference: { startsWith: TEST_RUN_ID } } },
    });
    await prisma.booking.deleteMany({ where: { reference: { startsWith: TEST_RUN_ID } } });
    await prisma.vehicle.deleteMany({ where: { plateNumber: { startsWith: 'E2E' } } });
    await prisma.driver.deleteMany({
      where: { user: { email: { contains: TEST_RUN_ID } } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { requestHash: { in: [customerUser.id, primaryDriver.user.id, otherDriver.user.id] } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: TEST_RUN_ID } } });
    await prisma.$disconnect();
  });

  test('POST /drivers/dispatch/assignments/:assignmentId/accept accepts an offered assignment', async () => {
    const { booking, assignment } = await createOfferedAssignment(
      {
        customerUser,
        driver: primaryDriver.driver,
        vehicle: primaryDriver.vehicle,
      },
      'accept',
    );

    const res = await request(app)
      .post(`${API_BASE}/drivers/dispatch/assignments/${assignment.id}/accept`)
      .set('Authorization', `Bearer ${primaryDriver.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.acceptedAt).toBeTruthy();

    const persisted = await prisma.driverAssignment.findUnique({
      where: { id: assignment.id },
    });
    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });

    expect(persisted.status).toBe('ACCEPTED');
    expect(persisted.acceptedAt).toBeTruthy();
    expect(updatedBooking.status).toBe('ACCEPTED');
    expect(updatedBooking.acceptedAt).toBeTruthy();
  });

  test('POST /drivers/dispatch/assignments/:assignmentId/reject rejects an offered assignment with a reason', async () => {
    const { assignment } = await createOfferedAssignment(
      {
        customerUser,
        driver: primaryDriver.driver,
        vehicle: primaryDriver.vehicle,
      },
      'reject',
    );

    const res = await request(app)
      .post(`${API_BASE}/drivers/dispatch/assignments/${assignment.id}/reject`)
      .set('Authorization', `Bearer ${primaryDriver.token}`)
      .send({ reason: 'Too far from pickup' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.rejectionReason).toBe('Too far from pickup');

    const persisted = await prisma.driverAssignment.findUnique({
      where: { id: assignment.id },
    });

    expect(persisted.status).toBe('REJECTED');
    expect(persisted.rejectedAt).toBeTruthy();
    expect(persisted.rejectionReason).toBe('Too far from pickup');
  });

  test('rejects assignment actions from a different driver', async () => {
    const { assignment } = await createOfferedAssignment(
      {
        customerUser,
        driver: primaryDriver.driver,
        vehicle: primaryDriver.vehicle,
      },
      'wrong-driver',
    );

    const res = await request(app)
      .post(`${API_BASE}/drivers/dispatch/assignments/${assignment.id}/accept`)
      .set('Authorization', `Bearer ${otherDriver.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('denies non-driver users', async () => {
    const { assignment } = await createOfferedAssignment(
      {
        customerUser,
        driver: primaryDriver.driver,
        vehicle: primaryDriver.vehicle,
      },
      'non-driver',
    );

    const res = await request(app)
      .post(`${API_BASE}/drivers/dispatch/assignments/${assignment.id}/accept`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(res.status).toBe(403);
  });
});
