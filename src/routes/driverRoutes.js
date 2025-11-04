const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, requireProfessionalAccess } = require('../middleware/authMiddleware');
const { validateDriverCreation, validateDriverLocationUpdate, validateId } = require('../middleware/validationMiddleware');

// Public routes - Tuk-Tuk Discovery
router.get('/nearby', driverController.findNearbyDrivers);
router.get('/:id', validateId, driverController.getDriver);
router.post('/fare-estimate', driverController.calculateFare);
router.post('/:id/fare', validateId, driverController.calculateDriverFare);

// Protected routes - Driver Management
router.post('/', authenticateToken, requireProfessionalAccess, validateDriverCreation, driverController.createDriver);
router.put('/:id', authenticateToken, validateId, driverController.updateDriver);
router.delete('/:id', authenticateToken, validateId, driverController.deleteDriver);

// Protected routes - Driver Operations
router.put('/:id/online-status', authenticateToken, validateId, driverController.updateOnlineStatus);
router.put('/:id/location', authenticateToken, validateId, validateDriverLocationUpdate, driverController.updateLocation);
router.get('/:id/rides', authenticateToken, validateId, driverController.getDriverRides);
router.get('/:id/stats', authenticateToken, validateId, driverController.getDriverStats);

// Protected routes - Subscription & Earnings (Freemium/Premium)
router.put('/:id/subscription', authenticateToken, validateId, driverController.updateSubscriptionTier);
router.get('/:id/earnings', authenticateToken, validateId, driverController.getDriverEarnings);
router.get('/:id/analytics', authenticateToken, validateId, driverController.getDriverAnalytics);

module.exports = router;

