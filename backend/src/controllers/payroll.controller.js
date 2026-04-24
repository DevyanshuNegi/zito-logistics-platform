// src/controllers/payroll.controller.js
// PRD §44.2 — Driver Payroll Engine
// PRD §15 — B2C Disbursement
// PRD §44.1 — Driver Shift & Attendance Integration
// PRD §44.9 — Incentive & Penalty System

const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');
const { b2cDisbursement } = require('../services/mpesa');
const logger = require('../utils/logger');

/**
 * Automated Engine to calculate and preview driver earnings.
 * Handles Trip-based, Salary-based, Incentives, and Penalties.
 */
exports.previewPayroll = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate } = req.query;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    // 1. Trip-based Earnings (PRD §44.2)
    // Sum of hireRate for completed bookings not yet paid out
    const bookings = await prisma.booking.findMany({
      where: {
        assignedDriverId: driverId,
        status: 'completed',
        payoutStatus: 'pending',
        completedAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      }
    });
    const tripTotal = bookings.reduce((sum, b) => sum + Number(b.hireRate || 0), 0);

    // 2. Hourly / Daily Salary Model (PRD §44.1 & §44.2)
    let salaryTotal = 0;
    if (driver.payModel === 'salary') {
      const shifts = await prisma.driverShift.findMany({
        where: {
          driverId,
          attendanceStatus: 'present',
          endTime: { not: null },
          startTime: {
            gte: startDate ? new Date(startDate) : undefined,
            lte: endDate ? new Date(endDate) : undefined
          }
        }
      });
      salaryTotal = shifts.reduce((sum, s) => {
        const hours = (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60);
        return sum + (hours * (driver.hourlyRate || 0));
      }, 0);
    }

    // 3. Incentives & Penalties (PRD §44.9)
    const adjustments = await prisma.driverAdjustment.findMany({
      where: {
        driverId,
        status: 'pending',
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      }
    });

    const incentives = adjustments.filter(a => a.type === 'incentive').reduce((sum, a) => sum + Number(a.amount), 0);
    const penalties = adjustments.filter(a => a.type === 'penalty').reduce((sum, a) => sum + Number(a.amount), 0);

    const totalNet = tripTotal + salaryTotal + incentives - penalties;

    return success(res, {
      summary: {
        trips: tripTotal,
        salary: salaryTotal,
        incentives,
        penalties,
        totalNet
      },
      meta: {
        driverName: driver.user.full_name,
        payModel: driver.payModel,
        period: { start: startDate, end: endDate }
      }
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

/**
 * Automated Payout Calculation Engine (PRD §44.2)
 * Finalizes payroll and triggers B2C disbursement (PRD §15).
 */
exports.executePayroll = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver || !driver.user.phone) return error(res, 'NOT_FOUND', 'Driver phone missing for payout', 404);

    const payout = await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({ where: { assignedDriverId: driverId, status: 'completed', payoutStatus: 'pending' } });
      const adjustments = await tx.driverAdjustment.findMany({ where: { driverId, status: 'pending' } });

      const netAmount = bookings.reduce((s, b) => s + Number(b.hireRate), 0) + 
                        adjustments.reduce((s, a) => s + (a.type === 'incentive' ? Number(a.amount) : -Number(a.amount)), 0);

      if (netAmount <= 0) throw new Error('No pending earnings to payout');

      const record = await tx.payrollRecord.create({
        data: {
          driverId,
          amount: netAmount,
          status: 'processing'
        }
      });

      await tx.booking.updateMany({ where: { id: { in: bookings.map(b => b.id) } }, data: { payoutStatus: 'settled', payrollId: record.id } });
      await tx.driverAdjustment.updateMany({ where: { id: { in: adjustments.map(a => a.id) } }, data: { status: 'settled', payrollId: record.id } });

      return { record, netAmount, phone: driver.user.phone };
    });

    // PRD §15 B2C Disbursement via M-Pesa
    const mpesaRes = await b2cDisbursement({ phone: payout.phone, amount: payout.netAmount, remarks: `Payroll-${payout.record.id}` });
    await prisma.payrollRecord.update({ where: { id: payout.record.id }, data: { status: 'completed', transactionReference: mpesaRes.ConversationID } });

    if (req.auditLog) await req.auditLog('PAYROLL_PROCESSED', { driver_id: driverId, amount: payout.netAmount });
    return success(res, { payout: payout.record }, 'Payroll successfully processed and disbursed');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};