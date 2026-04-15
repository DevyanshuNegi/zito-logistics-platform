// src/config/database.js
//
// PRD References:
//   §9    — Technology Stack (PostgreSQL 16, Sequelize v6, Railway.app)
//   §11   — Security (DB access restricted to app server IP in production)
//   §25.9 — Soft delete (Sequelize paranoid mode enabled globally)
//   §25.10 — Performance & Scalability (connection pooling, indexing)

require('dotenv').config();
const { Sequelize } = require('sequelize');
const pg = require('pg'); // dialect module for debugging

/* -------------------------------------------------------------------------- */
/* ENVIRONMENT FLAGS                                                           */
/* -------------------------------------------------------------------------- */

const isProd = process.env.NODE_ENV === 'production';
const isDev  = process.env.NODE_ENV === 'development';

/* -------------------------------------------------------------------------- */
/* LOGGING                                                                    */
/* PRD §25.10 — dev logs all queries; production logs only slow queries      */
/* -------------------------------------------------------------------------- */

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_MS || '500', 10);

const queryLogger = (sql, timing) => {
  if (isProd) {
    // Production: only log slow queries (performance monitoring)
    if (timing && timing > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`⚠️  SLOW QUERY (${timing}ms): ${sql}`);
    }
  } else {
    // Development: log all queries for debugging
    console.log(`[SQL] ${sql}${timing ? ` (${timing}ms)` : ''}`);
  }
};

/* -------------------------------------------------------------------------- */
/* CONNECTION POOL CONFIG                                                     */
/* PRD §25.10 — system designed for scalability                              */
/*                                                                            */
/* Pool sizing guide:                                                         */
/*   max: how many concurrent DB connections the app can open                */
/*   min: connections kept alive when idle                                   */
/*   acquire: ms to wait for a connection before throwing                    */
/*   idle: ms a connection can sit unused before being released              */
/*                                                                            */
/* Railway free tier: keep max low (5) to stay within connection limits      */
/* Railway Pro / production: increase max to 20-50 based on DB plan          */
/* -------------------------------------------------------------------------- */

const poolConfig = {
  max:     parseInt(process.env.DB_POOL_MAX     || (isProd ? '10' : '5'),   10),
  min:     parseInt(process.env.DB_POOL_MIN     || '1',                      10),
  acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000',                  10), // 30s
  idle:    parseInt(process.env.DB_POOL_IDLE    || '10000',                  10), // 10s
};

/* -------------------------------------------------------------------------- */
/* SEQUELIZE INSTANCE                                                         */
/*                                                                            */
/* Two modes:                                                                 */
/*   DATABASE_URL — Railway / production (includes SSL)                      */
/*   Individual vars — local development                                     */
/* -------------------------------------------------------------------------- */

let sequelize;

if (process.env.DATABASE_URL) {
  // ── Production / Railway ──────────────────────────────────────────────────
  // PRD §9 — Hosting on Railway.app with SSL termination
  // PRD §11 — DB access restricted to app server; SSL required
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: pg, // specify dialect module
    logging:         queryLogger, // always use logger
    benchmark:       true,   // enables timing arg in queryLogger
    pool:            poolConfig,
    dialectOptions: {
      ssl: {
        require:            true,
        rejectUnauthorized: process.env.DB_SSL_REJECT !== 'false', // Railway uses self-signed certs
      },
      // PRD §25.10 — statement timeout prevents runaway queries
      statement_timeout:       parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      idle_in_transaction_session_timeout: 60000,
    },
    timezone: '+00:00',     // UTC for consistency across environments
    define: {
      // PRD §25.9 — Soft delete: paranoid mode adds deletedAt to all models
      // Records are never permanently deleted — is_deleted + deleted_at pattern
      paranoid:    true,
      underscored: true,      // snake_case column names (matches DB schema)
      timestamps:  true,      // createdAt, updatedAt on all models
      freezeTableName: true,  // Prevent Sequelize from pluralizing table names
    },
  });

} else {
  // ── Local Development ─────────────────────────────────────────────────────
  sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
    {
      host:    process.env.DB_HOST || 'localhost',
      port:    parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      dialectModule: pg, // specify dialect module
      logging:   queryLogger,
      benchmark: true,
      pool:      poolConfig,
      dialectOptions: {
        ssl: isProd ? {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT !== 'false',
        } : false,
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
      },
      define: {
        paranoid:    true,   // PRD §25.9 — soft delete globally
        underscored: true,
        timestamps:  true,
        freezeTableName: true,  // Prevent Sequelize from pluralizing table names
      },
    }
  );
}

/* -------------------------------------------------------------------------- */
/* CONNECT WITH RETRY                                                         */
/* Railway cold starts and container restarts can cause brief DB              */
/* unavailability. Retry up to MAX_RETRIES before giving up.                 */
/* -------------------------------------------------------------------------- */

const MAX_RETRIES  = parseInt(process.env.DB_CONNECT_RETRIES || '5',    10);
const RETRY_DELAY  = parseInt(process.env.DB_CONNECT_DELAY   || '3000', 10); // 3s

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async () => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sequelize.authenticate();

      console.log(`✅ PostgreSQL connected`);
      console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Pool        : min=${poolConfig.min} max=${poolConfig.max}`);
      console.log(`   Slow query  : >${SLOW_QUERY_THRESHOLD_MS}ms logged`);
      if (!isProd) {
        const dbName = process.env.DATABASE_URL
          ? process.env.DATABASE_URL.split('/').pop().split('?')[0]
          : (process.env.DB_NAME || 'zito_db');
        console.log(`   Database    : ${dbName}`);
      }

      return; // success — exit

    } catch (err) {
      lastError = err;
      (isProd ? console.error : console.warn)(`❌ DB connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        console.log(`   Retrying in ${RETRY_DELAY / 1000}s...`);
        await sleep(RETRY_DELAY);
      }
    }
  }

  // All retries exhausted — crash the process so Railway restarts the container
  console.error('❌ Could not connect to PostgreSQL after all retries. Exiting.');
  throw lastError;
};

/* -------------------------------------------------------------------------- */
/* TEST CONNECTION UTILITY                                                    */
/* Used by /health endpoint in app.js to report DB status without crashing  */
/* -------------------------------------------------------------------------- */

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/* EXPORTS                                                                    */
/* -------------------------------------------------------------------------- */

module.exports = { sequelize, connectDB, testConnection };