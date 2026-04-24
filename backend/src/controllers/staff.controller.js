// src/controllers/staff.controller.js
// PRD §31 — Agency Management
// PRD §32 — Staff Management System
// PRD §33 — Advanced RBAC

const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');
const { ROLES } = require('../constants/roles');

const STAFF_ROLES = [
  ROLES.OPERATIONS_ADMIN,
  ROLES.FINANCE_ADMIN,
  ROLES.CALL_CENTRE_AGENT,
  ROLES.WAREHOUSE_PARTNER, // Acting as warehouse staff in this context
];

/**
 * List all staff members with agency filtering
 * GET /api/v1/staff
 */
exports.listStaff = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { agency_id, role, status } = req.query;

    const where = {
      role: { in: STAFF_ROLES },
      deletedAt: null
    };

    if (agency_id) where.agencyId = agency_id;
    if (role) where.role = role;
    if (status) where.complianceStatus = status; // Reusing complianceStatus as staff status

    const [count, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          role: true,
          agencyId: true,
          isActive: true,
          complianceStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return success(res, rows, 'Staff members retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Create a new internal staff member
 * POST /api/v1/staff
 */
exports.createStaffMember = async (req, res) => {
  try {
    const { full_name, email, phone, role, agency_id, password } = req.body;

    if (!full_name || !email || !role || !agency_id) {
      return error(res, 'VALIDATION_ERROR', 'Name, email, role, and agency_id are required', 422);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'DUPLICATE_ENTRY', 'Email already in use', 409);

    // Default password to phone if not provided, then hash (PRD §11)
    const passwordHash = await bcrypt.hash(password || phone || 'ZitoStaff123!', 12);

    const staff = await prisma.user.create({
      data: {
        full_name,
        email: email.toLowerCase().trim(),
        phone,
        role,
        agencyId: agency_id,
        passwordHash,
        complianceStatus: 'approved', // Staff approved by default upon creation
        isActive: true
      }
    });

    if (req.auditLog) {
      await req.auditLog('STAFF_CREATED', { staff_id: staff.id, role, agency_id, by: req.user.id });
    }

    return success(res, { staff: { id: staff.id, email: staff.email, role: staff.role } }, 'Staff member created successfully', 201);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Deactivate staff member (Soft Delete - PRD §28)
 */
exports.deactivateStaff = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false, deletedAt: new Date() }
    });
    return success(res, null, 'Staff member deactivated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};