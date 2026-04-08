const express = require('express');
const router  = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

router.use(authenticate, isAdmin);

// GET /api/v1/user
router.get('/', adminController.getUsers);

// GET /api/v1/user/:id
router.get('/:id', adminController.getUserById);

module.exports = router;
