// src/controllers/vehicle.controller.js
// PRD §5.1 — Admin Fleet Management
// PRD §14.7 — Vehicle Compliance
// PRD §18.2 — Vehicle Assignment Validation

const prisma = require('../utils/prisma');
const { success, created, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

exports.getVehicles = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = {};
    if (req.scope && !req.scope.isAdmin && req.scope.transporter_id) {
      where.transporterId = req.scope.transporter_id;
    }
    const { vehicle_type, is_verified, is_active } = req.query;
    if (vehicle_type) where.vehicleType = vehicle_type;
    if (is_verified  !== undefined) where.isVerified = is_verified  === 'true';
    if (is_active    !== undefined) where.isActive   = is_active    === 'true';

    const [count, rows] = await prisma.$transaction([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return success(res, rows, 'Vehicles retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: { currentDriver: true }
    });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.registerVehicle = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      transporterId: req.user.role === 'transporter' ? req.user.id : req.body.transporter_id,
      ownerUserId:  req.user.id,
      plateNumber: req.body.plate_number,
      vehicleType: req.body.vehicle_type,
    };

    const vehicle = await prisma.vehicle.create({
      data: payload
    });
    if (req.auditLog) await req.auditLog('VEHICLE_REGISTERED', { vehicle_id: vehicle.id, by: req.user.id });
    return created(res, { vehicle }, 'Vehicle registered');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    
    const updates = { ...req.body };
    if (req.body.plate_number) updates.plateNumber = req.body.plate_number;
    if (req.body.vehicle_type) updates.vehicleType = req.body.vehicle_type;
    delete updates.plate_number;
    delete updates.vehicle_type;

    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: updates
    });
    return success(res, { vehicle: updated });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.retireVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { isActive: false, deletedAt: new Date() }
    });

    if (req.auditLog) await req.auditLog('VEHICLE_RETIRED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { message: 'Vehicle retired' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    const updates = {
      insuranceCert: req.body.insurance_cert,
      insuranceExpiry: req.body.insurance_expiry ? new Date(req.body.insurance_expiry) : null,
      ntsaCertUrl: req.body.ntsa_cert_url,
      ntsaExpiry: req.body.ntsa_expiry ? new Date(req.body.ntsa_expiry) : null,
      inspectionCertUrl: req.body.inspection_cert_url,
      inspectionExpiry: req.body.inspection_expiry ? new Date(req.body.inspection_expiry) : null,
      logbookUrl: req.body.logbook_url,
      isAssignmentBlocked: true,
      blockReason: 'Document re-upload: Awaiting verification',
      insuranceVerified: false,
      ntsaVerified: false,
      inspectionVerified: false,
      logbookVerified: false,
      isVerified: false,
    };

    // Any document change reverts verification until reviewed.
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: updates
    });

    if (req.auditLog) {
      await req.auditLog('VEHICLE_DOCUMENTS_UPLOADED', {
        vehicle_id: updated.id,
        by: req.user.id,
        fields: Object.keys(updates),
      });
    }
    return success(res, { vehicle: updated }, 'Vehicle documents submitted for verification');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Expiring documents (admin/ops view) ──
// GET /api/v1/vehicle/expiring?days=30
exports.getExpiringDocuments = async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const now = new Date();
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { insuranceExpiry: { not: null, lte: cutoff } },
          { ntsaExpiry: { not: null, lte: cutoff } },
          { inspectionExpiry: { not: null, lte: cutoff } },
        ]
      },
      orderBy: { insuranceExpiry: 'asc' },
      select: {
        id: true, plateNumber: true, vehicleType: true, transporterId: true,
        insuranceExpiry: true, ntsaExpiry: true, inspectionExpiry: true,
        insuranceVerified: true, ntsaVerified: true, inspectionVerified: true,
        isAssignmentBlocked: true, blockReason: true
      },
    });

    return success(res, { now, cutoff, vehicles }, 'Expiring documents retrieved');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
