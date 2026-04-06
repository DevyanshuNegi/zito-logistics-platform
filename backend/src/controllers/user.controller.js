// src/controllers/user.controller.js
// PRD §3 — User profile management (all roles)
// PRD §16.4 — Data lock after approval
// PRD §24.3 — Notification preferences

const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { success, error } = require('../utils/response');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash'] } });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const allowed = ['full_name', 'phone', 'profile_photo', 'date_of_birth'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    await user.update(updates);
    if (req.auditLog) await req.auditLog('PROFILE_UPDATED', { user_id: user.id });
    return success(res, { message: 'Profile updated', user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return error(res, 'VALIDATION_ERROR', 'current_password and new_password required', 422);
    if (new_password.length < 6) return error(res, 'VALIDATION_ERROR', 'Password must be at least 6 characters', 422);

    const user = await User.scope('withPassword').findByPk(req.user.id);
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) return error(res, 'INVALID_CREDENTIALS', 'Current password is incorrect', 401);

    await user.update({ password_hash: new_password });
    if (req.auditLog) await req.auditLog('PASSWORD_CHANGED', { user_id: user.id });
    return success(res, { message: 'Password changed successfully' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    return success(res, { message: 'Photo upload coming in Phase 2' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getNotificationPreferences = async (req, res) => {
  try {
    // PRD §24.3 — Phase 2
    return success(res, { email: true, sms: true, in_app: true });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    return success(res, { message: 'Notification preferences coming in Phase 2' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};