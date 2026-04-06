// src/models/bookingoffer.js
// PRD §4 — Order Assignment Engine (driver/transporter can offer on bookings)
// PRD §25.9 — Soft Delete

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BookingOffer = sequelize.define('BookingOffer', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },

    // ── Link to Booking ───────────────────────────────────────────────────
    booking_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'bookings', key: 'id' },
      onDelete:   'CASCADE',
      onUpdate:   'CASCADE',
    },

    // ── Who is offering ───────────────────────────────────────────────────
    user_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type:      DataTypes.ENUM('driver', 'transporter', 'agent'),
      allowNull: false,
    },

    // ── Offer Details ─────────────────────────────────────────────────────
    price: {
      type:      DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
    },
    vehicle_id: {
      type: DataTypes.UUID,
    },
    driver_id: {
      type: DataTypes.UUID,
    },
    estimated_arrival_mins: {
      type: DataTypes.INTEGER,
    },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type:         DataTypes.ENUM('pending', 'accepted', 'rejected'),
      defaultValue: 'pending',
    },
    responded_at: {
      type: DataTypes.DATE,
    },
    responded_by: {
      type: DataTypes.UUID,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },

    // ── Expiry ────────────────────────────────────────────────────────────
    expires_at: {
      type: DataTypes.DATE,
    },
  }, {
    tableName:   'booking_offers',
    underscored: true,
    timestamps:  true,
    paranoid:    true,
    createdAt:   'created_at',
    updatedAt:   'updated_at',
    deletedAt:   'deleted_at',
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['role'] },
    ],
  });

  BookingOffer.associate = (models) => {
    BookingOffer.belongsTo(models.Booking, {
      foreignKey: 'booking_id',
      as:         'booking',
    });
  };

  return BookingOffer;
};