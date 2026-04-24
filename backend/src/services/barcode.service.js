const prisma = require('../utils/prisma');

/**
 * Barcode & Scan Service
 * Enforces PRD §12 — No Scan = No Movement
 * PRD §12.2 — Every parcel must be linked to a Waybill (PTL/Courier) or LR (FTL)
 */

const SCAN_TYPES = {
  PICKUP: 'pickup',
  WH_ENTRY: 'warehouse_entry',
  STORAGE: 'storage',
  DISPATCH: 'dispatch',
  DELIVERY: 'delivery',
  RETURN_RECEIVE: 'return_receive',
};

/**
 * Validates a barcode scan and updates the relevant entity state.
 */
const validateAndProcessScan = async (params) => {
  const { barcode, scanType, userId, bookingId, inventoryId, parcelId, lat, lng, deviceId } = params;

  if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
    throw new Error('Valid barcode is required');
  }

  const timestamp = new Date();
  let updatedEntity = null;

  // PRD §11 & §12: Resolve LCL Parcel if barcode starts with 'PX' (reference) or parcelId provided
  let parcel = null;
  if (parcelId) {
    parcel = await prisma.lclParcel.findUnique({ where: { id: parcelId } });
  } else if (barcode.startsWith('PX')) {
    parcel = await prisma.lclParcel.findUnique({ where: { reference: barcode } });
  }

  // PRD §11 & §12: Parcel States & Scan points
  // received → stored → sorted → dispatched → delivered

  if ([SCAN_TYPES.WH_ENTRY, SCAN_TYPES.STORAGE, SCAN_TYPES.DISPATCH, SCAN_TYPES.RETURN_RECEIVE].includes(scanType)) {
    if (parcel) {
      const parcelStatusMap = {
        [SCAN_TYPES.WH_ENTRY]: 'received',
        [SCAN_TYPES.STORAGE]: 'stored',
        [SCAN_TYPES.DISPATCH]: 'dispatched',
        [SCAN_TYPES.RETURN_RECEIVE]: 'warehouse_received',
      };

      // PRD §12.2 Enforcement: Cannot dispatch parcel without Waybill linkage
      if (scanType === SCAN_TYPES.DISPATCH && !parcel.waybillId) {
        throw new Error('Cannot dispatch parcel: Assign to a Waybill/LR first (PRD §12.2)');
      }

      updatedEntity = await prisma.lclParcel.update({
        where: { id: parcel.id },
        data: {
          status: parcelStatusMap[scanType] || parcel.status,
          lastScannedAt: timestamp,
          lastScanType: scanType,
          lastScanBy: userId,
          lastScanLat: lat ? Number(lat) : null,
          lastScanLng: lng ? Number(lng) : null,
          lastScanDeviceId: deviceId || 'unknown'
        }
      });
    } else {
      if (!inventoryId) throw new Error('Inventory ID or Parcel reference is required for warehouse scan points');
      
      updatedEntity = await prisma.inventoryRecord.update({
        where: { id: inventoryId },
        data: {
          // Update tracking info and metadata for audit/loss detection (PRD §13)
          lastScannedAt: timestamp,
          lastScanType: scanType,
          lastScanBy: userId,
          lastScanLat: lat ? Number(lat) : null,
          lastScanLng: lng ? Number(lng) : null,
          lastScanDeviceId: deviceId || 'unknown'
        }
      });
    }
  } else if ([SCAN_TYPES.PICKUP, SCAN_TYPES.DELIVERY].includes(scanType)) {
    if (parcel) {
      updatedEntity = await prisma.lclParcel.update({
        where: { id: parcel.id },
        data: {
          status: scanType === SCAN_TYPES.PICKUP ? 'in_transit' : 'delivered',
          lastScannedAt: timestamp,
          lastScanBy: userId,
          lastScanLat: lat ? Number(lat) : null,
          lastScanLng: lng ? Number(lng) : null,
        }
      });
      // If only validating parcel scan without booking context, return early
      if (!bookingId) return { success: true, timestamp, entity: updatedEntity };
    }

    // PRD §44.5 — Handle return scan logic for bookings
    if (scanType === SCAN_TYPES.RETURN_RECEIVE && bookingId) {
      const currentBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
      updatedEntity = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'warehouse_received',
          specialInstructions: `${currentBooking.specialInstructions || ''}\n[SCAN] Received back at warehouse: ${timestamp.toISOString()}`
        }
      });
      return { success: true, timestamp, entity: updatedEntity };
    }

    if (!bookingId) throw new Error('Booking ID is required for transport scan points');
    
    const statusMap = {
      [SCAN_TYPES.PICKUP]: 'picked_up',
      [SCAN_TYPES.DELIVERY]: 'delivered',
    };

    updatedEntity = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: statusMap[scanType],
        ...(scanType === SCAN_TYPES.PICKUP ? { pickedUpAt: timestamp } : { deliveredAt: timestamp }),
      }
    });
  }

  return {
    success: true,
    timestamp,
    entity: updatedEntity
  };
};

module.exports = {
  SCAN_TYPES,
  validateAndProcessScan,
};