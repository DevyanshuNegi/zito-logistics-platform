// src/models/payment.js
// PRD Â§25.6 â€” Payment lifecycle, supports mock M-Pesa/testing

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    booking_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'bookings', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    provider: {
      type: DataTypes.ENUM('mpesa', 'card', 'bank', 'cash', 'mock'),
      defaultValue: 'mock',
    },

    amount: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    currency: {
      type:         DataTypes.STRING(8),
      defaultValue: 'KES',
    },

    status: {
      type: DataTypes.ENUM('pending', 'held', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
    },

    reference: {
      type: DataTypes.STRING(64),
    },

    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName:   'payments',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['status'] },
      { fields: ['provider'] },
    ],
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.Booking, {
      foreignKey: 'booking_id',
      as:         'booking',
    });
  };

  return Payment;
};
