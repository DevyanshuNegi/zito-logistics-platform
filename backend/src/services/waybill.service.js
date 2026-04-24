const prisma = require('../utils/prisma');
const { generateBookingRef } = require('../utils/helpers');

/**
 * Waybill & Lorry Receipt (LR) Service
 * Enforces PRD §14 document lifecycle.
 */

const generateDocument = async (bookingId, type) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true }
  });

  if (!booking) throw new Error('Booking not found');

  // PRD §14: LR for FTL, Waybill for PTL/Courier
  const prefix = type === 'LR' ? 'ZT-LR' : 'ZT-WB';
  const docNumber = `${prefix}-${Date.now().toString().slice(-8)}`;

  return prisma.waybill.create({
    data: {
      bookingId,
      docNumber,
      type,
      status: 'created',
      issuedAt: new Date(),
      metadata: {
        customerName: booking.customer.full_name,
        origin: booking.pickupAddress,
        destination: booking.deliveryAddress,
        weight: booking.cargoWeightKg
      }
    }
  });
};

const closeDocument = async (docId) => {
  return prisma.waybill.update({
    where: { id: docId },
    data: { 
      status: 'closed',
      closedAt: new Date()
    }
  });
};

module.exports = {
  generateDocument,
  closeDocument
};