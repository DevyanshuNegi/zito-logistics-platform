// src/models/index.js
// Loads all models, runs associations, exports sequelize instance
// PRD §8 — Database Schema Overview
// PRD §25.9 — Soft delete (paranoid) configured globally in database.js

const { sequelize } = require('../config/database');

// ── Import all models ──────────────────────────────────────────────────
const User             = require('./user')(sequelize);
const Driver           = require('./driver')(sequelize);
const Vehicle          = require('./vehicle')(sequelize);
const Booking          = require('./booking')(sequelize);
const BookingOffer     = require('./bookingoffer')(sequelize);
const TripCharge       = require('./trip-charge')(sequelize);
const Payment          = require('./payment')(sequelize);
const Complaint        = require('./complaint')(sequelize);
const Contract         = require('./contract')(sequelize);
const ContractRate     = require('./contract-rate')(sequelize);
const SystemSetting    = require('./system-setting')(sequelize);
const AuditLog         = require('./auditLog')(sequelize);
const DriverCompliance = require('./drivercompliance')(sequelize);
const CustomerDriverRule = require('./customer-driver-rule')(sequelize);
const LoginOtp = require('./login-otp')(sequelize);

// ── Collect all models ─────────────────────────────────────────────────
const models = {
  User,
  Driver,
  Vehicle,
  Booking,
  BookingOffer,
  TripCharge,
  Payment,
  Complaint,
  Contract,
  ContractRate,
  SystemSetting,
  AuditLog,
  DriverCompliance,
  CustomerDriverRule,
  LoginOtp,
};

// ── Run associations ───────────────────────────────────────────────────
// Each model defines its own associate() method
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

// ── Exports ────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  ...models,
};
