// src/controllers/compliance.controller.js
// Admin compliance review endpoints (PRD §14)

const { Driver, DriverCompliance, User } = require('../models');
const { success, error } = require('../utils/response');

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
    const { status, comment } = req.body; // status: approved|rejected|resubmission_required
    const allowed = ['approved', 'rejected', 'resubmission_required'];
    if (!allowed.includes(status)) return error(res, 'VALIDATION_ERROR', `status must be one of ${allowed.join(', ')}`, 422);

    const driver = await Driver.findByPk(req.params.driverId);
    if (!driver) return error(res, 'NOT_FOUND', 'Driver not found', 404);

    let compliance = await DriverCompliance.findOne({ where: { driver_id: driver.id } });
    if (!compliance) compliance = await DriverCompliance.create({ driver_id: driver.id });

    const payload = {
      compliance_status: status,
      status_updated_at: new Date(),
      status_updated_by: req.user.id,
    };
    if (status === 'approved') {
      payload.approved_by = req.user.id;
      payload.approved_at = new Date();
      payload.rejection_reason = null;
      payload.resubmission_comment = null;
      await driver.update({ can_receive_assignments: true, is_available: true });
      await User.update({ compliance_status: 'approved', data_locked: true }, { where: { id: driver.user_id } });
    } else if (status === 'rejected') {
      payload.rejection_reason = comment || null;
      await driver.update({ can_receive_assignments: false, is_available: false });
      await User.update({ compliance_status: 'rejected', rejection_reason: comment || null }, { where: { id: driver.user_id } });
    } else if (status === 'resubmission_required') {
      payload.resubmission_comment = comment || null;
      await driver.update({ can_receive_assignments: false, is_available: false });
      await User.update({ compliance_status: 'resubmission_required', data_locked: false }, { where: { id: driver.user_id } });
    }

    await compliance.update(payload);
    if (req.auditLog) await req.auditLog('DRIVER_COMPLIANCE_STATUS', { driver_id: driver.id, status, comment, by: req.user.id });
    return success(res, { message: `Compliance set to ${status}`, compliance });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
