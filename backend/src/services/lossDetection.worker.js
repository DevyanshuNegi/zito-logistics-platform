const { Worker } = require('bullmq');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');
const { sendEmail } = require('./notification.service');
const alertService = require('./alert.service');

/**
 * PRD §13 — Loss Detection System
 * Periodic worker to detect "Stale Items" and "SLA Breaches"
 */
const lossDetectionWorker = new Worker('loss-detection', async (job) => {
  logger.info('Starting periodic loss detection scan...');

  // 0. Process existing alert escalations (PRD §44.10)
  await alertService.processEscalations();

  const SLA_HOURS = 24; // For stale trips
  const staleThreshold = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

  // 1. Detect Stale Bookings (Picked up but not delivered/updated within SLA)
  const staleTrips = await prisma.booking.findMany({
    where: {
      status: { in: ['picked_up', 'in_transit'] },
      updatedAt: { lte: staleThreshold },
    },
    include: { driver: { include: { user: true } } }
  });

  for (const trip of staleTrips) {
    logger.warn(`LOSS DETECTION: Trip ${trip.reference} has no movement for >${SLA_HOURS}h`);
    
    // Create an incident/complaint automatically as per PRD §13
    await prisma.complaint.create({
      // Assuming complaint can be created by system user or linked to driver
      data: {
        bookingId: trip.id,
        category: 'platform_issue',
        description: `SYSTEM_ALERT: No movement detected for ${SLA_HOURS} hours. Potential loss or delay.`,
        status: 'submitted',
        userId: trip.driver.userId
      }
    });
    
    // Create internal alert for escalation tracking
    await alertService.createAlert({
      type: 'DELAYED_DELIVERY',
      severity: 'high',
      message: `Trip ${trip.reference} assigned to ${trip.driver.user.full_name} stale for >${SLA_HOURS}h.`,
      entityType: 'booking',
      entityId: trip.id,
      agencyId: trip.agencyId
    });
  }

  // 2. Detect Stale Parcels (Waybill-linked LCL/PTL items)
  // PRD §13: "Missing location: item expected but no scan recorded", "No movement alerts: stale items exceeding SLA time"
  const SLA_DISPATCHED_TO_DELIVERED_HOURS = 48;
  const SLA_SORTED_TO_DISPATCHED_HOURS = 24;

  const dispatchedStaleThreshold = new Date(Date.now() - SLA_DISPATCHED_TO_DELIVERED_HOURS * 60 * 60 * 1000);
  const sortedStaleThreshold = new Date(Date.now() - SLA_SORTED_TO_DISPATCHED_HOURS * 60 * 60 * 1000);

  let staleDispatchedParcelsCount = 0;
  let staleSortedParcelsCount = 0;

  // 2.1. Parcels dispatched but not delivered within SLA
  const staleDispatchedParcels = await prisma.lclParcel.findMany({
    where: {
      status: 'dispatched',
      waybillId: { not: null }, // Only consolidated parcels
      lastScannedAt: { lte: dispatchedStaleThreshold },
    },
    include: {
      waybill: {
        include: {
          booking: {
            select: {
              id: true,
              reference: true,
              agencyId: true,
            }
          }
        }
      },
      warehouse: { // Assuming lclParcel has a relation named 'warehouse' to WarehousePartner
        select: {
          id: true,
          name: true,
          agencyId: true, // Assuming WarehousePartner has agencyId
        }
      }
    }
  });

  for (const parcel of staleDispatchedParcels) {
    logger.warn(`LOSS DETECTION: Dispatched parcel ${parcel.reference} (Waybill ${parcel.waybill?.reference}) stale for >${SLA_DISPATCHED_TO_DELIVERED_HOURS}h`);
    const alertAgencyId = parcel.waybill?.booking?.agencyId || parcel.warehouse?.agencyId;

    await alertService.createAlert({
      type: 'DELAYED_PARCEL',
      severity: 'high',
      message: `Parcel ${parcel.reference} (Waybill: ${parcel.waybill?.reference}) dispatched but not delivered. Last scan: ${parcel.lastScannedAt?.toISOString() || 'N/A'}.`,
      agencyId: alertAgencyId,
      entityType: 'lclParcel',
      entityId: parcel.id,
      metadata: {
        parcelRef: parcel.reference,
        waybillRef: parcel.waybill?.reference,
      }
    });
    staleDispatchedParcelsCount++;
  }

  // 2.2. Parcels sorted but not dispatched within SLA
  const staleSortedParcels = await prisma.lclParcel.findMany({
    where: {
      status: 'sorted',
      waybillId: { not: null }, // Only consolidated parcels
      lastScannedAt: { lte: sortedStaleThreshold },
    },
    include: {
      waybill: { include: { booking: { select: { agencyId: true } } } },
      warehouse: { select: { agencyId: true } }
    }
  });

  for (const parcel of staleSortedParcels) {
    logger.warn(`LOSS DETECTION: Sorted parcel ${parcel.reference} (Waybill ${parcel.waybill?.reference}) stale for >${SLA_SORTED_TO_DISPATCHED_HOURS}h`);
    const alertAgencyId = parcel.waybill?.booking?.agencyId || parcel.warehouse?.agencyId;

    await alertService.createAlert({
      type: 'MISSING_PARCEL',
      severity: 'medium',
      message: `Parcel ${parcel.reference} (Waybill: ${parcel.waybill?.reference}) sorted but not dispatched. Last scan: ${parcel.lastScannedAt?.toISOString() || 'N/A'}.`,
      agencyId: alertAgencyId,
      entityType: 'lclParcel',
      entityId: parcel.id,
      metadata: {
        parcelRef: parcel.reference,
        waybillRef: parcel.waybill?.reference,
      }
    });
    staleSortedParcelsCount++;
  }

  return {
    staleTripsCount: staleTrips.length,
    staleDispatchedParcelsCount,
    staleSortedParcelsCount,
  };
}, {
  connection: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  }
});

lossDetectionWorker.on('failed', (job, err) => {
  logger.error(`Loss Detection Job ${job.id} failed`, err);
});