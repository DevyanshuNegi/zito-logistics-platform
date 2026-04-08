// src/models/trip-charge.js
// PRD §7.2 / §7.3 — Trip Charges and Driver Expenses
// Stores per-trip variable charges (toll, fuel, waiting, etc.)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TripCharge = sequelize.define('TripCharge', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    trip_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'bookings', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    charge_type: {
      type: DataTypes.ENUM(
        'toll',
        'fuel',
        'loading',
        'unloading',
        'waiting',
        'driver_expense',
        'other'
      ),
      allowNull: false,
    },

    amount: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
    },

    driver_id: {
      type:       DataTypes.UUID,
      references: { model: 'drivers', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    status: {
      type: DataTypes.ENUM('submitted', 'approved', 'rejected'),
      defaultValue: 'submitted',
    },

    approved_by: {
      type: DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    approved_at: {
      type: DataTypes.DATE,
    },
  }, {
    tableName:   'trip_charges',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['trip_id'] },
      { fields: ['driver_id'] },
      { fields: ['charge_type'] },
    ],
  });

  TripCharge.associate = (models) => {
    TripCharge.belongsTo(models.Booking, {
      foreignKey: 'trip_id',
      as:         'booking',
    });
    TripCharge.belongsTo(models.Driver, {
      foreignKey: 'driver_id',
      as:         'driver',
    });
  };

  return TripCharge;
};
