/**
 * LEGACY SEQUELIZE CONFIG (DEPRECATED)
 * Zito Platform has migrated to Prisma.
 * This file is kept to prevent import errors during the transition but does not initiate a connection.
 */
module.exports = { 
  sequelize: null, 
  connectDB: async () => console.log('Sequelize is disabled. Using Prisma.'), 
  testConnection: async () => true 
};
