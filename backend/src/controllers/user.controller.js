// src/controllers/user.controller.js
// PRD §3 — User profile management (all roles)
// PRD §16.4 — Data lock after approval
// PRD §24.3 — Notification preferences

const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { success, error } = require('../utils/response');

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        email: true,
        phone: true,
        full_name: true,
        isActive: true,
        complianceStatus: true,
        dataLocked: true,
        profilePhoto: true,
        dateOfBirth: true,
        notifyEmail: true,
        notifySms: true,
        notifyInApp: true,
        createdAt: true,
        updatedAt: true
      }
    });
    return success(res, { user });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {};
    if (req.body.full_name !== undefined)     updates.full_name = req.body.full_name;
    if (req.body.phone !== undefined)         updates.phone = req.body.phone;
    if (req.body.profile_photo !== undefined) updates.profilePhoto = req.body.profile_photo;
    if (req.body.date_of_birth !== undefined) updates.dateOfBirth = req.body.date_of_birth;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updates
    });

    if (req.auditLog) await req.auditLog('PROFILE_UPDATED', { user_id: req.user.id });
    return success(res, { user: updated }, 'Profile updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return error(res, 'VALIDATION_ERROR', 'current_password and new_password required', 422);
    if (new_password.length < 6) return error(res, 'VALIDATION_ERROR', 'Password must be at least 6 characters', 422);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password_hash: true }
    });

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) return error(res, 'INVALID_CREDENTIALS', 'Current password is incorrect', 401);

    const password_hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password_hash }
    });

    if (req.auditLog) await req.auditLog('PASSWORD_CHANGED', { user_id: req.user.id });
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const { photo_url } = req.body;
    if (!photo_url) {
      return error(res, 'VALIDATION_ERROR', 'photo_url required', 422);
    }

    // PRD §5.7 — Photo stored in Cloudflare R2
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePhoto: photo_url }
    });

    if (req.auditLog) await req.auditLog('PHOTO_UPLOADED', { user_id: req.user.id });
    return success(res, { profile_photo: updated.profilePhoto }, 'Photo updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getNotificationPreferences = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    return success(res, {
      email: user.notifyEmail,
      sms: user.notifySms,
      in_app: user.notifyInApp,
    });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { email, sms, in_app } = req.body;
    const updates = {};
    if (email !== undefined) updates.notifyEmail = !!email;
    if (sms !== undefined)   updates.notifySms = !!sms;
    if (in_app !== undefined) updates.notifyInApp = !!in_app;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updates
    });

    if (req.auditLog) await req.auditLog('NOTIFICATION_PREFS_UPDATED', { user_id: req.user.id, ...updates });
    return success(res, {
      preferences: {
        email: updated.notifyEmail,
        sms: updated.notifySms,
        in_app: updated.notifyInApp
      }
    }, 'Notification preferences updated');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
