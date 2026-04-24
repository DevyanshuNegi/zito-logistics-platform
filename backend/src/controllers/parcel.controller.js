// src/controllers/parcel.controller.js
// PRD §1 — PTL / LCL (Partial Load) consolidated cargo shipments
// PRD §11 — Inventory System & Parcel States
// PRD §12 — Barcode & Scan System Enforcement

const prisma = require('../utils/prisma');
const { success, error, created } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { generateUuidReference } = require('../utils/id');

/**
 * List LCL/PTL parcels with consolidation filters
 * GET /api/v1/parcels
 */
exports.listParcels = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, waybill_id, customer_id, warehouse_id } = req.query;

    const where = {};
    if (status) where.status = status;
    if (waybill_id) where.waybillId = waybill_id;
    if (customer_id) where.customerId = customer_id;
    if (warehouse_id) where.warehouseId = warehouse_id;

    // Role-based scoping (PRD §25.1)
    if (req.user.role === 'customer') where.customerId = req.user.id;

    const [count, rows] = await prisma.$transaction([
      prisma.lclParcel.count({ where }),
      prisma.lclParcel.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true } },
          waybill: { select: { id: true, reference: true } }
        }
      })
    ]);

    return success(res, rows, 'Parcels retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Register a new parcel for consolidation
 * POST /api/v1/parcels
 */
exports.createParcel = async (req, res) => {
  try {
    const { customer_id, weight, dimensions, cargo_description, warehouse_id } = req.body;

    const parcel = await prisma.lclParcel.create({
      data: {
        reference: generateUuidReference('PX'),
        customerId: customer_id,
        warehouseId: warehouse_id,
        weight: parseFloat(weight),
        dimensions,
        cargoDescription: cargo_description,
        status: 'received' // PRD §11 starting state
      }
    });

    if (req.auditLog) {
      await req.auditLog('PARCEL_REGISTERED', { parcel_id: parcel.id, customer_id });
    }

    return created(res, { parcel }, 'Parcel registered for consolidation');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Consolidate multiple parcels into a Waybill (PTL/LCL Logic)
 * POST /api/v1/parcels/consolidate
 */
exports.consolidateParcels = async (req, res) => {
  try {
    const { parcel_ids, waybill_id } = req.body;

    if (!Array.isArray(parcel_ids) || !waybill_id) {
      return error(res, 'VALIDATION_ERROR', 'parcel_ids (array) and waybill_id are required', 422);
    }

    // PRD §12.2 — Link parcels to Waybill
    const updated = await prisma.lclParcel.updateMany({
      where: { id: { in: parcel_ids } },
      data: { 
        waybillId: waybill_id,
        status: 'sorted' // Transitions to sorted once assigned to a waybill
      }
    });

    if (req.auditLog) {
      await req.auditLog('PARCELS_CONSOLIDATED', { waybill_id, count: updated.count });
    }

    return success(res, { count: updated.count }, 'Parcels consolidated into waybill');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Update parcel status with scan validation
 * PATCH /api/v1/parcels/:id/status
 */
exports.updateParcelStatus = async (req, res) => {
  try {
    const { status, barcode_scanned } = req.body;
    
    // PRD §12 Core Rule: No scan = No movement
    if (!barcode_scanned) {
      return error(res, 'SCAN_REQUIRED', 'Physical barcode scan required for state transition', 422);
    }

    const parcel = await prisma.lclParcel.findUnique({ where: { id: req.params.id } });
    if (!parcel) return error(res, 'NOT_FOUND', 'Parcel not found', 404);

    const updated = await prisma.lclParcel.update({
      where: { id: parcel.id },
      data: { status }
    });

    if (req.auditLog) {
      await req.auditLog('PARCEL_STATUS_UPDATED', { parcel_id: parcel.id, from: parcel.status, to: status });
    }

    return success(res, { parcel: updated }, `Parcel marked as ${status}`);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Get individual parcel tracking history
 */
exports.getParcelById = async (req, res) => {
  try {
    const parcel = await prisma.lclParcel.findUnique({
      where: { id: req.params.id },
      include: { waybill: true, customer: true }
    });
    if (!parcel) return error(res, 'NOT_FOUND', 'Parcel not found', 404);
    return success(res, { parcel });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};