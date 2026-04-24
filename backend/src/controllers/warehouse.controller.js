const prisma = require('../utils/prisma');
const { success, created, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { ROLES } = require('../middleware/auth');
const barcodeService = require('../services/barcode.service');

const STORAGE_TYPES = new Set(['dry', 'cold', 'bonded', 'open_yard', 'hazmat', 'rack']);
const TERMINAL_STORAGE_BOOKING_STATUSES = new Set(['cancelled', 'completed', 'closed']);

const isWarehouseAdmin = (role) => [
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS_ADMIN,
  ROLES.FINANCE_ADMIN,
].includes(role);

const parseDecimal = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getBookingDays = (startDate, endDate) => {
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const resolveWarehousePartner = async (req) => {
  if (req.user.role !== ROLES.WAREHOUSE_PARTNER) return null;
  return prisma.warehousePartner.findUnique({
    where: { userId: req.user.id },
  });
};

const getScopedPartnerId = async (req, res) => {
  if (req.user.role !== ROLES.WAREHOUSE_PARTNER) {
    return req.body.partner_id || req.query.partner_id || null;
  }

  const partner = await resolveWarehousePartner(req);
  if (!partner) {
    error(res, 404, 'WAREHOUSE_PARTNER_NOT_FOUND', 'Warehouse partner profile not found.');
    return null;
  }

  return partner.id;
};

const buildSpaceWhere = (req, partnerId = null) => {
  const where = {};

  if (partnerId) where.partnerId = partnerId;

  if (req.query.storage_type) {
    where.storageType = req.query.storage_type;
  }

  if (req.query.is_available !== undefined) {
    where.isAvailable = req.query.is_available === 'true';
  }

  return where;
};

const buildStorageBookingWhere = async (req, res) => {
  const where = {};

  if (req.user.role === ROLES.CUSTOMER) {
    where.customerId = req.user.id;
  } else if (req.user.role === ROLES.WAREHOUSE_PARTNER) {
    const partnerId = await getScopedPartnerId(req, res);
    if (!partnerId) return null;
    where.partnerId = partnerId;
  } else if (req.query.partner_id) {
    where.partnerId = req.query.partner_id;
  }

  if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.customer_id && req.user.role !== ROLES.CUSTOMER) {
    where.customerId = req.query.customer_id;
  }

  if (req.query.space_id) {
    where.spaceId = req.query.space_id;
  }

  return where;
};

const buildInventoryWhere = async (req, res) => {
  const where = {};

  if (req.user.role === ROLES.CUSTOMER) {
    where.booking = {
      is: {
        customerId: req.user.id,
      },
    };
  } else if (req.user.role === ROLES.WAREHOUSE_PARTNER) {
    const partnerId = await getScopedPartnerId(req, res);
    if (!partnerId) return null;
    where.booking = {
      is: {
        partnerId,
      },
    };
  }

  if (req.query.storage_booking_id) {
    where.storageBookingId = req.query.storage_booking_id;
  }

  if (req.query.sku) {
    where.sku = {
      contains: req.query.sku,
      mode: 'insensitive',
    };
  }

  return where;
};

exports.getDashboard = async (req, res) => {
  try {
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const partnerWhere = partnerId ? { id: partnerId } : {};
    const bookingWhere = partnerId ? { partnerId } : {};
    const inventoryWhere = partnerId ? { booking: { is: { partnerId } } } : {};

    const [totalPartners, totalSpaces, availableSpaces, totalBookings, activeBookings, inventoryRecords] =
      await prisma.$transaction([
        prisma.warehousePartner.count({ where: partnerWhere }),
        prisma.warehouseSpace.count({ where: partnerId ? { partnerId } : {} }),
        prisma.warehouseSpace.count({ where: partnerId ? { partnerId, isAvailable: true } : { isAvailable: true } }),
        prisma.storageBooking.count({ where: bookingWhere }),
        prisma.storageBooking.count({
          where: {
            ...bookingWhere,
            status: { notIn: Array.from(TERMINAL_STORAGE_BOOKING_STATUSES) },
          },
        }),
        prisma.inventoryRecord.count({ where: inventoryWhere }),
      ]);

    return success(res, {
      totalPartners,
      totalSpaces,
      availableSpaces,
      totalBookings,
      activeBookings,
      inventoryRecords,
    }, 'Warehouse dashboard retrieved');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

// ── Barcode / Scanning — PRD §12 ──────────────────────────────────────────────

/**
 * Process a barcode scan event at a warehouse checkpoint.
 * Enforces "No Scan = No Movement" rule.
 * POST /api/v1/warehouse/scan
 */
exports.handleScan = async (req, res) => {
  try {
    const { barcode, scan_type, booking_id, inventory_id, lat, lng, device_id } = req.body;

    if (!barcode || !scan_type) {
      return error(res, 422, 'VALIDATION_ERROR', 'barcode and scan_type are required.');
    }

    // Validate scan type against allowed warehouse types
    const validWhTypes = [
      barcodeService.SCAN_TYPES.WH_ENTRY,
      barcodeService.SCAN_TYPES.STORAGE,
      barcodeService.SCAN_TYPES.DISPATCH
    ];

    if (!validWhTypes.includes(scan_type)) {
      return error(res, 422, 'VALIDATION_ERROR', `Invalid scan type for warehouse operations: ${scan_type}`);
    }

    // PRD §12 — Offline scanning with sync-on-reconnect handled via scan timestamps
    const result = await barcodeService.validateAndProcessScan({
      barcode,
      scanType: scan_type,
      userId: req.user.id,
      bookingId: booking_id,
      inventoryId: inventory_id,
      lat, lng,
      deviceId: device_id
    });

    if (req.auditLog) await req.auditLog('BARCODE_SCANNED', { scan_type, barcode, inventory_id });

    return success(res, result, 'Scan processed successfully');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getSpaces = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const where = buildSpaceWhere(req, partnerId);

    const [count, rows] = await prisma.$transaction([
      prisma.warehouseSpace.count({ where }),
      prisma.warehouseSpace.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { isAvailable: 'desc' },
          { zoneName: 'asc' },
        ],
        include: {
          partner: {
            select: { id: true, name: true, userId: true },
          },
        },
      }),
    ]);

    return success(res, rows, 'Warehouse spaces retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.createSpace = async (req, res) => {
  try {
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const ratePerUnit = parseDecimal(req.body.rate_per_unit);
    if (!partnerId || !req.body.zone_name || !req.body.storage_type || ratePerUnit === null) {
      return error(res, 422, 'VALIDATION_ERROR', 'partner_id, zone_name, storage_type, and rate_per_unit are required.');
    }

    if (!STORAGE_TYPES.has(req.body.storage_type)) {
      return error(res, 422, 'VALIDATION_ERROR', 'storage_type is invalid.');
    }

    const partner = await prisma.warehousePartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner) {
      return error(res, 404, 'WAREHOUSE_PARTNER_NOT_FOUND', 'Warehouse partner not found.');
    }

    const space = await prisma.warehouseSpace.create({
      data: {
        partnerId,
        zoneName: req.body.zone_name,
        storageType: req.body.storage_type,
        ratePerUnit,
        isAvailable: req.body.is_available !== undefined ? req.body.is_available === true || req.body.is_available === 'true' : true,
      },
      include: {
        partner: {
          select: { id: true, name: true },
        },
      },
    });

    if (req.auditLog) {
      await req.auditLog('WAREHOUSE_SPACE_CREATED', {
        warehouse_space_id: space.id,
        partner_id: partnerId,
        by: req.user.id,
      });
    }

    return created(res, { space }, 'Warehouse space created');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getSpaceById = async (req, res) => {
  try {
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const where = { id: req.params.id };
    if (partnerId) where.partnerId = partnerId;

    const space = await prisma.warehouseSpace.findFirst({
      where,
      include: {
        partner: { select: { id: true, name: true } },
        bookings: {
          select: {
            id: true,
            status: true,
            customerRate: true,
            startDate: true,
            endDate: true,
            customer: {
              select: { id: true, full_name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!space) {
      return error(res, 404, 'WAREHOUSE_SPACE_NOT_FOUND', 'Warehouse space not found.');
    }

    return success(res, { space }, 'Warehouse space retrieved');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateSpace = async (req, res) => {
  try {
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const where = { id: req.params.id };
    if (partnerId) where.partnerId = partnerId;

    const existing = await prisma.warehouseSpace.findFirst({ where });
    if (!existing) {
      return error(res, 404, 'WAREHOUSE_SPACE_NOT_FOUND', 'Warehouse space not found.');
    }

    const updates = {};
    if (req.body.zone_name !== undefined) updates.zoneName = req.body.zone_name;
    if (req.body.storage_type !== undefined) {
      if (!STORAGE_TYPES.has(req.body.storage_type)) {
        return error(res, 422, 'VALIDATION_ERROR', 'storage_type is invalid.');
      }
      updates.storageType = req.body.storage_type;
    }
    if (req.body.rate_per_unit !== undefined) {
      const ratePerUnit = parseDecimal(req.body.rate_per_unit);
      if (ratePerUnit === null) {
        return error(res, 422, 'VALIDATION_ERROR', 'rate_per_unit must be numeric.');
      }
      updates.ratePerUnit = ratePerUnit;
    }
    if (req.body.is_available !== undefined) {
      updates.isAvailable = req.body.is_available === true || req.body.is_available === 'true';
    }

    const space = await prisma.warehouseSpace.update({
      where: { id: existing.id },
      data: updates,
      include: {
        partner: { select: { id: true, name: true } },
      },
    });

    if (req.auditLog) {
      await req.auditLog('WAREHOUSE_SPACE_UPDATED', {
        warehouse_space_id: space.id,
        by: req.user.id,
        updates,
      });
    }

    return success(res, { space }, 'Warehouse space updated');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getStorageBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = await buildStorageBookingWhere(req, res);
    if (!where) return;

    const [count, rows] = await prisma.$transaction([
      prisma.storageBooking.count({ where }),
      prisma.storageBooking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, phone: true, email: true } },
          partner: { select: { id: true, name: true } },
          space: { select: { id: true, zoneName: true, storageType: true, ratePerUnit: true } },
          inventory: {
            select: { id: true, sku: true, quantityCurrent: true },
          },
        },
      }),
    ]);

    return success(res, rows, 'Storage bookings retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.createStorageBooking = async (req, res) => {
  try {
    const partnerId = await getScopedPartnerId(req, res);
    if (req.user.role === ROLES.WAREHOUSE_PARTNER && !partnerId) return;

    const customerId = req.user.role === ROLES.CUSTOMER ? req.user.id : req.body.customer_id;
    const resolvedPartnerId = req.user.role === ROLES.WAREHOUSE_PARTNER ? partnerId : (req.body.partner_id || partnerId);
    const startDate = parseDate(req.body.start_date);
    const endDate = parseDate(req.body.end_date);

    if (!customerId || !resolvedPartnerId || !req.body.space_id || !startDate || !endDate) {
      return error(res, 422, 'VALIDATION_ERROR', 'customer_id, partner_id, space_id, start_date, and end_date are required.');
    }

    if (endDate < startDate) {
      return error(res, 422, 'VALIDATION_ERROR', 'end_date must be on or after start_date.');
    }

    const [customer, partner, space] = await prisma.$transaction([
      prisma.user.findUnique({ where: { id: customerId } }),
      prisma.warehousePartner.findUnique({ where: { id: resolvedPartnerId } }),
      prisma.warehouseSpace.findUnique({ where: { id: req.body.space_id } }),
    ]);

    if (!customer) {
      return error(res, 404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
    }
    if (!partner) {
      return error(res, 404, 'WAREHOUSE_PARTNER_NOT_FOUND', 'Warehouse partner not found.');
    }
    if (!space || space.partnerId !== resolvedPartnerId) {
      return error(res, 404, 'WAREHOUSE_SPACE_NOT_FOUND', 'Warehouse space not found for this partner.');
    }
    if (!space.isAvailable) {
      return error(res, 409, 'WAREHOUSE_SPACE_UNAVAILABLE', 'Warehouse space is not available.');
    }

    const computedRate = parseDecimal(req.body.customer_rate);
    const customerRate = computedRate !== null
      ? computedRate
      : Number(space.ratePerUnit) * getBookingDays(startDate, endDate);

    const [booking] = await prisma.$transaction([
      prisma.storageBooking.create({
        data: {
          customerId,
          partnerId: resolvedPartnerId,
          spaceId: req.body.space_id,
          status: req.body.status || 'pending',
          customerRate,
          startDate,
          endDate,
        },
        include: {
          customer: { select: { id: true, full_name: true, phone: true } },
          partner: { select: { id: true, name: true } },
          space: { select: { id: true, zoneName: true, storageType: true } },
        },
      }),
      prisma.warehouseSpace.update({
        where: { id: req.body.space_id },
        data: { isAvailable: false },
      }),
    ]);

    if (req.auditLog) {
      await req.auditLog('STORAGE_BOOKING_CREATED', {
        storage_booking_id: booking.id,
        partner_id: resolvedPartnerId,
        customer_id: customerId,
        by: req.user.id,
      });
    }

    return created(res, { booking }, 'Storage booking created');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getStorageBookingById = async (req, res) => {
  try {
    const where = await buildStorageBookingWhere(req, res);
    if (!where) return;

    where.id = req.params.id;

    const booking = await prisma.storageBooking.findFirst({
      where,
      include: {
        customer: { select: { id: true, full_name: true, phone: true, email: true } },
        partner: { select: { id: true, name: true, businessReg: true } },
        space: { select: { id: true, zoneName: true, storageType: true, ratePerUnit: true } },
        inventory: true,
      },
    });

    if (!booking) {
      return error(res, 404, 'STORAGE_BOOKING_NOT_FOUND', 'Storage booking not found.');
    }

    return success(res, { booking }, 'Storage booking retrieved');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateStorageBookingStatus = async (req, res) => {
  try {
    const where = await buildStorageBookingWhere(req, res);
    if (!where) return;

    where.id = req.params.id;

    const booking = await prisma.storageBooking.findFirst({
      where,
      include: {
        space: true,
      },
    });

    if (!booking) {
      return error(res, 404, 'STORAGE_BOOKING_NOT_FOUND', 'Storage booking not found.');
    }
    if (!req.body.status) {
      return error(res, 422, 'VALIDATION_ERROR', 'status is required.');
    }

    const updates = { status: req.body.status };

    const [updated] = await prisma.$transaction([
      prisma.storageBooking.update({
        where: { id: booking.id },
        data: updates,
        include: {
          customer: { select: { id: true, full_name: true } },
          partner: { select: { id: true, name: true } },
          space: { select: { id: true, zoneName: true, storageType: true } },
        },
      }),
      prisma.warehouseSpace.update({
        where: { id: booking.spaceId },
        data: { isAvailable: TERMINAL_STORAGE_BOOKING_STATUSES.has(req.body.status) },
      }),
    ]);

    if (req.auditLog) {
      await req.auditLog('STORAGE_BOOKING_STATUS_UPDATED', {
        storage_booking_id: booking.id,
        by: req.user.id,
        status: req.body.status,
      });
    }

    return success(res, { booking: updated }, 'Storage booking status updated');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getInventoryRecords = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = await buildInventoryWhere(req, res);
    if (!where) return;

    const [count, rows] = await prisma.$transaction([
      prisma.inventoryRecord.count({ where }),
      prisma.inventoryRecord.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { sku: 'asc' },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              customerId: true,
              partnerId: true,
              customer: { select: { id: true, full_name: true } },
              partner: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return success(res, rows, 'Inventory records retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.getInventoryRecordById = async (req, res) => {
  try {
    const where = await buildInventoryWhere(req, res);
    if (!where) return;

    where.id = req.params.id;

    const record = await prisma.inventoryRecord.findFirst({
      where,
      include: {
        booking: {
          include: {
            customer: { select: { id: true, full_name: true, phone: true } },
            partner: { select: { id: true, name: true } },
            space: { select: { id: true, zoneName: true, storageType: true } },
          },
        },
      },
    });

    if (!record) {
      return error(res, 404, 'INVENTORY_RECORD_NOT_FOUND', 'Inventory record not found.');
    }

    return success(res, { record }, 'Inventory record retrieved');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.createInventoryRecord = async (req, res) => {
  try {
    const quantityCurrent = parseDecimal(req.body.quantity_current);
    if (!req.body.sku || quantityCurrent === null) {
      return error(res, 422, 'VALIDATION_ERROR', 'sku and quantity_current are required.');
    }

    const bookingWhere = await buildStorageBookingWhere(req, res);
    if (!bookingWhere) return;
    bookingWhere.id = req.params.id;

    const booking = await prisma.storageBooking.findFirst({
      where: bookingWhere,
    });

    if (!booking) {
      return error(res, 404, 'STORAGE_BOOKING_NOT_FOUND', 'Storage booking not found.');
    }

    const record = await prisma.inventoryRecord.create({
      data: {
        storageBookingId: booking.id,
        sku: req.body.sku,
        quantityCurrent,
        grnPhotoUrl: req.body.grn_photo_url || null,
      },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            customerId: true,
            partnerId: true,
          },
        },
      },
    });

    if (req.auditLog) {
      await req.auditLog('INVENTORY_RECORD_CREATED', {
        inventory_record_id: record.id,
        storage_booking_id: booking.id,
        by: req.user.id,
      });
    }

    return created(res, { record }, 'Inventory record created');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};

exports.updateInventoryRecord = async (req, res) => {
  try {
    const where = await buildInventoryWhere(req, res);
    if (!where) return;
    where.id = req.params.id;

    const existing = await prisma.inventoryRecord.findFirst({
      where,
    });

    if (!existing) {
      return error(res, 404, 'INVENTORY_RECORD_NOT_FOUND', 'Inventory record not found.');
    }

    const updates = {};
    if (req.body.sku !== undefined) updates.sku = req.body.sku;
    if (req.body.quantity_current !== undefined) {
      const quantityCurrent = parseDecimal(req.body.quantity_current);
      if (quantityCurrent === null) {
        return error(res, 422, 'VALIDATION_ERROR', 'quantity_current must be numeric.');
      }
      updates.quantityCurrent = quantityCurrent;
    }
    if (req.body.grn_photo_url !== undefined) updates.grnPhotoUrl = req.body.grn_photo_url;

    const record = await prisma.inventoryRecord.update({
      where: { id: existing.id },
      data: updates,
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            customerId: true,
            partnerId: true,
          },
        },
      },
    });

    if (req.auditLog) {
      await req.auditLog('INVENTORY_RECORD_UPDATED', {
        inventory_record_id: record.id,
        by: req.user.id,
        updates,
      });
    }

    return success(res, { record }, 'Inventory record updated');
  } catch (err) {
    return error(res, 500, 'SERVER_ERROR', err.message);
  }
};
