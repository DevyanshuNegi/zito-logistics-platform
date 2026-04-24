const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const alertService = require('./alert.service');

/**
 * Fraud Detection Engine
 * PRD §44.7 — Detect abnormal patterns
 * PRD §44.3 — Fuel theft detection (10% variance threshold)
 */
exports.detectFuelFraud = async (chargeId) => {
  try {
    const charge = await prisma.tripCharge.findUnique({
      where: { id: chargeId }
    });

    if (!charge || charge.chargeType !== 'fuel') return;

    const actual = Number(charge.fuelActualLiters || 0);
    const expected = Number(charge.fuelExpectedLiters || 0);

    if (expected <= 0) return;

    const variance = (actual - expected) / expected;

    // Flag if variance exceeds 10% (0.10)
    if (variance > 0.10) {
      await prisma.tripCharge.update({
        where: { id: charge.id },
        data: {
          description: `[FLAGGED: FRAUD] ${charge.description || ''} (Variance: ${(variance * 100).toFixed(2)}%)`,
          status: 'pending' // Ensure it stays pending for Super Admin review per PRD §44.14
        }
      });

      logger.warn(`FRAUD ALERT: High fuel variance detected on charge ${charge.id}. Variance: ${(variance * 100).toFixed(2)}%.`);

      // PRD §44.3: Abnormal fuel usage alerts, Fuel theft detection
      // Integrate with Internal Alert System (PRD §39, §44.10)
      const booking = await prisma.booking.findUnique({
        where: { id: charge.bookingId },
        select: { id: true, reference: true, agencyId: true, assignedDriverId: true, vehicleId: true }
      });

      await alertService.createAlert({
        type: 'FUEL_FRAUD',
        severity: 'critical',
        message: `High fuel variance detected for booking ${booking?.reference || 'N/A'}. Charge ID: ${charge.id}. Variance: ${(variance * 100).toFixed(2)}%.`,
        agencyId: booking?.agencyId,
        entityType: 'tripCharge',
        entityId: charge.id,
        metadata: {
          bookingId: booking?.id,
          driverId: booking?.assignedDriverId,
          vehicleId: booking?.vehicleId,
          fuelVariance: variance,
        }
      });
    }
  } catch (err) {
    logger.error(`Fraud Detection Engine error on charge ${chargeId}:`, err);
  }
};