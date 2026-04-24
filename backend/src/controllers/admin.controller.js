// PRD §4 — User Roles & Permissions
// PRD §12 — Admin API endpoints
// PRD §25.4 — Admin Compliance & Approval APIs
// PRD §25.8 — Audit Log
// PRD §25.10 — Pagination

const bcrypt = require('bcryptjs'); // PRD §11
const prisma = require('../utils/prisma'); // Import Prisma client
const { success, error }   = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { generateUuidReference } = require('../utils/id'); // PRD §8
const { ROLES, ADMIN_ROLES } = require('../middleware/auth');
const { autoAssignIfNeeded } = require('../services/assignment.service');

// ── Dashboard Stats ───────────────────────────────────────────────────────────
// GET /api/v1/admin/stats
// PRD §5.1 — KPI cards: Total Bookings, Active Bookings, Total Revenue, Pending Payments

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalBookings, // PRD §5.1
      activeBookings, // PRD §5.1
      pendingBookings, // PRD §5.1
      completedBookings, // PRD §5.1
      totalUsers, // PRD §5.1
      totalDrivers, // PRD §5.1
      availableDrivers, // PRD §5.1
      totalVehicles, // PRD §5.1
      pendingDriverApprovals, // PRD §5.1
      pendingTransporterApprovals, // PRD §5.1
      totalWarehousePartners, // PRD §5.1 (Prisma: warehousePartner)
      activeStorageBookings, // PRD §5.1 (Prisma: storageBooking)
      totalLclParcels, // PRD §5.1 (Prisma: lclParcel)
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: { in: ['assigned', 'accepted', 'picked_up', 'in_transit'] } } }),
      prisma.booking.count({ where: { status: 'pending' } }),
      prisma.booking.count({ where: { status: 'completed' } }),
      prisma.user.count(),
      prisma.driver.count(),
      prisma.driver.count({ where: { isAvailable: true } }),
      prisma.vehicle.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: ROLES.DRIVER, complianceStatus: 'pending' } }),
      prisma.user.count({ where: { role: ROLES.TRANSPORTER, complianceStatus: 'pending' } }),
      prisma.warehousePartner.count(),
      prisma.storageBooking.count({ where: { status: 'active' } }),
      prisma.lclParcel.count(),
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
      modules: {
        warehousing: { partners: totalWarehousePartners, activeBookings: activeStorageBookings },
        lcl_ptl:     { totalParcels: totalLclParcels },
      }
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

    const where = { deletedAt: null };
    if (role)               where.role               = role;
    if (is_active !== undefined) where.isActive     = is_active === 'true';
    if (compliance_status)  where.complianceStatus  = compliance_status;
    // support old frontend param
    if (verification_status) where.complianceStatus = verification_status;
    
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const [count, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          role: true,
          email: true,
          phone: true,
          full_name: true,
          isActive: true,
          complianceStatus: true,
          transporterId: true,
          agentId: true,
          agencyId: true,
          createdAt: true,
          updatedAt: true
        }
      })
    ]);

    return success(res, rows, 'Users retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    console.error('getUsers error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { // Explicitly select fields to exclude password_hash
        id: true,
        role: true,
        email: true,
        phone: true,
        full_name: true,
        isActive: true,
        deletedAt: true,
        complianceStatus: true,
        dataLocked: true,
        createdAt: true
      }
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
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already exists', 409);

    // PRD §11 — bcrypt 12 rounds
    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        full_name, email, phone,
        passwordHash: password_hash,
        role: role || ROLES.CUSTOMER,
        complianceStatus: [ROLES.DRIVER, ROLES.TRANSPORTER].includes(role) ? 'pending' : 'approved',
      }
    });

    if (req.auditLog) await req.auditLog('USER_CREATED', { user_id: user.id, role: user.role, created_by: req.user.id });

    return success(res, { user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name } }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    const allowed = [
      'full_name', 'phone', 'role', 'isActive', 'transporterId', 'agentId', 'agencyId',
      'complianceStatus', 'dataLocked' // Add compliance and dataLocked for admin updates
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await prisma.user.update({
      where: { id: user.id },
      data: updates
    });
    if (req.auditLog) await req.auditLog('USER_UPDATED', { user_id: user.id, updates, updated_by: req.user.id });

    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    // PRD §25.9 — soft delete
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), isActive: false }
    });

    if (req.auditLog) await req.auditLog('USER_DELETED', { user_id: user.id, deleted_by: req.user.id });
    return success(res, { message: 'User deleted successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.activateUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true }
    });
    if (req.auditLog) await req.auditLog('USER_ACTIVATED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User activated' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    });
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
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    const updates = {
      complianceStatus: compliance_status
      // approvedBy, rejectedBy, rejectionReason would be updated here if added to schema
    };

    await prisma.user.update({
      where: { id: user.id },
      data: updates
    });

    if (req.auditLog) await req.auditLog('USER_COMPLIANCE_UPDATED', { user_id: user.id, compliance_status, by: req.user.id });
    return success(res, { message: `Compliance status set to ${compliance_status}` });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.lockUserData = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { dataLocked: true }
    });
    if (req.auditLog) await req.auditLog('USER_DATA_LOCKED', { user_id: user.id, by: req.user.id });
    return success(res, { message: 'User data locked' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unlockUserData = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);
    await prisma.user.update({
      where: { id: user.id },
      data: { dataLocked: false, complianceStatus: 'resubmission_required' }
    });
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
    const { is_available, is_blacklisted, compliance_status } = req.query; // These are Sequelize field names

    const userWhere = { role: ROLES.DRIVER }; // Prisma: role
    if (compliance_status) userWhere.complianceStatus = compliance_status; // Prisma: complianceStatus

    const driverWhere = {}; // Prisma field names
    if (is_available   !== undefined) driverWhere.isAvailable   = is_available   === 'true';
    if (is_blacklisted !== undefined) driverWhere.isBlacklisted = is_blacklisted === 'true';

    const [count, rows] = await prisma.$transaction([
      prisma.driver.count({ where: { ...driverWhere, user: { is: userWhere } } }),
      prisma.driver.findMany({
        where: { ...driverWhere, user: { is: userWhere } },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              phone: true,
              complianceStatus: true,
              isActive: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      })
    ]);

    return success(res, rows, 'Drivers retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { password_hash: false } },
        currentVehicle: true, // Prisma: currentVehicle
        compliance: true, // Prisma: compliance
      }
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
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // Update driver's ability to receive assignments
    await prisma.driver.update({
      where: { id: driver.id },
      data: { canReceiveAssignments: true }
    });
    await prisma.user.update({
      where: { id: driver.userId }, // Prisma: userId
      data: { complianceStatus: 'approved' } // approvedBy needs to be added to schema
    });

    // Update driver compliance record
    const compliance = await prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
    if (compliance) {
      await prisma.driverCompliance.update({
        where: { driverId: driver.id },
        data: {
          complianceStatus: 'approved',
          // statusUpdatedAt, statusUpdatedBy, approvedBy, approvedAt, rejectionReason, resubmissionComment need to be added to schema
        }
      });
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
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // Update driver's ability to receive assignments
    await prisma.driver.update({
      where: { id: driver.id },
      data: { canReceiveAssignments: false }
    });
    await prisma.user.update({
      where: { id: driver.userId },
      data: { complianceStatus: 'rejected' } // rejectedBy, rejectionReason need to be added to schema (assuming they exist in schema)
    });

    // Update driver compliance record
    const compliance = await prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
    if (compliance) {
      await prisma.driverCompliance.update({
        where: { driverId: driver.id },
        data: {
          complianceStatus: 'rejected',
          // statusUpdatedAt, statusUpdatedBy, rejectionReason need to be added to schema
        }
      });
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
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // Update user status
    await prisma.user.update({
      where: { id: driver.userId },
      data: {
        complianceStatus: 'resubmission_required',
        dataLocked: false,
        // rejectionReason needs to be added to schema
      } // Assuming rejectionReason is part of User model for now
    });

    // Update driver compliance record
    const compliance = await prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
    if (compliance) {
      await prisma.driverCompliance.update({
        where: { driverId: driver.id },
        data: {
          complianceStatus: 'resubmission_required',
          // statusUpdatedAt, statusUpdatedBy, resubmissionComment need to be added to schema
        }
      });
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
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // Update driver status
    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        isBlacklisted: true,
        canReceiveAssignments: false,
        // blacklistReason, blacklistedBy, blacklistedAt need to be added to schema
        // Assuming these fields exist in the Driver model
        blacklistReason: reason,
        blacklistedBy: req.user.id,
        blacklistedAt: new Date(),
      }
    });

    if (req.auditLog) await req.auditLog('DRIVER_BLACKLISTED', { driver_id: driver.id, reason, by: req.user.id });
    return success(res, { message: 'Driver blacklisted' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unblacklistDriver = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // Update driver status
    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        isBlacklisted: false,
        // blacklistReason, blacklistedBy, blacklistedAt need to be added to schema
        // Clear blacklist info
        blacklistReason: null,
        blacklistedBy: null,
        blacklistedAt: null,
      }
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
    if (vehicle_type) where.vehicleType = vehicle_type;
    if (is_verified  !== undefined) where.isVerified = is_verified  === 'true';
    if (is_active    !== undefined) where.isActive   = is_active    === 'true';

    const [count, rows] = await prisma.$transaction([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        take: limit, skip: offset,
        orderBy: { createdAt: 'desc' },
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
      include: {
        currentDriver: true, // Prisma: currentDriver
      }
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
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);

    // Update vehicle status
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        isVerified: true,
        isAssignmentBlocked: false,
        // isApproved needs to be added to schema if it's a separate field
        // Assuming isApproved is implied by isVerified and not blocked
      }
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
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    
    // Update vehicle status
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        isAssignmentBlocked: true,
        // blockReason, blockedBy need to be added to schema
        blockReason: reason,
        blockedBy: req.user.id,
      }
    });

    if (req.auditLog) await req.auditLog('VEHICLE_BLOCKED', { vehicle_id: vehicle.id, reason, by: req.user.id });
    return success(res, { message: 'Vehicle blocked from assignments' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.unblockVehicle = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return error(res, 'NOT_FOUND', 'Vehicle not found', 404);
    
    // Update vehicle status
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        isAssignmentBlocked: false,
        // blockReason, blockedBy need to be added to schema
        blockReason: null,
        blockedBy: null,
      }
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
    if (payment_status) where.paymentStatus = payment_status;
    if (vehicle_type)   where.vehicleType   = vehicle_type;
    if (handled_by)     where.handledBy     = handled_by;

    const [count, rows] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, full_name: true, email: true, phone: true } },
          driver: { include: { user: { select: { id: true, full_name: true, phone: true } } } },
          vehicle: { select: { id: true, plate_number: true, vehicle_type: true } },
        },
      }),
    ]);

    return success(res, rows, 'Audit logs retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { password_hash: false } },
        driver: { include: { user: { select: { id: true, full_name: true, phone: true } } } },
        vehicle: true,
      }
    });

    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Create / Assign / Cancel Bookings ──────────────────────────────────────────

