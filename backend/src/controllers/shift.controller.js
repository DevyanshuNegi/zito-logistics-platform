// src/controllers/shift.controller.js
// PRD §44.1 — Driver Shift & Attendance System
// PRD §31 — Agency Management

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

/**
 * List all driver shifts with filters for attendance monitoring.
 * GET /api/v1/admin/shifts
 */
exports.listShifts = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { driver_id, agency_id, status, start_date, end_date } = req.query;

    const where = {};
    if (driver_id) where.driverId = driver_id;
    if (status) where.attendanceStatus = status;
    
    // Agency scoping for Branch Managers (PRD §31)
    if (agency_id || req.user.agencyId) {
      where.driver = {
        user: {
          agencyId: agency_id || req.user.agencyId
        }
      };
    }

    if (start_date || end_date) {
      where.startTime = {
        gte: start_date ? new Date(start_date) : undefined,
        lte: end_date ? new Date(end_date) : undefined
      };
    }

    const [count, rows] = await prisma.$transaction([
      prisma.driverShift.count({ where }),
      prisma.driverShift.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          driver: {
            include: { user: { select: { id: true, full_name: true, phone: true } } }
          }
        },
        orderBy: { startTime: 'desc' }
      })
    ]);

    return success(res, rows, 'Shifts retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Get a specific shift record.
 */
exports.getShiftById = async (req, res) => {
  try {
    const shift = await prisma.driverShift.findUnique({
      where: { id: req.params.id },
      include: {
        driver: {
          include: { user: { select: { id: true, full_name: true, phone: true } } }
        }
      }
    });

    if (!shift) return error(res, 'NOT_FOUND', 'Shift not found', 404);
    return success(res, { shift });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};