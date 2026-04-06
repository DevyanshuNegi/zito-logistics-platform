// src/models/contract.js
// PRD §3.6 — Transporter contract management
// PRD §5.4 — Transporter Portal Finance section
// PRD §8 — Database Schema
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Contract = sequelize.define('Contract', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Parties ───────────────────────────────────────────────────────────
    customer_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'users', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },
    transporter_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    created_by: {
      type: DataTypes.UUID,
    },

    // ── Business Details ──────────────────────────────────────────────────
    business_name: {
      type:      DataTypes.STRING(200),
      allowNull: false,
    },
    business_registration: {
      type: DataTypes.STRING(100),
    },
    kra_pin: {
      type: DataTypes.STRING(20),
    },

    // ── Contract Terms ────────────────────────────────────────────────────
    payment_method: {
      type: DataTypes.STRING(20), // cash, mpesa, bank_transfer, credit
    },
    credit_days: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
    },
    credit_limit: {
      type: DataTypes.DECIMAL(12, 2),
    },
    requires_approval: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },

    // ── Validity ──────────────────────────────────────────────────────────
    start_date: {
      type: DataTypes.DATEONLY,
    },
    end_date: {
      type: DataTypes.DATEONLY,
    },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type:         DataTypes.ENUM('draft', 'active', 'expiring', 'expired', 'inactive'),
      defaultValue: 'draft',
    },
    is_active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },

    // ── Notes ─────────────────────────────────────────────────────────────
    terms: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName:   'contracts',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['transporter_id'] },
      { fields: ['status'] },
      { fields: ['is_active'] },
    ],
  });

  Contract.associate = (models) => {
    Contract.belongsTo(models.User, {
      foreignKey: 'customer_id',
      as:         'customer',
    });
    Contract.belongsTo(models.User, {
      foreignKey: 'transporter_id',
      as:         'transporter',
    });
    Contract.hasMany(models.ContractRate, {
      foreignKey: 'contract_id',
      as:         'rates',
    });
  };

  return Contract;
};