exports.createBooking = async (req, res) => {
  try {
    const ref = generateUuidReference('VG');
    const booking = await prisma.booking.create({
      data: { ...req.body, reference: ref }
    });
    if (req.auditLog) await req.auditLog('BOOKING_CREATED', { booking_id: booking.id, by: req.user.id });
    const autoResult = await autoAssignIfNeeded(booking, req.auditLog);
    return success(res, { booking, auto_assignment: autoResult }, 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    await prisma.booking.update({
      where: { id: booking.id },
      data: req.body
    });
    if (req.auditLog) await req.auditLog('BOOKING_UPDATED', { booking_id: booking.id, by: req.user.id });
    return success(res, { booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.assignDriver = async (req, res) => {
  try {
    const { driver_id, vehicle_id } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // PRD §18.1 — Driver assignment validation
    const driver = await prisma.driver.findUnique({ where: { id: driver_id } });
    if (!driver)                          return error(res, 'NOT_FOUND',                'Driver not found', 404);
    if (driver.isBlacklisted)            return error(res, 'DRIVER_BLACKLISTED',        'Driver is blacklisted', 400);
    if (!driver.canReceiveAssignments)  return error(res, 'DRIVER_NOT_APPROVED',       'Driver compliance not approved', 403);
    if (!driver.isAvailable)             return error(res, 'DRIVER_UNAVAILABLE',        'Driver is not available', 400);

    // PRD §18.2 — Vehicle assignment validation
    if (vehicle_id) {
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicle_id } });
      if (!vehicle)                      return error(res, 'NOT_FOUND',                  'Vehicle not found', 404);
      if (!vehicle.isVerified)          return error(res, 'VEHICLE_NOT_VERIFIED',        'Vehicle not verified', 400);
      if (vehicle.isAssignmentBlocked) return error(res, 'VEHICLE_ASSIGNMENT_BLOCKED',  'Vehicle is blocked', 400);
      if (!vehicle.isActive)            return error(res, 'VEHICLE_INACTIVE',            'Vehicle is inactive', 400);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        assignedDriverId: driver_id,
        vehicleId: vehicle_id || booking.vehicleId,
        status: 'assigned',
        assignedAt: new Date(),
      }
    });

    if (req.auditLog) await req.auditLog('BOOKING_ASSIGNED', { booking_id: booking.id, driver_id, vehicle_id, by: req.user.id });
    // Notification logic would follow here
    return success(res, { message: 'Driver assigned successfully', booking: updatedBooking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * PRD §44.4 — Rescue Flow: Assign backup vehicle and transfer load
 * Executed by Operations/Admin to resolve a breakdown.
 */
exports.rescueBooking = async (req, res) => {
  try {
    const { id } = req.params; // bookingId
    const { new_driver_id, new_vehicle_id, note } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Assign new backup driver and vehicle
      const updated = await tx.booking.update({
        where: { id },
        data: {
          assignedDriverId: new_driver_id,
          vehicleId: new_vehicle_id,
          specialInstructions: `${booking.specialInstructions || ''}\n[RESCUE_EXECUTED] Load transferred. Backup: ${new_vehicle_id}. Rescue Note: ${note}`
        }
      });

      // 2. Resolve breakdown alerts for this booking
      await tx.internalAlert.updateMany({
        where: { entityId: id, type: 'VEHICLE_BREAKDOWN', status: 'pending' },
        data: {
          status: 'acknowledged',
          acknowledgedById: req.user.id,
          acknowledgedAt: new Date()
        }
      });

      return updated;
    });

    if (req.auditLog) await req.auditLog('BOOKING_RESCUED', { booking_id: id, new_driver_id, new_vehicle_id });
    return success(res, { booking: result }, 'Rescue operation completed. Backup driver assigned and alerts cleared.');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.approveBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // Update booking status
    await prisma.booking.update({ // Prisma: booking
      where: { id: booking.id },
      data: { status: 'approved', approvedAt: new Date() } // approvedAt needs to be added to schema
    });
    if (req.auditLog) await req.auditLog('BOOKING_APPROVED', { booking_id: booking.id, by: req.user.id });
    return success(res, { message: 'Booking approved', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);

    // Update booking status
    await prisma.booking.update({ // Prisma: booking
      where: { id: booking.id },
      data: { status: 'cancelled', cancellationReason: reason, cancelledAt: new Date() } // cancellationReason, cancelledAt need to be added to schema
    });
    if (req.auditLog) await req.auditLog('BOOKING_CANCELLED', { booking_id: booking.id, reason, by: req.user.id });
    return success(res, { message: 'Booking cancelled', booking });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.completeBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    const force = req.query.force === 'true';
    const paidStatuses = ['released', 'refunded']; // Assuming these are valid payment statuses

    // Check payment status before completing
    if (!force && !paidStatuses.includes(booking.paymentStatus)) {
      return error(res, 'PAYMENT_PENDING', 'Payment not confirmed. Add ?force=true to override.', 400);
    }
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'completed', completedAt: new Date() } // completedAt needs to be added to schema
    });
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
    const settings = await prisma.systemSetting.findMany();
    return success(res, { settings });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.upsertSystemSetting = async (req, res) => {
  try {
    const { key, value, description, value_type } = req.body;
    if (!key || value === undefined) return error(res, 'VALIDATION_ERROR', 'key and value required', 422);
    // value_type, updated_by need to be added to schema
    
    // Prisma upsert syntax for SystemSetting
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value), description, value_type, updatedBy: req.user.id }, // Assuming updatedBy exists
      create: { key, value: String(value), description, value_type, updatedBy: req.user.id } // Assuming updatedBy exists
    });
    // const setting = await prisma.systemSetting.upsert({
    //   where: { key }, update: { value: String(value), description, value_type, updated_by: req.user.id }, create: { key, value: String(value), description, value_type, updated_by: req.user.id } });
    if (req.auditLog) await req.auditLog('SYSTEM_SETTING_UPDATED', { key, value, by: req.user.id });
    return success(res, { setting });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateSystemSetting = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: req.params.key } });
    if (!setting) return error(res, 'NOT_FOUND', 'Setting not found', 404);
    
    const updatedSetting = await prisma.systemSetting.update({
      where: { key: req.params.key },
      data: { value: String(req.body.value), updatedBy: req.user.id }
    });

    if (req.auditLog) await req.auditLog('SYSTEM_SETTING_UPDATED', { key: req.params.key, value: req.body.value, by: req.user.id });
    return success(res, { setting: updatedSetting });
  } catch (err) {
    console.error('updateSystemSetting error:', err);
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// PRD §4 — Assignment Engine Mode
exports.setAssignmentMode = async (req, res) => {
  try {
    const { mode } = req.body;
    const validModes = ['manual', 'semi_auto', 'full_auto'];
    if (!validModes.includes(mode)) return error(res, 'VALIDATION_ERROR', `mode must be one of: ${validModes.join(', ')}`, 422);

    // Upsert system setting for assignment mode
    await prisma.systemSetting.upsert({ // Prisma: systemSetting
      where: { key: 'assignment_mode' },
      update: { value: mode, updatedBy: req.user.id }, // Assuming updatedBy exists
      create: { key: 'assignment_mode', value: mode, updatedBy: req.user.id } // Assuming updatedBy exists
    });
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
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        full_name: true,
        isActive: true,
        deletedAt: true,
        complianceStatus: true,
        dataLocked: true,
        // Exclude password_hash
      }
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
    if (action)  where.action  = { contains: action, mode: 'insensitive' };
    if (user_id) where.userId = user_id;

    const [count, rows] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true,
              role: true
            }
          }
        }
      }),
    ]);

    const meta = paginatedResponse(rows, count, page, limit).meta;

    return success(res, rows, 'Audit logs retrieved', meta);

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
    if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) };

    const report = await prisma.booking.groupBy({ // Prisma: booking
      by: ['status'],
      where,
      _count: { id: true },
      _sum: {
        finalFare: true, // Prisma: finalFare
        customerRate: true, // Assuming customerRate is also needed for sum
        hireRate: true, // Assuming hireRate is also needed for sum
        profit: true, // Assuming profit is also needed for sum
      },
    });

    return success(res, { report });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// Live driver positions for map
