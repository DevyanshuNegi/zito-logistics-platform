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
    const { photo_url, photo_base64 } = req.body;
    if (!photo_url && !photo_base64) {
      return error(res, 'VALIDATION_ERROR', 'photo_url or photo_base64 required', 422);
    }
    const user = await User.findByPk(req.user.id);
    const payload = photo_url || photo_base64;
    await user.update({ profile_photo: payload });
    if (req.auditLog) await req.auditLog('PHOTO_UPLOADED', { user_id: user.id });
    return success(res, { message: 'Photo updated', profile_photo: payload });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    return success(res, {
      email: user.notify_email,
      sms: user.notify_sms,
      in_app: user.notify_in_app,
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { email, sms, in_app } = req.body;
    const user = await User.findByPk(req.user.id);
    const updates = {};
    if (email !== undefined) updates.notify_email = !!email;
    if (sms !== undefined) updates.notify_sms = !!sms;
    if (in_app !== undefined) updates.notify_in_app = !!in_app;
    await user.update(updates);
    if (req.auditLog) await req.auditLog('NOTIFICATION_PREFS_UPDATED', { user_id: user.id, ...updates });
    return success(res, { message: 'Notification preferences updated', preferences: updates });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
