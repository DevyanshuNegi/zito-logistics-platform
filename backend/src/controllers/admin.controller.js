// PRD §5.1 — Admin Portal
// PRD §12 — Admin API endpoints
// PRD §25.4 — Admin Compliance & Approval APIs
// PRD §25.8 — Audit Log
// PRD §25.10 — Pagination

const { Op, QueryTypes }     = require('sequelize');
const { sequelize, User, Driver, Vehicle, Booking, Contract, AuditLog, DriverCompliance, SystemSetting } = require('../models');
const { success, error }   = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { ROLES, ADMIN_ROLES } = require('../middleware/auth');
const { autoAssignIfNeeded } = require('../services/assignment.service');
const { suggestDriversForBooking } = require('../services/assignment.service');
const { CustomerDriverRule } = require('../models');
const { notifyDriverAssignment } = require('../services/notification.service');
const { getIO } = require('../services/notification.service');

// ── Dashboard Stats ───────────────────────────────────────────────────────────
// GET /api/v1/admin/stats
// PRD §5.1 — KPI cards: Total Bookings, Active Bookings, Total Revenue, Pending Payments

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalBookings,
      activeBookings,
      pendingBookings,
      completedBookings,
      totalUsers,
      totalDrivers,
      availableDrivers,
      totalVehicles,
      pendingDriverApprovals,
      pendingTransporterApprovals,
    ] = await Promise.all([
      Booking.count(),
      Booking.count({ where: { status: ['assigned', 'accepted', 'picked_up', 'in_transit'] } }),
      Booking.count({ where: { status: 'pending' } }),
      Booking.count({ where: { status: 'completed' } }),
      User.count(),
      Driver.count(),
      Driver.count({ where: { is_available: true } }),
      Vehicle.count({ where: { is_active: true } }),
      User.count({ where: { role: ROLES.DRIVER, compliance_status: 'pending' } }),
      User.count({ where: { role: ROLES.TRANSPORTER, compliance_status: 'pending' } }),
    ]);

    return success(res, {
      bookings: {
        total:     totalBookings,
        active:    activeBookings,
        pending:   pendingBookings,
        completed: completedBookings,
      },
      users: {
        total:   totalUsers,
        drivers: totalDrivers,
        available_drivers: availableDrivers,
        vehicles: totalVehicles,
      },
      pending_approvals: {
        drivers:      pendingDriverApprovals,
        transporters: pendingTransporterApprovals,
        total:        pendingDriverApprovals + pendingTransporterApprovals,
      },
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── User Management ───────────────────────────────────────────────────────────
// GET /api/v1/admin/users
// PRD §5.1 — Create, edit, activate, deactivate users

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { role, compliance_status, is_active, search, verification_status } = req.query;

    const where = {};
    if (role)               where.role               = role;
    if (is_active !== undefined) where.is_active     = is_active === 'true';
    if (compliance_status)  where.compliance_status  = compliance_status;
    // support old frontend param
    if (verification_status) where.compliance_status = verification_status;
    if (search) {
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${search}%` } },
        { email:     { [Op.iLike]: `%${search}%` } },
        { phone:     { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password_hash'] },
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    console.error('getUsers error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Driver, as: 'driver_profile' }],
    });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createUser = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;
    if (!full_name || !email || !phone || !password) {
      return error(res, 'VALIDATION_ERROR', 'full_name, email, phone, password required', 422);
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already exists', 409);

    const user = await User.create({
      full_name, email, phone,
      password_hash: password,
      role: role || ROLES.CUSTOMER,
      compliance_status: [ROLES.DRIVER, ROLES.TRANSPORTER].includes(role) ? 'pending' : 'approved',
    });

    if (req.auditLog) await req.auditLog('USER_CREATED', { user_id: user.id, role: user.role, created_by: req.user.id });

    return success(res, { user: { id: user.id, email: user.email, role: user.role } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    const allowed = ['full_name', 'phone', 'role', 'is_active', 'transporter_id', 'agent_id', 'agency_id'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await user.update(updates);
    if (req.auditLog) await req.auditLog('USER_UPDATED', { user_id: user.id, updates, updated_by: req.user.id });

    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    // PRD §25.9 — soft delete
    await user.update({ is_deleted: true, is_active: false });
    await user.destroy(); // paranoid — sets deletedAt

    if (req.auditLog) await req.auditLog('USER_DELETED', { user_id: user.id, deleted_by: req.user.id });
    return success(res, { message: 'User deleted successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.activateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await user.update({ is_active: true });
    if (req.auditLog) await req.auditLog('USER_ACTIVATED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User activated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await user.update({ is_active: false });
    if (req.auditLog) await req.auditLog('USER_DEACTIVATED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User deactivated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Compliance — PRD §25.4 ────────────────────────────────────────────────────

exports.updateUserCompliance = async (req, res) => {
  try {
    const { compliance_status, reason } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    await user.update({
      compliance_status,
      approved_by: compliance_status === 'approved' ? req.user.id : null,
      rejected_by: compliance_status === 'rejected' ? req.user.id : null,
      rejection_reason: reason || null,
    });

    if (req.auditLog) await req.auditLog('USER_COMPLIANCE_UPDATED', { user_id: user.id, compliance_status, by: req.user.id });
    return success(res, { message: `Compliance status set to ${compliance_status}` });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.lockUserData = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await user.update({ data_locked: true });
    if (req.auditLog) await req.auditLog('USER_DATA_LOCKED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User data locked' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unlockUserData = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await user.update({ data_locked: false, compliance_status: 'resubmission_required' });
    if (req.auditLog) await req.auditLog('USER_DATA_UNLOCKED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User data unlocked — resubmission required' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Driver Management ─────────────────────────────────────────────────────────
// PRD §5.1, §25.4

exports.getDrivers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { is_available, is_blacklisted, compliance_status } = req.query;

    const userWhere = { role: ROLES.DRIVER };
    if (compliance_status) userWhere.compliance_status = compliance_status;

    const driverWhere = {};
    if (is_available   !== undefined) driverWhere.is_available   = is_available   === 'true';
    if (is_blacklisted !== undefined) driverWhere.is_blacklisted = is_blacklisted === 'true';

    const { count, rows } = await Driver.findAndCountAll({
      where: driverWhere,
      limit,
      offset,
      include: [{ model: User, as: 'user', where: userWhere, attributes: { exclude: ['password_hash'] } }],
      order: [['created_at', 'DESC']],
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id, {
      include: [
        { model: User,    as: 'user',    attributes: { exclude: ['password_hash'] } },
        { model: Vehicle, as: 'current_vehicle' },
        ...(DriverCompliance ? [{ model: DriverCompliance, as: 'compliance' }] : []),
      ],
    });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    return success(res, { driver });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// PRD §25.4 — Driver Compliance Endpoints
exports.approveDriver = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    await driver.update({ can_receive_assignments: true });
    await User.update(
      { compliance_status: 'approved', approved_by: req.user.id },
      { where: { id: driver.user_id } }
    );
    if (DriverCompliance) {
      await DriverCompliance.update(
        { compliance_status: 'approved', status_updated_at: new Date(), status_updated_by: req.user.id, approved_by: req.user.id, approved_at: new Date(), rejection_reason: null, resubmission_comment: null },
        { where: { driver_id: driver.id } }
      );
    }

    if (req.auditLog) await req.auditLog('DRIVER_APPROVED', { driver_id: driver.id, by: req.user.id });
    return success(res, { message: 'Driver approved successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.rejectDriver = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    await driver.update({ can_receive_assignments: false });
    await User.update(
      { compliance_status: 'rejected', rejected_by: req.user.id, rejection_reason: reason },
      { where: { id: driver.user_id } }
    );
    if (DriverCompliance) {
      await DriverCompliance.update(
        { compliance_status: 'rejected', status_updated_at: new Date(), status_updated_by: req.user.id, rejection_reason: reason },
        { where: { driver_id: driver.id } }
      );
    }

    if (req.auditLog) await req.auditLog('DRIVER_REJECTED', { driver_id: driver.id, reason, by: req.user.id });
    return success(res, { message: 'Driver rejected' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.requestDriverResubmit = async (req, res) => {
  try {
    const { comment } = req.body;
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    await User.update(
      { compliance_status: 'resubmission_required', data_locked: false, rejection_reason: comment },
      { where: { id: driver.user_id } }
    );
    if (DriverCompliance) {
      await DriverCompliance.update(
        { compliance_status: 'resubmission_required', status_updated_at: new Date(), status_updated_by: req.user.id, resubmission_comment: comment },
        { where: { driver_id: driver.id } }
      );
    }

    if (req.auditLog) await req.auditLog('DRIVER_RESUBMISSION_REQUESTED', { driver_id: driver.id, comment, by: req.user.id });
    return success(res, { message: 'Resubmission requested' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.blacklistDriver = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    await driver.update({
      is_blacklisted:          true,
      can_receive_assignments: false,
      blacklist_reason:        reason,
      blacklisted_by:          req.user.id,
      blacklisted_at:          new Date(),
    });

    if (req.auditLog) await req.auditLog('DRIVER_BLACKLISTED', { driver_id: driver.id, reason, by: req.user.id });
    return success(res, { message: 'Driver blacklisted' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unblacklistDriver = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    await driver.update({
      is_blacklisted:   false,
      blacklist_reason: null,
      blacklisted_by:   null,
      blacklisted_at:   null,
    });

    if (req.auditLog) await req.auditLog('DRIVER_UNBLACKLISTED', { driver_id: driver.id, by: req.user.id });
    return success(res, { message: 'Driver removed from blacklist' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Vehicle Management ────────────────────────────────────────────────────────
// PRD §5.1, §25.4

exports.getVehicles = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { vehicle_type, is_verified, is_active } = req.query;

    const where = {};
    if (vehicle_type) where.vehicle_type        = vehicle_type;
    if (is_verified  !== undefined) where.is_verified  = is_verified  === 'true';
    if (is_active    !== undefined) where.is_active     = is_active    === 'true';

    const { count, rows } = await Vehicle.findAndCountAll({
      where, limit, offset,
      order: [['created_at', 'DESC']],
    });

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

// PRD §25.4 — Vehicle Verification Endpoints
exports.verifyVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    await vehicle.update({
      is_verified:           true,
      is_approved:           true,
      is_assignment_blocked: false,
    });

    if (req.auditLog) await req.auditLog('VEHICLE_VERIFIED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { message: 'Vehicle verified' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.blockVehicle = async (req, res) => {
  try {
    const { reason } = req.body;
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    await vehicle.update({
      is_assignment_blocked: true,
      block_reason:          reason,
      blocked_by:            req.user.id,
    });

    if (req.auditLog) await req.auditLog('VEHICLE_BLOCKED', { vehicle_id: vehicle.id, reason, by: req.user.id });
    return success(res, { message: 'Vehicle blocked from assignments' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unblockVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    await vehicle.update({
      is_assignment_blocked: false,
      block_reason:          null,
      blocked_by:            null,
    });

    if (req.auditLog) await req.auditLog('VEHICLE_UNBLOCKED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { message: 'Vehicle unblocked' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Booking Management ────────────────────────────────────────────────────────
// PRD §5.1

exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, payment_status, vehicle_type, handled_by } = req.query;

    const where = {};
    if (status)         where.status         = status;
    if (payment_status) where.payment_status = payment_status;
    if (vehicle_type)   where.vehicle_type   = vehicle_type;
    if (handled_by)     where.handled_by     = handled_by;

    const { count, rows } = await Booking.findAndCountAll({
      where, limit, offset,
      order:   [['created_at', 'DESC']],
      include: [
        { model: User,   as: 'customer',    attributes: ['id', 'full_name', 'email', 'phone'] },
        { model: Driver, as: 'driver',      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        { model: Vehicle,as: 'vehicle',     attributes: ['id', 'plate_number', 'vehicle_type'] },
      ],
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: User,    as: 'customer', attributes: { exclude: ['password_hash'] } },
        { model: Driver,  as: 'driver',   include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }] },
        { model: Vehicle, as: 'vehicle' },
      ],
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    const ref = 'VG' + Date.now().toString(36).toUpperCase();
    const booking = await Booking.create({ ...req.body, reference: ref });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id, by: req.user.id });
    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    return success(res, { booking, auto_assignment: autoResult }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update(req.body);
    if (req.auditLog) await req.auditLog('BOOKING_UPDATED', { booking_id: booking.id, by: req.user.id });
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.assignDriver = async (req, res) => {
  try {
    const { driver_id, vehicle_id } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // PRD §18.1 — Driver assignment validation
    const driver = await Driver.findByPk(driver_id);
    if (!driver)                          return error(res, 'NOT_FOUND',                'Driver not found', 404);
    if (driver.is_blacklisted)            return error(res, 'DRIVER_BLACKLISTED',        'Driver is blacklisted', 400);
    if (!driver.can_receive_assignments)  return error(res, 'DRIVER_NOT_APPROVED',       'Driver compliance not approved', 403);
    if (!driver.is_available)             return error(res, 'DRIVER_UNAVAILABLE',        'Driver is not available', 400);

    // PRD §18.2 — Vehicle assignment validation
    if (vehicle_id) {
      const vehicle = await Vehicle.findByPk(vehicle_id);
      if (!vehicle)                      return error(res, 'NOT_FOUND',                  'Vehicle not found', 404);
      if (!vehicle.is_verified)          return error(res, 'VEHICLE_NOT_VERIFIED',        'Vehicle not verified', 400);
      if (vehicle.is_assignment_blocked) return error(res, 'VEHICLE_ASSIGNMENT_BLOCKED',  'Vehicle is blocked', 400);
      if (!vehicle.is_active)            return error(res, 'VEHICLE_INACTIVE',            'Vehicle is inactive', 400);
    }

    await booking.update({
      assigned_driver_id: driver_id,
      vehicle_id:         vehicle_id || booking.vehicle_id,
      status:             'assigned',
      assigned_at:        new Date(),
    });

    if (req.auditLog) await req.auditLog('BOOKING_ASSIGNED', { booking_id: booking.id, driver_id, vehicle_id, by: req.user.id });
    notifyDriverAssignment({ booking, driver_id }).catch(console.error);
    return success(res, { message: 'Driver assigned successfully', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.approveBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ status: 'approved', approved_at: new Date() });
    if (req.auditLog) await req.auditLog('BOOKING_APPROVED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Booking approved', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date() });
    if (req.auditLog) await req.auditLog('BOOKING_CANCELLED', { booking_id: booking.id, reason, by: req.user.id });
    return success(res, { message: 'Booking cancelled', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    const force = req.query.force === 'true';
    const paidStatuses = ['released', 'refunded'];
    if (!force && !paidStatuses.includes(booking.payment_status)) {
      return error(res, 'PAYMENT_PENDING', 'Payment not confirmed. Add ?force=true to override.', 400);
    }
    await booking.update({ status: 'completed', completed_at: new Date() });
    if (req.auditLog) await req.auditLog('BOOKING_COMPLETED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Booking completed', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── System Settings ───────────────────────────────────────────────────────────
// PRD §3.1 — Super Admin configures global settings

exports.getSystemSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findAll();
    return success(res, { settings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.upsertSystemSetting = async (req, res) => {
  try {
    const { key, value, description, value_type } = req.body;
    if (!key || value === undefined) return error(res, 'VALIDATION_ERROR', 'key and value required', 422);

    const [setting] = await SystemSetting.upsert({ key, value: String(value), description, value_type, updated_by: req.user.id });
    if (req.auditLog) await req.auditLog('SYSTEM_SETTING_UPDATED', { key, value, by: req.user.id });
    return success(res, { setting });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateSystemSetting = async (req, res) => {
  try {
    const setting = await SystemSetting.findOne({ where: { key: req.params.key } });
    if (!setting) return error(res, 'NOT_FOUND', 'Setting not found', 404);
    await setting.update({ value: String(req.body.value), updated_by: req.user.id });
    if (req.auditLog) await req.auditLog('SYSTEM_SETTING_UPDATED', { key: req.params.key, value: req.body.value, by: req.user.id });
    return success(res, { setting });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// PRD §4 — Assignment Engine Mode
exports.setAssignmentMode = async (req, res) => {
  try {
    const { mode } = req.body;
    const validModes = ['manual', 'semi_auto', 'full_auto'];
    if (!validModes.includes(mode)) return error(res, 'VALIDATION_ERROR', `mode must be one of: ${validModes.join(', ')}`, 422);

    await SystemSetting.upsert({ key: 'assignment_mode', value: mode, updated_by: req.user.id });
    if (req.auditLog) await req.auditLog('ASSIGNMENT_MODE_CHANGED', { mode, by: req.user.id });
    return success(res, { message: `Assignment mode set to ${mode}` });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── View As ───────────────────────────────────────────────────────────────────
// PRD §3.1 — Super Admin impersonates any user

exports.viewAsUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password_hash'] },
    });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    if (req.auditLog) await req.auditLog('VIEW_AS_STARTED', { target_user: user.id, by: req.user.id });
    return success(res, { user, view_as: true });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Audit Logs ────────────────────────────────────────────────────────────────
// PRD §25.8

exports.getAuditLogs = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { action, user_id } = req.query;

    const where = {};
    if (action)  where.action  = { [Op.iLike]: `%${action}%` };
    if (user_id) where.user_id = user_id;

    const { count, rows } = await AuditLog.findAndCountAll({
      where, limit, offset,
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'role'] }],
    });

    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────
// PRD §5.1

exports.bookingReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };

    const report = await Booking.findAll({
      where,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('final_fare')), 'total_fare'],
      ],
      group: ['status'],
    });

    return success(res, { report });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Live driver positions for map
exports.liveDrivers = async (req, res) => {
  try {
    const drivers = await Driver.findAll({
      include: [{ model: User, as: 'user', attributes: ['id','full_name','phone'] }],
      attributes: ['id','user_id','current_lat','current_lng','is_available','can_receive_assignments','location_updated'],
      where: { current_lat: { [Op.ne]: null }, current_lng: { [Op.ne]: null } },
    });
    const activeBookings = await Booking.findAll({
      where: { status: ['assigned','accepted','picked_up','in_transit'] },
      attributes: ['id','assigned_driver_id','reference','pickup_address','delivery_address','pickup_lat','pickup_lng','delivery_lat','delivery_lng','status'],
    });
    return success(res, { drivers, activeBookings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.financialReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'completed' };
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };

    const [total] = await Booking.findAll({
      where,
      attributes: [
        [sequelize.fn('SUM', sequelize.col('customer_rate')), 'total_revenue'],
        [sequelize.fn('SUM', sequelize.col('hire_rate')), 'total_hire'],
        [sequelize.fn('SUM', sequelize.col('total_expenses')), 'total_expenses'],
        [sequelize.fn('SUM', sequelize.col('profit')), 'total_profit'],
        [sequelize.fn('COUNT', sequelize.col('id')),       'total_bookings'],
        [sequelize.fn('AVG', sequelize.col('customer_rate')), 'avg_fare'],
      ],
    });

    return success(res, { report: total });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Assignment Suggestions (Semi-Auto) ───────────────────────────────────────
// GET /api/v1/admin/assignment/suggest/:bookingId
exports.suggestDrivers = async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.bookingId);
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    const result = await suggestDriversForBooking(booking, Number(req.query.limit) || 5);
    return success(res, result);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Customer whitelist/blacklist management ──────────────────────────────────
// POST /api/v1/admin/customers/:customerId/driver-rule
exports.upsertDriverRule = async (req, res) => {
  try {
    const { driver_id, rule_type } = req.body;
    const { customerId } = req.params;
    if (!driver_id || !rule_type) return error(res, 'VALIDATION_ERROR', 'driver_id and rule_type required', 422);
    if (!['whitelist', 'blacklist'].includes(rule_type)) {
      return error(res, 'VALIDATION_ERROR', 'rule_type must be whitelist or blacklist', 422);
    }
    const [rule] = await CustomerDriverRule.upsert({ customer_id: customerId, driver_id, rule_type });
    if (req.auditLog) await req.auditLog('CUSTOMER_DRIVER_RULE_SET', { customer_id: customerId, driver_id, rule_type, by: req.user.id });
    return success(res, { rule });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// DELETE /api/v1/admin/customers/:customerId/driver-rule/:driverId
exports.deleteDriverRule = async (req, res) => {
  try {
    const { customerId, driverId } = req.params;
    const deleted = await CustomerDriverRule.destroy({ where: { customer_id: customerId, driver_id: driverId } });
    if (req.auditLog) await req.auditLog('CUSTOMER_DRIVER_RULE_DELETED', { customer_id: customerId, driver_id: driverId, by: req.user.id });
    return success(res, { deleted: Boolean(deleted) });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.driverReport = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await Driver.findAndCountAll({
      limit, offset,
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
      order: [['avg_rating', 'DESC']],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.exportReport = async (req, res) => {
  try {
    const { from, to, format = 'csv', limit = 50000 } = req.query;
    const where = {};
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };

    const bookings = await Booking.findAll({
      where,
      attributes: ['reference', 'status', 'customer_rate', 'hire_rate', 'profit', 'pickup_address', 'delivery_address', 'created_at'],
      include: [{ model: User, as: 'customer', attributes: ['full_name', 'email', 'phone'] }],
      order: [['created_at', 'DESC']],
      limit: Math.min(Number(limit) || 50000, 1048576), // Excel row limit ~1,048,576
    });

    if (format === 'json') {
      return res.json({ success: true, data: bookings });
    }

    const header = ['reference','status','customer_rate','hire_rate','profit','customer_name','customer_email','customer_phone','pickup','delivery','created_at'];

    if (format === 'xlsx') {
      const Excel = require('exceljs');
      const wb = new Excel.Workbook();
      const ws = wb.addWorksheet('Bookings');
      ws.addRow(header);
      bookings.forEach(b => {
        ws.addRow([
          b.reference,
          b.status,
          b.customer_rate ?? '',
          b.hire_rate ?? '',
          b.profit ?? '',
          b.customer?.full_name ?? '',
          b.customer?.email ?? '',
          b.customer?.phone ?? '',
          (b.pickup_address || '').replace(/\r?\n/g, ' '),
          (b.delivery_address || '').replace(/\r?\n/g, ' '),
          b.created_at?.toISOString() ?? '',
        ]);
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="bookings-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // default CSV
    const rows = bookings.map(b => ([
      b.reference,
      b.status,
      b.customer_rate ?? '',
      b.hire_rate ?? '',
      b.profit ?? '',
      b.customer?.full_name ?? '',
      b.customer?.email ?? '',
      b.customer?.phone ?? '',
      (b.pickup_address || '').replace(/\r?\n/g, ' '),
      (b.delivery_address || '').replace(/\r?\n/g, ' '),
      b.created_at?.toISOString() ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Maintenance: export a compact JSON snapshot of key tables (dev/support) ──
// POST /api/v1/admin/maintenance/export-all
exports.exportAllData = async (req, res) => {
  try {
    const limit  = Math.min(Number(req.body?.limit || req.query.limit) || 500, 2000);
    const format = String(req.body?.format || req.query.format || 'json').toLowerCase();
    const tables = [
      'users',
      'drivers',
      'vehicles',
      'bookings',
      'payments',
      'complaints',
      'trip_charges',
      'login_otps',
    ];

    const snapshot = {};
    for (const table of tables) {
      try {
        const rows = await sequelize.query(
          `SELECT * FROM "${table}" ORDER BY created_at DESC NULLS LAST LIMIT :limit`,
          { replacements: { limit }, type: QueryTypes.SELECT }
        );
        snapshot[table] = { count: rows.length, rows };
      } catch (err) {
        snapshot[table] = { error: err.message };
      }
    }

    const payload = { generated_at: new Date().toISOString(), limit, snapshot };

    if (format === 'csv') {
      const header = ['table', 'data_json'];
      const rows = [];
      Object.entries(snapshot).forEach(([table, val]) => {
        if (val?.rows?.length) {
          val.rows.forEach(r => {
            const json = JSON.stringify(r).replace(/"/g, '""');
            rows.push(`"${table}","${json}"`);
          });
        } else {
          rows.push(`"${table}","${(val?.error || '0 rows')}"`);
        }
      });
      const csv = [header.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="zito-export-${Date.now()}.csv"`);
      return res.send(csv);
    }

    return success(res, payload);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Maintenance: clear test data (dev only, requires confirm) ──
// POST /api/v1/admin/maintenance/clear-test-data?confirm=1
exports.clearTestData = async (req, res) => {
  try {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    if (isProd) return error(res, 'FORBIDDEN', 'Disabled in production', 403);

    const confirmed = req.query.confirm === '1' || req.body?.confirm === true;
    const tables = [
      'login_otps',
      'audit_logs',
      'trip_charges',
      'payments',
      'complaints',
      'bookings',
      'booking_offers',
    ];

    if (!confirmed) {
      return success(res, {
        message: 'Dry run only. Append ?confirm=1 or body {confirm:true} to actually truncate.',
        tables,
      });
    }

    const cleared = [];
    const failed  = [];

    for (const table of tables) {
      try {
        await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        cleared.push(table);
      } catch (err) {
        failed.push({ table, error: err.message });
      }
    }

    if (req.auditLog) await req.auditLog('CLEAR_TEST_DATA', { cleared, failed });
    return success(res, { cleared, failed, environment: process.env.NODE_ENV || 'development' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