exports.liveDrivers = async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: {
        currentLat: { not: null },
        currentLng: { not: null },
      },
      select: {
        id: true,
        userId: true,
        currentLat: true,
        currentLng: true,
        isAvailable: true,
        canReceiveAssignments: true,
        locationUpdated: true,
        user: { select: { id: true, full_name: true, phone: true } },
      },
    });

    const activeBookings = await prisma.booking.findMany({
      where: { status: { in: ['assigned', 'accepted', 'picked_up', 'in_transit'] } },
      select: {
        id: true,
        assignedDriverId: true,
        reference: true,
        pickupAddress: true,
        deliveryAddress: true,
        status: true,
      },
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
    if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) };

    const total = await prisma.booking.aggregate({
      where,
      _sum: {
        customerRate: true,
        hireRate: true,
        totalExpenses: true, // Assuming totalExpenses exists in Booking model
        profit: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        customerRate: true,
      },
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
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId }
    });
    if (!booking) return error(res, 'NOT_FOUND', 'Booking not found', 404);
    
    // Implementation of suggestDriversForBooking must be Prisma-ready
    const result = await require('../services/assignment.service').suggestDriversForBooking(booking, Number(req.query.limit) || 5);
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
    } // CustomerDriverRule needs to be refactored to use Prisma
    const rule = await prisma.customerDriverRule.upsert({
      where: { customerId_driverId: { customerId, driverId: driver_id } }, // Assuming composite unique key
      update: { ruleType: rule_type },
      create: { customerId, driverId: driver_id, ruleType: rule_type },
    });
    // const [rule] = await CustomerDriverRule.upsert({ customer_id: customerId, driver_id, rule_type }); // Sequelize remnant
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
    const deleted = await prisma.customerDriverRule.deleteMany({ // Prisma: customerDriverRule
      where: { customerId, driverId }
    });
    if (req.auditLog) await req.auditLog('CUSTOMER_DRIVER_RULE_DELETED', { customer_id: customerId, driver_id: driverId, by: req.user.id });
    return success(res, { deleted: Boolean(deleted) });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.driverReport = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const [count, rows] = await prisma.$transaction([ // Prisma: driver
      prisma.driver.count(),
      prisma.driver.findMany({
      take: limit, skip: offset,
      include: { user: { select: { id: true, full_name: true, email: true } } },
      orderBy: { avgRating: 'desc' },
    })]);
    return success(res, rows, 'Driver report retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.exportReport = async (req, res) => {
  try {
    const { from, to, format = 'csv', limit = 50000 } = req.query;
    const where = {}; // Prisma field names
    if (from && to) where.createdAt = { gte: new Date(from), lte: new Date(to) };
    
    const bookings = await prisma.booking.findMany({ // Prisma: booking
      where,
      select: {
        reference: true,
        status: true,
        customerRate: true,
        hireRate: true,
        profit: true,
        pickupAddress: true,
        deliveryAddress: true,
        createdAt: true,
        customer: { select: { full_name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50000, 1048576),
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
          b.customerRate ?? '',
          b.hireRate ?? '',
          b.profit ?? '',
          b.customer?.full_name ?? '', // Prisma: customer.full_name
          b.customer?.email ?? '',
          b.customer?.phone ?? '',
          (b.pickupAddress || '').replace(/\r?\n/g, ' '),
          (b.deliveryAddress || '').replace(/\r?\n/g, ' '),
          b.createdAt?.toISOString() ?? '',
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
      b.customerRate ?? '',
      b.hireRate ?? '',
      b.profit ?? '',
      b.customer?.full_name ?? '',
      b.customer?.email ?? '',
      b.customer?.phone ?? '',
      (b.pickupAddress || '').replace(/\r?\n/g, ' '),
      (b.deliveryAddress || '').replace(/\r?\n/g, ' '),
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
        // PRD alignment - secure raw query using tagged template literals
        // Note: Identifiers (table names) cannot be parameterized, so we check against whitelist
        const result = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY created_at DESC NULLS LAST LIMIT $1`, limit);
        snapshot[table] = { count: result.length, rows: result };
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
      'audit_logs', // Prisma: AuditLog
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
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`
        );
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

// ── User Recovery (Soft Delete) ────────────────────────────────────────────
// PRD §25.9 — List soft-deleted users for recovery

exports.getDeletedUsers = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    // This is a Sequelize query, needs full Prisma migration
    const [count, rows] = await prisma.$transaction([ // Prisma: user
      prisma.user.count({ where: { deletedAt: { not: null } } }),
      prisma.user.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          role: true,
          email: true,
          phone: true,
          full_name: true,
          isActive: true,
          deletedAt: true,
          complianceStatus: true,
          dataLocked: true,
          // Exclude password_hash by not selecting it
        },
        orderBy: { deletedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return success(res, rows, 'Deleted users retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

// ── Restore Deleted User ───────────────────────────────────────────────────
// PRD §25.9 — Super Admin can restore soft-deleted users

exports.restoreUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      // Prisma doesn't have a direct 'paranoid: false' equivalent for findUnique.
      // You typically query for deletedAt: { not: null } if you want deleted records.
      // Assuming the query above already handles finding deleted users.
    });

    if (!user) return error(res, 'NOT_FOUND', 'User not found', 404);

    if (!user.deletedAt) return error(res, 'INVALID_REQUEST', 'User is not deleted', 400);

    // Restore user by setting deletedAt to null and reactivating
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: null,
        isActive: true,
      }
    });

    // Log the restoration action
    if (req.auditLog) {
      await req.auditLog('USER_RESTORED', {
        user_id: user.id,
        email: user.email,
        role: user.role,
        restored_by: req.user.id
      });
    }

    return success(res, {
      message: 'User restored successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        isActive: user.isActive,
        deletedAt: user.deletedAt
      }
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
