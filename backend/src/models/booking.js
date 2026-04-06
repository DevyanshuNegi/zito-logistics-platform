// src/models/booking.js
// PRD §6 — Booking Workflow & Status Lifecycle (10 statuses)
// PRD §7 — Pricing Engine
// PRD §8 — Database Schema
// PRD §25.2 — Booking Ownership Model
// PRD §25.6 — Payment Hold & Release Lifecycle
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    reference: {
      type:      DataTypes.STRING(20),
      allowNull: false,
      unique:    true,
    },

    // PRD §25.2 — Booking Ownership Model
    created_by_role: {
      type: DataTypes.ENUM(
        'super_admin', 'operations_admin', 'finance_admin',
        'customer', 'driver', 'transporter', 'agent', 'agency'
      ),
    },
    created_by_id: {
      type: DataTypes.UUID,
    },
    handled_by: {
      type:         DataTypes.ENUM('admin', 'transporter'),
      defaultValue: 'admin',
    },
    transporter_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    customer_id: {
      type:       DataTypes.UUID,
      references: { model: 'users', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    agent_id: {
      type: DataTypes.UUID,
    },

    assigned_driver_id: {
      type:       DataTypes.UUID,
      references: { model: 'drivers', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },
    vehicle_id: {
      type:       DataTypes.UUID,
      references: { model: 'vehicles', key: 'id' },
      onDelete:   'SET NULL',
      onUpdate:   'CASCADE',
    },

    // PRD §6 — all 10 booking statuses
    status: {
      type: DataTypes.ENUM(
        'pending', 'approved', 'assigned', 'accepted',
        'picked_up', 'in_transit', 'delivered',
        'completed', 'cancelled', 'rejected'
      ),
      allowNull:    false,
      defaultValue: 'pending',
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
    },

    pickup_address: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    pickup_lat: {
      type: DataTypes.DECIMAL(10, 8),
    },
    pickup_lng: {
      type: DataTypes.DECIMAL(11, 8),
    },
    delivery_address: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    delivery_lat: {
      type: DataTypes.DECIMAL(10, 8),
    },
    delivery_lng: {
      type: DataTypes.DECIMAL(11, 8),
    },

    cargo_type: {
      type: DataTypes.STRING(100),
    },
    cargo_weight_kg: {
      type: DataTypes.DECIMAL(10, 2),
    },
    cargo_volume_m3: {
      type: DataTypes.DECIMAL(8, 2),
    },
    cargo_description: {
      type: DataTypes.TEXT,
    },
    special_handling: {
      type: DataTypes.TEXT,
    },

    vehicle_type: {
      type: DataTypes.STRING(50),
    },

    // PRD §7 — Pricing Engine
    estimated_fare: {
      type: DataTypes.DECIMAL(12, 2),
    },
    final_fare: {
      type: DataTypes.DECIMAL(12, 2),
    },
    distance_km: {
      type: DataTypes.DECIMAL(10, 2),
    },
    base_rate: {
      type: DataTypes.DECIMAL(10, 2),
    },
    per_km_rate: {
      type: DataTypes.DECIMAL(10, 2),
    },
    surcharges: {
      type:         DataTypes.JSONB,
      defaultValue: {},
    },

    // PRD §25.6 — Payment lifecycle
    payment_status: {
      type:         DataTypes.ENUM('pending', 'held', 'released', 'refunded', 'partial_refund', 'frozen'),
      defaultValue: 'pending',
    },

    scheduled_at: {
      type: DataTypes.DATE,
    },
    is_recurring: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_multi_stop: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    special_instructions: {
      type: DataTypes.TEXT,
    },

    // PRD §5.3 — Proof of Delivery
    pod_photo_url: {
      type: DataTypes.TEXT,
    },
    pod_uploaded_at: {
      type: DataTypes.DATE,
    },

    // PRD §6 — lifecycle timestamps
    approved_at:   { type: DataTypes.DATE },
    assigned_at:   { type: DataTypes.DATE },
    accepted_at:   { type: DataTypes.DATE },
    picked_up_at:  { type: DataTypes.DATE },
    in_transit_at: { type: DataTypes.DATE },
    delivered_at:  { type: DataTypes.DATE },
    completed_at:  { type: DataTypes.DATE },
    cancelled_at:  { type: DataTypes.DATE },

  }, {
    tableName:   'bookings',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['reference'],          unique: true },
      { fields: ['status'] },
      { fields: ['customer_id'] },
      { fields: ['assigned_driver_id'] },
      { fields: ['transporter_id'] },
      { fields: ['vehicle_id'] },
      { fields: ['agent_id'] },
      { fields: ['created_at'] },
      { fields: ['payment_status'] },
      { fields: ['handled_by'] },
    ],
  });

  Booking.associate = (models) => {
    Booking.belongsTo(models.User, {
      foreignKey: 'customer_id',
      as:         'customer',
    });
    Booking.belongsTo(models.User, {
      foreignKey: 'transporter_id',
      as:         'transporter',
    });
    Booking.belongsTo(models.Driver, {
      foreignKey: 'assigned_driver_id',
      as:         'driver',
    });
    Booking.belongsTo(models.Vehicle, {
      foreignKey: 'vehicle_id',
      as:         'vehicle',
    });
    if (models.Payment) {
      Booking.hasMany(models.Payment, {
        foreignKey: 'booking_id',
        as:         'payments',
      });
    }
    if (models.BookingOffer) {
      Booking.hasOne(models.BookingOffer, {
        foreignKey: 'booking_id',
        as:         'offer',
      });
    }
  };

  return Booking;
};