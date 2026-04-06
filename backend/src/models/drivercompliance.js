// src/models/drivercompliance.js
// PRD §14 — Compliance & KYC Framework
// PRD §25.3 — Driver Compliance Module (dedicated table, linked 1:1 with drivers)
// PRD §16 — Centralised Control Model (VG Admin only approves)
// PRD §25.9 — Compliance records NEVER deleted (no paranoid/soft delete here)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DriverCompliance = sequelize.define('DriverCompliance', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Link to Driver (1:1) ──────────────────────────────────────────────
    driver_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      unique:     true,
      references: { model: 'drivers', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    // ── Overall Compliance Status ─────────────────────────────────────────
    // PRD §14.3 — Compliance Status Workflow
    compliance_status: {
      type:         DataTypes.ENUM('pending', 'approved', 'rejected', 'resubmission_required'),
      defaultValue: 'pending',
    },
    status_updated_at: {
      type: DataTypes.DATE,
    },
    status_updated_by: {
      type: DataTypes.UUID, // Admin user ID
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    resubmission_comment: {
      type: DataTypes.TEXT,
    },

    // ── Identity Verification ─────────────────────────────────────────────
    // PRD §14.1 — Identity & Contact
    national_id_url: {
      type: DataTypes.TEXT,
    },
    national_id_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    face_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── License ───────────────────────────────────────────────────────────
    // PRD §14.1 — Legal & Government
    license_url: {
      type: DataTypes.TEXT,
    },
    license_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    license_expiry: {
      type: DataTypes.DATE,
    },
    license_expiry_alerted: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── KRA PIN ───────────────────────────────────────────────────────────
    kra_pin_doc_url: {
      type: DataTypes.TEXT,
    },
    kra_pin_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── NTSA Validation ───────────────────────────────────────────────────
    // PRD §14.1 — future integration
    ntsa_validated: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Police Clearance ──────────────────────────────────────────────────
    police_clearance_url: {
      type: DataTypes.TEXT,
    },
    police_clearance_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    police_clearance_expiry: {
      type: DataTypes.DATE,
    },
    police_clearance_expiry_alerted: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    criminal_background_flag: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Medical Certificate ───────────────────────────────────────────────
    medical_cert_url: {
      type: DataTypes.TEXT,
    },
    medical_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    medical_expiry: {
      type: DataTypes.DATE,
    },
    medical_expiry_alerted: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // ── Mandatory Agreements ──────────────────────────────────────────────
    // PRD §14.1 — Driver must digitally accept all three
    contract_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    contract_signed_at: {
      type: DataTypes.DATE,
    },
    oath_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    oath_signed_at: {
      type: DataTypes.DATE,
    },
    sop_signed: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    sop_signed_at: {
      type: DataTypes.DATE,
    },

    // ── Admin Actions ─────────────────────────────────────────────────────
    // PRD §25.4 — Admin Compliance APIs
    approved_by: {
      type: DataTypes.UUID,
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    rejected_by: {
      type: DataTypes.UUID,
    },
    rejected_at: {
      type: DataTypes.DATE,
    },

    // ── Notes ─────────────────────────────────────────────────────────────
    admin_notes: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName:   'driver_compliance',
    underscored: true,
    timestamps:  true,
    // PRD §25.9 — Compliance records are NEVER deleted (no paranoid here)
    paranoid:    false,
    createdAt:   'created_at',
    updatedAt:   'updated_at',

    indexes: [
      { fields: ['driver_id'],         unique: true },
      { fields: ['compliance_status'] },
      { fields: ['status_updated_by'] },
    ],
  });

  // ── Associations ──────────────────────────────────────────────────────
  DriverCompliance.associate = (models) => {
    DriverCompliance.belongsTo(models.Driver, {
      foreignKey: 'driver_id',
      as:         'driver',
    });
  };

  return DriverCompliance;
};