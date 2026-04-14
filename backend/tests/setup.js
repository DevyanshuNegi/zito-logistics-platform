// Test setup - runs before all tests
const { sequelize } = require('../src/models');

// Increase timeout for database operations
jest.setTimeout(30000);

// Setup test database
beforeAll(async () => {
  try {
    // Sync database (use force in test mode)
    await sequelize.sync({ force: true });
    console.log('Test database synced');
  } catch (err) {
    console.error('Database sync failed:', err);
    throw err;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    await sequelize.close();
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
