// src/models/system-setting.js
// PRD §3.1 — Super Admin configures global settings, pricing, assignment mode
// PRD §4 — Assignment Engine mode (manual/semi-auto/full-auto)
// PRD §7 — Pricing Engine defaults
// PRD §23 — Cancellation policy rules (configurable)
// PRD §24 — Notification system controls

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemSetting = sequelize.define('SystemSetting', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Key-Value Store ───────────────────────────────────────────────────
    // Generic key-value for all platform config
    key: {
      type:      DataTypes.STRING(100),
      allowNull: false,
      unique:    true,
    },
    value: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    value_type: {
      type:         DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      defaultValue: 'string',
    },

    // ── Assignment Engine ─────────────────────────────────────────────────
    // PRD §4 — Manual / Semi-Auto / Full Auto
    auto_assign: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    assignment_mode: {
      type:         DataTypes.ENUM('manual', 'semi_auto', 'full_auto'),
      defaultValue: 'manual',
    },
    assignment_radius_km: {
      type:         DataTypes.DECIMAL(5, 2),
      defaultValue: 10,
    },
    min_driver_rating: {
      type:         DataTypes.DECIMAL(3, 2),
      defaultValue: 3.5,
    },

    // ── Cancellation Policy ───────────────────────────────────────────────
    // PRD §23 — configurable by Admin
    cancellation_fee_pct: {
      type:         DataTypes.DECIMAL(5, 2),
      defaultValue: 10, // 10% of fare
    },
    max_wait_mins: {
      type:         DataTypes.INTEGER,
      defaultValue: 30,
    },
    waiting_charge_per_15min: {
      type:         DataTypes.DECIMAL(8, 2),
      defaultValue: 50, // KES 50
    },
    repeat_canceller_threshold: {
      type:         DataTypes.INTEGER,
      defaultValue: 3, // 3 cancellations in 30 days
    },

    // ── Document Expiry Alerts ────────────────────────────────────────────
    // PRD §14 — alert 30 days before expiry
    doc_expiry_alert_days: {
      type:         DataTypes.INTEGER,
      defaultValue: 30,
    },

    // ── Who last updated ──────────────────────────────────────────────────
    updated_by: {
      type: DataTypes.UUID,
    },
  }, {
    tableName:   'system_settings',
    underscored: true,
    timestamps:  true,
    paranoid:    false, // settings are never deleted
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    indexes: [
      { fields: ['key'], unique: true },
    ],
  });

  SystemSetting.associate = (models) => {
    // no associations needed
  };

  return SystemSetting;
};