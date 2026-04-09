// src/controllers/transporter.controller.js
// PRD §5.4 — Transporter Portal
// PRD §3.6 — Transporter manages own fleet, drivers, customers, bookings

const { User, Driver, Vehicle, Booking, Contract, ContractRate } = require('../models');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { autoAssignIfNeeded } = require('../services/assignment.service');

// ── Dashboard ──────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const transporter_id = req.user.id;
    const [totalVehicles, totalDrivers, totalBookings, activeBookings] = await Promise.all([
      Vehicle.count({ where: { transporter_id } }),
      User.count({ where: { transporter_id, role: 'driver' } }),
      Booking.count({ where: { transporter_id } }),
      Booking.count({ where: { transporter_id, status: ['assigned','accepted','picked_up','in_transit'] } }),
    ]);
    return success(res, { totalVehicles, totalDrivers, totalBookings, activeBookings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Fleet ──────────────────────────────────────────────────────────────────
exports.getFleet = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await Vehicle.findAndCountAll({
      where: { transporter_id: req.user.id },
      limit, offset, order: [['created_at', 'DESC']],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.addVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.create({ ...req.body, transporter_id: req.user.id, owner_user_id: req.user.id, ownership_type: 'contracted' });
    if (req.auditLog) await req.auditLog('VEHICLE_ADDED', { vehicle_id: vehicle.id, by: req.user.id });
    return success(res, { vehicle }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getVehicleById = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    await vehicle.update(req.body);
    return success(res, { vehicle });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.retireVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    await vehicle.update({ is_active: false });
    await vehicle.destroy();
    return success(res, { message: 'Vehicle retired' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Drivers ────────────────────────────────────────────────────────────────
exports.getDrivers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await User.findAndCountAll({
      where: { transporter_id: req.user.id, role: 'driver' },
      limit, offset,
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Driver, as: 'driver_profile' }],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.inviteDriver = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);

    const user = await User.create({
      full_name, email, phone,
      password_hash:  phone, // temp password = phone, driver must reset
      role:           'driver',
      transporter_id: req.user.id,
      compliance_status: 'pending',
    });
    return success(res, { message: 'Driver invited', user: { id: user.id, email: user.email } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, transporter_id: req.user.id },
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Driver, as: 'driver_profile' }],
    });
    if (!user) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateDriver = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    await user.update({ full_name: req.body.full_name, phone: req.body.phone });
    return success(res, { message: 'Driver updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.assignVehicleToDriver = async (req, res) => {
  try {
    const { vehicle_id } = req.body;
    const driver = await Driver.findOne({ include: [{ model: User, as: 'user', where: { id: req.params.id, transporter_id: req.user.id } }] });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    await driver.update({ vehicle_id });
    return success(res, { message: 'Vehicle assigned to driver' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.setDriverAvailability = async (req, res) => {
  try {
    const { is_available } = req.body;
    const driver = await Driver.findOne({ include: [{ model: User, as: 'user', where: { id: req.params.id, transporter_id: req.user.id } }] });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    await driver.update({ is_available });
    return success(res, { message: `Driver availability set to ${is_available}` });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Customers ──────────────────────────────────────────────────────────────
exports.getCustomers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { count, rows } = await User.findAndCountAll({
      where: { transporter_id: req.user.id, role: 'customer' },
      limit, offset,
      attributes: { exclude: ['password_hash'] },
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone) return error(res, 'VALIDATION_ERROR', 'full_name, email, phone required', 422);
    const existing = await User.findOne({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already registered', 409);

    const user = await User.create({
      full_name, email, phone,
      password_hash:    phone,
      role:             'customer',
      transporter_id:   req.user.id,
      compliance_status:'approved',
    });
    return success(res, { user: { id: user.id, email: user.email } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, transporter_id: req.user.id }, attributes: { exclude: ['password_hash'] } });
    if (!user) return error(res, 'NOT_FOUND', 'Customer not found', 404);
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!user) return error(res, 'NOT_FOUND', 'Customer not found', 404);
    await user.update({ full_name: req.body.full_name, phone: req.body.phone });
    return success(res, { message: 'Customer updated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Bookings ───────────────────────────────────────────────────────────────
exports.getBookings = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status } = req.query;
    const where = { transporter_id: req.user.id };
    if (status) where.status = status;

    const { count, rows } = await Booking.findAndCountAll({
      where, limit, offset, order: [['created_at', 'DESC']],
      include: [
        { model: User,   as: 'customer', attributes: ['id','full_name','phone'] },
        { model: Vehicle,as: 'vehicle',  attributes: ['id','plate_number','vehicle_type'] },
      ],
    });
    return success(res, rows, 200, paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createBooking = async (req, res) => {
  try {
    const ref = 'ZT' + Date.now().toString(36).toUpperCase();
    const booking = await Booking.create({
      ...req.body, reference: ref,
      transporter_id:  req.user.id,
      created_by_role: req.user.role,
      created_by_id:   req.user.id,
      handled_by:      'transporter',
      status:          'pending',
    });
    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    return success(res, { booking, auto_assignment: autoResult }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.assignDriver = async (req, res) => {
  try {
    const { driver_id, vehicle_id } = req.body;
    const booking = await Booking.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const driver = await Driver.findByPk(driver_id);
    if (!driver || driver.is_blacklisted || !driver.can_receive_assignments || !driver.is_available) {
      return error(res, 'DRIVER_UNAVAILABLE', 'Driver is not eligible for assignment', 400);
    }

    await booking.update({ assigned_driver_id: driver_id, vehicle_id, status: 'assigned', assigned_at: new Date() });
    return success(res, { message: 'Driver assigned', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await booking.update({ status: 'cancelled', cancellation_reason: req.body.reason, cancelled_at: new Date() });
    return success(res, { message: 'Booking cancelled' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Finance ────────────────────────────────────────────────────────────────
exports.getFinanceSummary = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: { transporter_id: req.user.id, status: 'completed' },
      attributes: ['id', 'customer_rate', 'hire_rate', 'total_expenses', 'profit', 'completed_at'],
      order: [['completed_at', 'DESC']],
    });

    const totals = bookings.reduce(
      (acc, b) => {
        acc.total_customer_rate += Number(b.customer_rate || 0);
        acc.total_hire_rate += Number(b.hire_rate || 0);
        acc.total_expenses += Number(b.total_expenses || 0);
        acc.total_profit += Number(b.profit || 0);
        return acc;
      },
      { total_customer_rate: 0, total_hire_rate: 0, total_expenses: 0, total_profit: 0 }
    );

    return success(res, {
      summary: {
        completed_bookings: bookings.length,
        ...totals,
      },
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      where: { transporter_id: req.user.id, status: 'completed' },
      include: [{ model: User, as: 'customer', attributes: ['id', 'full_name', 'email'] }],
      attributes: ['id', 'reference', 'customer_rate', 'hire_rate', 'total_expenses', 'profit', 'completed_at'],
      order: [['completed_at', 'DESC']],
      limit: Number(req.query.limit) || 200,
    });

    const invoices = bookings.map((b) => ({
      invoice_number: `TRN-${String(b.reference || b.id).slice(-8).toUpperCase()}`,
      booking_id: b.id,
      booking_reference: b.reference,
      customer: b.customer ? { id: b.customer.id, full_name: b.customer.full_name, email: b.customer.email } : null,
      customer_rate: Number(b.customer_rate || 0),
      hire_rate: Number(b.hire_rate || 0),
      expenses: Number(b.total_expenses || 0),
      transporter_profit: Number(b.profit || 0),
      issued_at: b.completed_at || b.updated_at,
      status: 'issued',
    }));

    return success(res, { invoices });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Contracts ──────────────────────────────────────────────────────────────
exports.getContracts = async (req, res) => {
  try {
    const { count, rows } = await Contract.findAndCountAll({ where: { transporter_id: req.user.id } });
    return success(res, rows);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await Contract.create({ ...req.body, transporter_id: req.user.id, created_by: req.user.id });
    return success(res, { contract }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getContractById = async (req, res) => {
  try {
    const contract = await Contract.findOne({ where: { id: req.params.id, transporter_id: req.user.id }, include: [{ model: ContractRate, as: 'rates' }] });
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateContract = async (req, res) => {
  try {
    const contract = await Contract.findOne({ where: { id: req.params.id, transporter_id: req.user.id } });
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    await contract.update(req.body);
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
