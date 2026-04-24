// Test setup - runs before all tests

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

global.prisma = prisma;

// Increase timeout for database operations
jest.setTimeout(30000);

// Setup test database
beforeAll(async () => {
  try {
    await prisma.$connect();
    console.log('Test database synced via Prisma');
  } catch (err) {
    console.error('Database sync failed:', err);
    throw err;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    await prisma.$disconnect();
    console.log('Test database connection closed');
  } catch (err) {
    console.error('Database close failed:', err);
  }
});

// Global test utilities
global.testUtils = {
  // Generate random email
  randomEmail: (prefix = 'test') => `${prefix}_${Date.now()}@test.com`,
  
  // Generate random phone
  randomPhone: () => `+2547${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
  
  // Wait helper
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};
