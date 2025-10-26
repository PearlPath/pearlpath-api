const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { validateId, validatePagination } = require('../middleware/validationMiddleware');

// User management routes
router.get('/users', authenticateToken, requireRole('admin', 'moderator'), validatePagination, adminController.getAllUsers);
router.get('/users/:id', authenticateToken, requireRole('admin', 'moderator'), validateId, adminController.getUserById);
router.put('/users/:id/status', authenticateToken, requireRole('admin'), validateId, adminController.updateUserStatus);

// Guide management routes
router.get('/guides', authenticateToken, requireRole('admin', 'moderator'), validatePagination, adminController.getAllGuides);
router.put('/guides/:id/verify', authenticateToken, requireRole('admin', 'moderator'), validateId, adminController.verifyGuide);

// Driver management routes
router.get('/drivers', authenticateToken, requireRole('admin', 'moderator'), validatePagination, adminController.getAllDrivers);
router.put('/drivers/:id/verify', authenticateToken, requireRole('admin', 'moderator'), validateId, adminController.verifyDriver);

// Booking management routes
router.get('/bookings', authenticateToken, requireRole('admin', 'moderator'), validatePagination, adminController.getAllBookings);

// Reports and moderation routes
router.get('/reports', authenticateToken, requireRole('admin', 'moderator'), validatePagination, adminController.getReports);
router.put('/reports/:id', authenticateToken, requireRole('admin', 'moderator'), validateId, adminController.handleReport);

// Platform statistics and health
router.get('/stats', authenticateToken, requireRole('admin'), adminController.getPlatformStats);
router.get('/health', authenticateToken, requireRole('admin'), adminController.getSystemHealth);

module.exports = router;
