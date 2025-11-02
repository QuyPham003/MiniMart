const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, deleteUser, getUserStats } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');

// All authenticated users can access these routes
router.get('/', authenticate, getUsers);
router.get('/stats', authenticate, authorize('admin'), getUserStats);
router.get('/:id', authenticate, getUserById);

// Admin only routes
router.post('/', authenticate, authorize('admin'), validateUser, createUser);
router.put('/:id', authenticate, authorize('admin'), updateUser);
router.delete('/:id', authenticate, authorize('admin'), deleteUser);

module.exports = router;
