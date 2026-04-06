// src/models/auditLog.js
// PRD §25.8 — Audit Log System
// Immutable — records are never modified or deleted
// Visible to Admin only
// Captures: user actions, booking events, assignment changes,
//           compliance decisions, payment events, admin overrides, system events

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Who ───────────────────────────────────────────────────────────────
    user_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    // Role at the time of action
    acting_as: {
      type: DataTypes.ENUM(
        'super_admin', 'operations_admin', 'finance_admin',
        'customer', 'driver', 'transporter', 'agent', 'agency'
      ),
    },
    // PRD §3.1 — View As mode: admin impersonating another user
    view_as_user: {
      type: DataTypes.UUID,
    },

    // ── What ──────────────────────────────────────────────────────────────
    // Action code — e.g. BOOKING_ASSIGNED, DRIVER_APPROVED, PAYMENT_RELEASED
    action: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    // Full context: IDs, old values, new values, reason
    details: {
      type:         DataTypes.JSONB,
      defaultValue: {},
    },

    // ── Where / When ─────────────────────────────────────────────────────
    ip_address: {
      type: DataTypes.STRING(45), // supports IPv6
    },
    user_agent: {
      type: DataTypes.TEXT,
    },

    // ── Resource Reference ────────────────────────────────────────────────
    // Optional — link log to a specific resource
    resource_type: {
      type: DataTypes.STRING(50), // e.g. 'booking', 'driver', 'vehicle'
    },
    resource_id: {
      type: DataTypes.UUID,
    },
  }, {
    tableName:   'audit_logs',
    underscored: true,
    timestamps:  true,
    paranoid:    false, // PRD §25.8 — immutable, NEVER deleted
    updatedAt:   false, // immutable — no updates ever
    createdAt:   'created_at',

    // PRD §25.10 — composite index
    indexes: [
      { fields: ['user_id', 'created_at'] }, // composite
      { fields: ['action'] },
      { fields: ['resource_type', 'resource_id'] },
      { fields: ['acting_as'] },
    ],
  });

  // ── Associations ──────────────────────────────────────────────────────
  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as:         'user',
    });
  };

  return AuditLog;
};