// src/models/driver.js
// PRD §3.5 — Driver Role
// PRD §8 — Database Schema
// PRD §14 — Compliance & KYC
// PRD §18.1 — Driver Assignment Validation
// PRD §25.3 — Driver Compliance Module
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Driver = sequelize.define('Driver', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    user_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      unique:     true,
      references: { model: 'users', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    // PRD §14.1 — License
    license_number: {
      type:      DataTypes.STRING(50),
      allowNull: false,
      unique:    true,
    },
    license_class: {
      type: DataTypes.STRING(20),
    },
    license_expiry: {
      type: DataTypes.DATE,
    },
    license_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §14.1 — KRA PIN
    kra_pin: {
      type:   DataTypes.STRING(20),
      unique: true,
    },
    kra_pin_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §14.1 — Police Clearance
    police_clearance_url: {
      type: DataTypes.TEXT,
    },
    police_clearance_expiry: {
      type: DataTypes.DATE,
    },
    police_clearance_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §14.1 — Medical
    medical_cert_url: {
      type: DataTypes.TEXT,
    },
    medical_expiry: {
      type: DataTypes.DATE,
    },
    medical_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §14.1 — Agreements
    contract_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    oath_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sop_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §18.1 — Assignment eligibility
    is_blacklisted: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    blacklist_reason: {
      type: DataTypes.TEXT,
    },
    blacklisted_by: {
      type: DataTypes.UUID,
    },
    blacklisted_at: {
      type: DataTypes.DATE,
    },
    can_receive_assignments: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_available: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    vehicle_id: {
      type:       DataTypes.UUID,
      references: { model: 'vehicles', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    // PRD §21.1 — Rating
    avg_rating: {
      type:         DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
    },
    total_trips: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_ratings: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
    },

    // PRD §18.5 — GPS
    current_lat: {
      type: DataTypes.DECIMAL(10, 8),
    },
    current_lng: {
      type: DataTypes.DECIMAL(11, 8),
    },
    location_updated: {
      type: DataTypes.DATE,
    },

    background_check: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    probation_end: {
      type: DataTypes.DATE,
    },

  }, {
    tableName:   'drivers',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['user_id'],    unique: true },
      { fields: ['license_number'], unique: true },
      { fields: ['is_available', 'can_receive_assignments'] },
      { fields: ['is_blacklisted'] },
      { fields: ['vehicle_id'] },
      { fields: ['avg_rating'] },
    ],
  });

  Driver.associate = (models) => {
    Driver.belongsTo(models.User, {
      foreignKey: 'user_id',
      as:         'user',
    });
    Driver.belongsTo(models.Vehicle, {
      foreignKey: 'vehicle_id',
      as:         'current_vehicle',
    });
    Driver.hasMany(models.Booking, {
      foreignKey: 'assigned_driver_id',
      as:         'trips',
    });
    if (models.DriverCompliance) {
      Driver.hasOne(models.DriverCompliance, {
        foreignKey: 'driver_id',
        as:         'compliance',
      });
    }
  };

  return Driver;
};