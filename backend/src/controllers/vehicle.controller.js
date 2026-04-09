// src/controllers/vehicle.controller.js
// PRD §5.1 — Admin Fleet Management
// PRD §14.7 — Vehicle Compliance
// PRD §18.2 — Vehicle Assignment Validation

const { Vehicle, Driver, User } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

exports.getVehicles = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = {};
    if (req.scope && !req.scope.isAdmin && req.scope.transporter_id) {
      where.transporter_id = req.scope.transporter_id;
    }
    const { vehicle_type, is_verified, is_active } = req.query;
    if (vehicle_type) where.vehicle_type = vehicle_type;
    if (is_verified  !== undefined) where.is_verified = is_verified  === 'true';
    if (is_active    !== undefined) where.is_active   = is_active    === 'true';

    const { count, rows } = await Vehicle.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id, {
      include: [{ model: Driver, as: 'current_driver' }],
    });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.registerVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.create({
      ...req.body,
      transporter_id: req.user.role === 'transporter' ? req.user.id : req.body.transporter_id,
      owner_user_id:  req.user.id,
    });
    if (req.auditLog) await req.auditLog('VEHICLE_REGISTERED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { vehicle }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    await vehicle.update(req.body);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.retireVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    await vehicle.update({ is_active: false });
    await vehicle.destroy();
    if (req.auditLog) await req.auditLog('VEHICLE_RETIRED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { message: 'Vehicle retired' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    const updates = {};
    const allowed = [
      'insurance_cert',
      'insurance_expiry',
      'ntsa_cert_url',
      'ntsa_expiry',
      'inspection_cert_url',
      'inspection_expiry',
      'logbook_url',
      'is_assignment_blocked',
      'block_reason',
    ];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Any document change reverts verification until reviewed.
    updates.insurance_verified = false;
    updates.ntsa_verified = false;
    updates.inspection_verified = false;
    updates.logbook_verified = false;
    updates.is_verified = false;
    updates.is_assignment_blocked = true;
    updates.block_reason = 'Awaiting document verification';

    await vehicle.update(updates);
    if (req.auditLog) {
      await req.auditLog('VEHICLE_DOCUMENTS_UPLOADED', {
        vehicle_id: vehicle.id,
        by: req.user.id,
        fields: Object.keys(updates),
      });
    }
    return success(res, { message: 'Vehicle documents submitted for verification', vehicle });
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

    const where = {
      [Op.or]: [
        { insurance_expiry:  { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: cutoff }] } },
        { ntsa_expiry:       { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: cutoff }] } },
        { inspection_expiry: { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: cutoff }] } },
      ],
    };

    const vehicles = await Vehicle.findAll({
      where,
      order: [['insurance_expiry', 'ASC']],
      attributes: [
        'id','plate_number','vehicle_type','transporter_id',
        'insurance_expiry','ntsa_expiry','inspection_expiry',
        'insurance_verified','ntsa_verified','inspection_verified',
        'is_assignment_blocked','block_reason'
      ],
    });

    return success(res, { now, cutoff, vehicles });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
