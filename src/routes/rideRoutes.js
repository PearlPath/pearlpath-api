const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId } = require('../middleware/validationMiddleware');

// All ride endpoints require authentication

// Request and manage rides
router.post('/request', authenticateToken, rideController.requestRide);
router.put('/:id/respond', authenticateToken, validateId, rideController.respondToRideRequest);
router.put('/:id/start', authenticateToken, validateId, rideController.startRide);
router.put('/:id/complete', authenticateToken, validateId, rideController.completeRide);

// Real-time tracking
router.get('/:id/track', authenticateToken, validateId, rideController.trackRide);

// Safety features
router.post('/:id/share', authenticateToken, validateId, rideController.shareTripLink);
router.post('/:id/sos', authenticateToken, validateId, rideController.triggerSOS);
router.post('/:id/report-incident', authenticateToken, validateId, rideController.reportIncident);

module.exports = router;
