// src/controllers/compliance.controller.js
// Admin compliance review endpoints (PRD section 14)

const { success, error } = require('../utils/response');

const ALLOWED_STATUSES = ['approved', 'rejected', 'resubmission_required'];

const createStatusError = (message, statusCode = 422, code = 'VALIDATION_ERROR') => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
};

const applyComplianceStatus = async ({ driverId, status, comment, actorId, transaction }) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw createStatusError(`status must be one of ${ALLOWED_STATUSES.join(', ')}`);
  }

  if (status !== 'approved' && !String(comment || '').trim()) {
    throw createStatusError('comment is required for rejection or resubmission');
  }

  const driver = await Driver.findByPk(driverId, { transaction });
  if (!driver) {
    throw createStatusError('Driver not found', 404, 'NOT_FOUND');
  }

  let compliance = await DriverCompliance.findOne({
    where: { driver_id: driver.id },
    transaction,
  });

  if (!compliance) {
    compliance = await DriverCompliance.create({ driver_id: driver.id }, { transaction });
  }

  const normalizedComment = String(comment || '').trim() || null;
  const payload = {
    compliance_status: status,
    status_updated_at: new Date(),
    status_updated_by: actorId,
  };

  if (status === 'approved') {
    Object.assign(payload, {
      approved_by: actorId,
      approved_at: new Date(),
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      resubmission_comment: null,
    });

    await driver.update({ can_receive_assignments: true, is_available: true }, { transaction });
    await User.update(
      { compliance_status: 'approved', data_locked: true, rejection_reason: null },
      { where: { id: driver.user_id }, transaction },
    );
  } else if (status === 'rejected') {
    Object.assign(payload, {
      approved_by: null,
      approved_at: null,
      rejected_by: actorId,
      rejected_at: new Date(),
      rejection_reason: normalizedComment,
      resubmission_comment: null,
    });

    await driver.update({ can_receive_assignments: false, is_available: false }, { transaction });
    await User.update(
      { compliance_status: 'rejected', data_locked: false, rejection_reason: normalizedComment },
      { where: { id: driver.user_id }, transaction },
    );
  } else {
    Object.assign(payload, {
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      resubmission_comment: normalizedComment,
    });

    await driver.update({ can_receive_assignments: false, is_available: false }, { transaction });
    await User.update(
      { compliance_status: 'resubmission_required', data_locked: false, rejection_reason: null },
      { where: { id: driver.user_id }, transaction },
    );
  }

    const updated = await compliance.update(payload, { transaction });

    return { driver, compliance: updated };
};

exports.getCompliance = async (req, res) => {
  try {
    const driver = await Driver.findByPk(req.params.driverId, {
      include: [{ model: DriverCompliance, as: 'compliance' }],
    });

    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);
    return success(res, { compliance: driver.compliance });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateComplianceStatus = async (req, res) => {
  try {
    const { status, comment } = req.body || {};
    const { driver, compliance } = await applyComplianceStatus({
      driverId: req.params.driverId,
      status,
      comment,
      actorId: req.user.id,
    });

    if (req.auditLog) {
      await req.auditLog('DRIVER_COMPLIANCE_STATUS', {
        driver_id: driver.id,
        status,
        comment,
        by: req.user.id,
      });
    }

    return success(res, { message: `Compliance set to ${status}`, compliance });
  } catch (err) {
    return error(res, err.code || 'SERVER_ERROR', err.message, err.statusCode || 500);
  }
};

exports.updateBulkComplianceStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { driver_ids: driverIds, status, comment } = req.body || {};
    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      await transaction.rollback();
      return error(res, 'VALIDATION_ERROR', 'driver_ids must be a non-empty array', 422);
    }

    const results = [];
    for (const driverId of driverIds) {
      const { driver, compliance } = await applyComplianceStatus({
        driverId,
        status,
        comment,
        actorId: req.user.id,
        transaction,
      });

      results.push({
        driver_id: driver.id,
        compliance_id: compliance.id,
        status,
      });
    }

    await transaction.commit();

    if (req.auditLog) {
      await req.auditLog('DRIVER_COMPLIANCE_BULK_STATUS', {
        driver_ids: driverIds,
        total: driverIds.length,
        status,
        comment,
        by: req.user.id,
      });
    }

    return success(res, {
      message: `${driverIds.length} driver records updated`,
      results,
    });
  } catch (err) {
    await transaction.rollback();
    return error(res, err.code || 'SERVER_ERROR', err.message, err.statusCode || 500);
  }
};
