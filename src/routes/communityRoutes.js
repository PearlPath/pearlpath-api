const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { authenticateToken, requireVerificationTier, requireRole, optionalAuth } = require('../middleware/authMiddleware');
const { validateCommunityUpdate, validateEventCreation, validateId, validatePagination } = require('../middleware/validationMiddleware');

// Community updates routes
router.get('/updates', optionalAuth, validatePagination, communityController.getCommunityUpdates);
router.get('/updates/nearby', optionalAuth, communityController.getNearbyUpdates);
router.post('/updates', authenticateToken, requireVerificationTier(2), validateCommunityUpdate, communityController.createCommunityUpdate);
router.post('/updates/:id/vote', authenticateToken, validateId, communityController.voteOnUpdate);
router.post('/updates/:id/report', authenticateToken, validateId, communityController.reportUpdate);
router.post('/updates/:id/verify', authenticateToken, requireRole('admin', 'moderator'), validateId, communityController.verifyUpdate);

// Events routes
router.get('/events', optionalAuth, validatePagination, communityController.getEvents);
router.post('/events', authenticateToken, requireVerificationTier(2), validateEventCreation, communityController.createEvent);
router.get('/events/:id', validateId, communityController.getEvent);
router.put('/events/:id', authenticateToken, validateId, communityController.updateEvent);
router.delete('/events/:id', authenticateToken, validateId, communityController.deleteEvent);

// Emergency services locator
router.get('/emergency-services', communityController.getEmergencyServices);

module.exports = router;
