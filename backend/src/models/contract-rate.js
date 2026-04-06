// src/models/contract-rate.js
// PRD §7 — Pricing Engine (custom pricing per vehicle type)
// PRD §3.6 — Transporter can set customer-specific rate cards
// PRD §8 — Database Schema (contract_rates table)
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContractRate = sequelize.define('ContractRate', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Link to Contract ──────────────────────────────────────────────────
    contract_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'contracts', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    // ── Vehicle Type ──────────────────────────────────────────────────────
    // PRD §7 — one rate per vehicle type per contract
    vehicle_type: {
      type:      DataTypes.STRING(50),
      allowNull: false,
    },

    // ── Rate ──────────────────────────────────────────────────────────────
    // PRD §7 Formula: Final Price = Base Rate + (Distance × Per KM Rate) + Surcharges
    base_rate: {
      type:      DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    per_km_rate: {
      type:      DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    min_fare: {
      type:      DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    max_fare: {
      type: DataTypes.DECIMAL(10, 2),
    },

    // ── Surcharge Overrides ───────────────────────────────────────────────
    // PRD §7 — contract customers may override default surcharges
    heavy_load_pct: {
      type:         DataTypes.DECIMAL(5, 2),
      defaultValue: 20, // +20% default
    },
    night_surcharge_pct: {
      type:         DataTypes.DECIMAL(5, 2),
      defaultValue: 15, // +15% default
    },
    holiday_surcharge_pct: {
      type:         DataTypes.DECIMAL(5, 2),
      defaultValue: 10, // +10% default
    },
    waiting_rate_per_15min: {
      type:         DataTypes.DECIMAL(8, 2),
      defaultValue: 50, // KES 50 default
    },

    // ── Validity ──────────────────────────────────────────────────────────
    valid_from: {
      type: DataTypes.DATEONLY,
    },
    valid_to: {
      type: DataTypes.DATEONLY,
    },
    is_active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName:   'contract_rates',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['contract_id'] },
      { fields: ['vehicle_type'] },
      { fields: ['is_active'] },
    ],
  });

  ContractRate.associate = (models) => {
    ContractRate.belongsTo(models.Contract, {
      foreignKey: 'contract_id',
      as:         'contract',
    });
  };

  return ContractRate;
};