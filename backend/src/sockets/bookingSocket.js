module.exports = (io) => {
  // Emit booking status update to relevant users
  global.broadcastBookingStatusUpdate = (booking, oldStatus) => {
    const eventData = {
      booking_id: booking.id,
      booking_reference: booking.reference,
      old_status: oldStatus,
      new_status: booking.status,
      booking: booking
    };

    // Notify customer
    if (booking.customer_id) {
      io.to(`user:${booking.customer_id}`).emit('booking:status_updated', eventData);
    }

    // Notify assigned driver
    if (booking.assigned_driver_id) {
      io.to(`driver:${booking.assigned_driver_id}`).emit('booking:status_updated', eventData);
    }

    // Notify all admins
    io.to('global:admin').emit('booking:status_updated', eventData);
  };

  // Emit when driver is assigned
  global.broadcastDriverAssigned = (booking, driver) => {
    const eventData = {
      booking_id: booking.id,
      booking_reference: booking.reference,
      driver_id: driver.id,
      driver_name: driver.full_name,
      booking: booking
    };

    // Notify customer
    if (booking.customer_id) {
      io.to(`user:${booking.customer_id}`).emit('booking:driver_assigned', eventData);
    }

    // Notify driver
    if (driver.id) {
      io.to(`driver:${driver.id}`).emit('booking:assigned_to_me', eventData);
    }

    // Notify all admins
    io.to('global:admin').emit('booking:driver_assigned', eventData);
  };

  // Emit when booking is created
  global.broadcastBookingCreated = (booking) => {
    const eventData = {
      booking_id: booking.id,
      booking_reference: booking.reference,
      booking: booking
    };

    // Notify customer
    if (booking.customer_id) {
      io.to(`user:${booking.customer_id}`).emit('booking:created', eventData);
    }

    // Notify all drivers (available for offers)
    io.to('drivers').emit('booking:created', eventData);

    // Notify all admins
    io.to('global:admin').emit('booking:created', eventData);
  };
};
