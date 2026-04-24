const prisma = require('../utils/prisma');
const { sendEmail } = require('./notification.service');
const logger = require('../utils/logger');

/**
 * PRD §44.10 — Operations Escalation System levels
 */
const ESCALATION_LEVELS = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  MANAGER: 3,
  SUPER_ADMIN: 4
};

/**
 * SLA Timers (in minutes) for escalation transitions based on severity
 */
const SLA_CONFIG = {
  low: 1440,      // 24 hours
  medium: 720,    // 12 hours
  high: 240,      // 4 hours
  critical: 60    // 1 hour
};

/**
 * Creates a new internal alert and triggers the initial notification.
 * PRD §39 — Internal Alert System
 */
exports.createAlert = async (data) => {
  const { type, severity, message, agencyId, entityType, entityId, metadata } = data;

  const slaMinutes = SLA_CONFIG[severity] || SLA_CONFIG.medium;
  const nextEscalationAt = new Date(Date.now() + slaMinutes * 60000);

  const alert = await prisma.internalAlert.create({
    data: {
      type,
      severity,
      message,
      agencyId,
      entityType,
      entityId,
      metadata,
      status: 'pending',
      escalationLevel: ESCALATION_LEVELS.LEVEL_1,
      nextEscalationAt
    },
    include: { agency: true }
  });

  // Initial Notification
  await sendEmail({
    to: process.env.OPS_ADMIN_EMAIL,
    subject: `🚨 NEW ALERT: ${type} (${severity.toUpperCase()})`,
    text: `Agency: ${alert.agency?.name || 'Global'}\nMessage: ${message}`
  });

  return alert;
};

/**
 * Scans for stale pending alerts and escalates them to the next management level.
 * PRD §44.10 — Operations Escalation System (L1 -> L2 -> Manager -> Super Admin)
 */
exports.processEscalations = async () => {
  const now = new Date();

  const alerts = await prisma.internalAlert.findMany({
    where: {
      status: 'pending', // PRD §39: Acknowledge stops escalation
      nextEscalationAt: { lte: now },
      escalationLevel: { lt: ESCALATION_LEVELS.SUPER_ADMIN }
    },
    include: { agency: true }
  });

  for (const alert of alerts) {
    const nextLevel = alert.escalationLevel + 1;
    const slaMinutes = SLA_CONFIG[alert.severity] || SLA_CONFIG.medium;
    
    await prisma.internalAlert.update({
      where: { id: alert.id },
      data: {
        escalationLevel: nextLevel,
        nextEscalationAt: new Date(Date.now() + slaMinutes * 60000),
        severity: nextLevel >= ESCALATION_LEVELS.MANAGER ? 'critical' : alert.severity
      }
    });

    const recipient = nextLevel >= ESCALATION_LEVELS.SUPER_ADMIN ? process.env.SUPER_ADMIN_EMAIL : process.env.OPS_ADMIN_EMAIL;
    await sendEmail({
      to: recipient,
      subject: `[ESCALATION L${nextLevel}] ${alert.type} - ${alert.agency?.name || 'Global'}`,
      text: `Alert ${alert.id} has reached escalation level ${nextLevel}.\nMessage: ${alert.message}`
    });
    logger.warn(`Alert ${alert.id} escalated to level ${nextLevel}`);
  }
};