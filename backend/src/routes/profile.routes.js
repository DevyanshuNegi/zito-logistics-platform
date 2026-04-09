const express = require('express');
const router  = express.Router();
const { authenticate, auditLogger } = require('../middleware/auth');
const userController = require('../controllers/user.controller');

router.use(authenticate, auditLogger);

// GET /api/v1/profile/notifications
router.get('/notifications', userController.getNotificationPreferences);

// PATCH /api/v1/profile/notifications
router.patch('/notifications', userController.updateNotificationPreferences);

// PATCH /api/v1/profile/password
router.patch('/password', userController.changePassword);

// POST /api/v1/profile/photo
router.post('/photo', userController.uploadPhoto);

module.exports = router;
