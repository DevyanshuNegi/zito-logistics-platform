const prisma = require('../utils/prisma');

/**
 * Checks a specific driver's documents for expiry.
 * Updates status to 'resubmission_required' and blocks assignments if expired.
 * PRD §14, §18.1
 * 
 * @param {string} userId - The user ID associated with the driver
 * @returns {Promise<string|null>} - Returns the new compliance status if updated, else null.
 */
const checkDriverExpiry = async (userId) => {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) return null;

    const comp = await prisma.driverCompliance.findUnique({ where: { driverId: driver.id } });
    if (!comp) return null;

    const now = new Date();
    const expiredFields = [];
    if (comp.licenseExpiry && new Date(comp.licenseExpiry) < now) expiredFields.push('licenseExpiry');
    if (comp.policeClearanceExpiry && new Date(comp.policeClearanceExpiry) < now) expiredFields.push('policeClearanceExpiry');
    if (comp.medicalExpiry && new Date(comp.medicalExpiry) < now) expiredFields.push('medicalExpiry');

    if (expiredFields.length > 0) {
      const comment = `Document expired: ${expiredFields.join(', ')}`;
      
      // Update all related records in a transaction to ensure data integrity
      await prisma.$transaction([
        prisma.driver.update({
          where: { id: driver.id },
          data: { canReceiveAssignments: false, isAvailable: false }
        }),
        prisma.driverCompliance.update({
          where: { driverId: driver.id },
          data: {
            complianceStatus: 'resubmission_required',
            resubmissionComment: comment,
          }
        }),
        prisma.user.update({
          where: { id: userId },
          data: { complianceStatus: 'resubmission_required' }
        }),
      ]);
      
      return 'resubmission_required';
    }
  } catch (err) {
    console.error(`[ComplianceService] checkDriverExpiry error for user ${userId}:`, err.message);
  }
  
  return null;
};

/**
 * Scans all currently 'approved' drivers and flags those with expired documents.
 * Intended for use in a daily Cron Job or BullMQ worker (PRD §5.4).
 */
const runSystemWideExpiryCheck = async () => {
  const drivers = await prisma.driver.findMany({
    where: {
      user: {
        complianceStatus: 'approved',
        isActive: true,
        deletedAt: null
      }
    },
    select: { userId: true }
  });

  let flaggedCount = 0;
  for (const d of drivers) {
    const wasUpdated = await checkDriverExpiry(d.userId);
    if (wasUpdated) flaggedCount++;
  }

  return { totalChecked: drivers.length, flagged: flaggedCount };
};

module.exports = {
  checkDriverExpiry,
  runSystemWideExpiryCheck
};