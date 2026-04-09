// src/models/user.js
// PRD §3 — User Roles & Permissions
// PRD §8 — Database Schema
// PRD §11 — Security (bcrypt, JWT, 2FA)
// PRD §14 — Compliance & KYC
// PRD §16 — Centralised Control Model
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    full_name: {
      type:      DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type:      DataTypes.STRING(255),
      allowNull: false,
      unique:    true,
      validate:  { isEmail: true },
    },
    phone: {
      type:      DataTypes.STRING(20),
      allowNull: false,
      unique:    true,
    },
    password_hash: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    id_number: {
      type:   DataTypes.STRING(50),
      unique: true,
    },
    profile_photo: {
      type: DataTypes.TEXT,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
    },

    // PRD §3 — 8 roles
    role: {
      type: DataTypes.ENUM(
        'super_admin',
        'operations_admin',
        'finance_admin',
        'customer',
        'driver',
        'transporter',
        'agent',
        'agency'
      ),
      allowNull:    false,
      defaultValue: 'customer',
    },

    admin_scope: {
      type: DataTypes.ENUM('super_admin', 'ops_admin', 'finance_admin', 'read_only'),
    },

    // PRD §25.7 — Multi-tenant links
    transporter_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    agent_id: {
      type: DataTypes.UUID,
    },
    agency_id: {
      type: DataTypes.UUID,
    },

    // PRD §14, §16 — Compliance
    compliance_status: {
      type:         DataTypes.ENUM('pending', 'approved', 'rejected', 'resubmission_required'),
      defaultValue: 'pending',
    },
    data_locked: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    approved_by: {
      type: DataTypes.UUID,
    },
    rejected_by: {
      type: DataTypes.UUID,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },

    // PRD §17 — Account status
    is_active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_deleted: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },

    // PRD §11 — 2FA
    otp_verified: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // PRD §24.3 — Notification preferences
    notify_email: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notify_sms: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notify_in_app: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
    },

    scope_type: {
      type: DataTypes.STRING(50),
    },

  }, {
    tableName:   'users',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
    scopes: {
      withPassword: { attributes: {} },
    },
    indexes: [
      { fields: ['email'],             unique: true },
      { fields: ['phone'],             unique: true },
      { fields: ['role'] },
      { fields: ['compliance_status'] },
      { fields: ['transporter_id'] },
      { fields: ['agent_id'] },
      { fields: ['agency_id'] },
      { fields: ['is_active'] },
      { fields: ['is_deleted'] },
    ],
    hooks: {
      // PRD §11 — bcrypt 12 rounds before save
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
    },
  });

  // Instance method — compare password
  User.prototype.comparePassword = async function (plainText) {
    return bcrypt.compare(plainText, this.password_hash);
  };

  User.associate = (models) => {
    User.belongsTo(models.User, {
      as:         'transporter',
      foreignKey: 'transporter_id',
    });
    User.hasMany(models.User, {
      as:         'fleet_members',
      foreignKey: 'transporter_id',
    });
    User.hasOne(models.Driver, {
      foreignKey: 'user_id',
      as:         'driver_profile',
    });
    User.hasMany(models.Booking, {
      foreignKey: 'customer_id',
      as:         'bookings',
    });
    User.hasMany(models.Contract, {
      foreignKey: 'customer_id',
      as:         'contracts',
    });
    if (models.AuditLog) {
      User.hasMany(models.AuditLog, {
        foreignKey: 'user_id',
        as:         'audit_logs',
      });
    }
  };

  return User;
};
