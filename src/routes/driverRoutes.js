const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, requireProfessionalAccess } = require('../middleware/authMiddleware');
const { validateDriverCreation, validateDriverLocationUpdate, validateId } = require('../middleware/validationMiddleware');

// Public routes
router.get('/nearby', driverController.findNearbyDrivers);
router.get('/:id', validateId, driverController.getDriver);
router.get('/:id/fare', validateId, driverController.calculateFare);

// Protected routes
router.post('/', authenticateToken, requireProfessionalAccess, validateDriverCreation, driverController.createDriver);
router.put('/:id', authenticateToken, validateId, driverController.updateDriver);
router.delete('/:id', authenticateToken, validateId, driverController.deleteDriver);

// Driver-specific routes
router.put('/:id/online-status', authenticateToken, validateId, driverController.updateOnlineStatus);
router.put('/:id/location', authenticateToken, validateId, validateDriverLocationUpdate, driverController.updateLocation);
router.get('/:id/rides', authenticateToken, validateId, driverController.getDriverRides);
router.get('/:id/stats', authenticateToken, validateId, driverController.getDriverStats);

module.exports = router;
