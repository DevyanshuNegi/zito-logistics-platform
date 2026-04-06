// src/models/vehicle.js
// PRD §3.6 — Transporter fleet management
// PRD §7 — Pricing Engine (vehicle types)
// PRD §8 — Database Schema
// PRD §14.7 — Vehicle Compliance Requirements
// PRD §18.2 — Vehicle Assignment Validation
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Basic Details ─────────────────────────────────────────────────────
    plate_number: {
      type:      DataTypes.STRING(20),
      allowNull: false,
      unique:    true,
    },
    make: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    model: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    year: {
      type: DataTypes.SMALLINT,
    },
    color: {
      type: DataTypes.STRING(50),
    },

    // ── Vehicle Type ──────────────────────────────────────────────────────
    // PRD §7 — Default Vehicle Pricing (5 types)
    vehicle_type: {
      type:      DataTypes.ENUM('motorcycle', 'van', 'pickup', 'truck', 'articulated'),
      allowNull: false,
    },

    // ── Ownership ─────────────────────────────────────────────────────────
    // PRD §3.6 — Transporter owns fleet
    ownership_type: {
      type:         DataTypes.ENUM('vg_owned', 'contracted'),
      defaultValue: 'vg_owned',
    },
    owner_user_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    transporter_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    // ── Cargo Capacity ────────────────────────────────────────────────────
    // PRD §4.1 — Auto-Assignment Rules (cargo capacity check)
    cargo_capacity_kg: {
      type: DataTypes.INTEGER,
    },
    cargo_volume_m3: {
      type: DataTypes.DECIMAL(8, 2),
    },

    // ── Insurance ─────────────────────────────────────────────────────────
    // PRD §14.7, §18.2 — Vehicle Compliance Requirements
    insurance_cert: {
      type: DataTypes.TEXT,
    },
    insurance_expiry: {
      type: DataTypes.DATE,
    },
    insurance_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── NTSA ──────────────────────────────────────────────────────────────
    ntsa_cert_url: {
      type: DataTypes.TEXT,
    },
    ntsa_expiry: {
      type: DataTypes.DATE,
    },
    ntsa_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Inspection ────────────────────────────────────────────────────────
    inspection_cert_url: {
      type: DataTypes.TEXT,
    },
    inspection_expiry: {
      type: DataTypes.DATE,
    },
    inspection_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Logbook ───────────────────────────────────────────────────────────
    logbook_url: {
      type: DataTypes.TEXT,
    },
    logbook_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Assignment Status ─────────────────────────────────────────────────
    // PRD §18.2 — all must pass for assignment
    is_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_assignment_blocked: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    block_reason: {
      type: DataTypes.TEXT,
    },
    blocked_by: {
      type: DataTypes.UUID,
    },
    is_active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_approved: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Current Assignment ────────────────────────────────────────────────
    current_driver_id: {
      type:       DataTypes.UUID,
      references: { model: 'drivers', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
  }, {
    tableName:   'vehicles',
    underscored: true,
    timestamps:  true,
    paranoid:    true, // PRD §25.9 — soft delete
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',

    // PRD §25.10 — composite index for assignment engine
    indexes: [
      { fields: ['plate_number'],                        unique: true },
      { fields: ['transporter_id'] },
      { fields: ['owner_user_id'] },
      { fields: ['vehicle_type'] },
      { fields: ['is_verified', 'is_assignment_blocked'] }, // composite
      { fields: ['is_active'] },
      { fields: ['current_driver_id'] },
    ],
  });

  // ── Associations ──────────────────────────────────────────────────────
  Vehicle.associate = (models) => {
    // Owner (user)
    Vehicle.belongsTo(models.User, {
      foreignKey: 'owner_user_id',
      as:         'owner',
    });

    // Transporter
    Vehicle.belongsTo(models.User, {
      foreignKey: 'transporter_id',
      as:         'transporter',
    });

    // Current driver
    Vehicle.belongsTo(models.Driver, {
      foreignKey: 'current_driver_id',
      as:         'current_driver',
    });

    // Bookings using this vehicle
    Vehicle.hasMany(models.Booking, {
      foreignKey: 'vehicle_id',
      as:         'bookings',
    });
  };

  return Vehicle;
};