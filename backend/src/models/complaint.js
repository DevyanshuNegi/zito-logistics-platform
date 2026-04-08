// src/models/complaint.js
// PRD §18.2 — Complaint system

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Complaint = sequelize.define('Complaint', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    user_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'users', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    booking_id: {
      type:       DataTypes.UUID,
      allowNull:  true,
      references: { model: 'bookings', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    category: {
      type: DataTypes.ENUM(
        'cargo_issue',
        'driver_behaviour',
        'vehicle_issue',
        'billing_dispute',
        'platform_issue',
        'other'
      ),
      allowNull: false,
    },

    description: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },

    status: {
      type:         DataTypes.ENUM('submitted', 'under_review', 'awaiting_response', 'resolved', 'closed'),
      defaultValue: 'submitted',
    },

    resolution_notes: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName:   'complaints',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['booking_id'] },
      { fields: ['status'] },
      { fields: ['category'] },
    ],
  });

  Complaint.associate = (models) => {
    Complaint.belongsTo(models.User, {
      foreignKey: 'user_id',
      as:         'user',
    });
    Complaint.belongsTo(models.Booking, {
      foreignKey: 'booking_id',
      as:         'booking',
    });
  };

  return Complaint;
};
