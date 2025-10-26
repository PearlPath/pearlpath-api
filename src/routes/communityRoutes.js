const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');
const { authenticateToken, requireVerificationTier } = require('../middleware/authMiddleware');
const { validateCommunityUpdate, validateEventCreation, validateId, validatePagination } = require('../middleware/validationMiddleware');

// Community updates routes
router.get('/updates', validatePagination, communityController.getCommunityUpdates);
router.post('/updates', authenticateToken, requireVerificationTier(2), validateCommunityUpdate, communityController.createCommunityUpdate);
router.post('/updates/:id/vote', authenticateToken, validateId, communityController.voteOnUpdate);
router.post('/updates/:id/report', authenticateToken, validateId, communityController.reportUpdate);

// Events routes
router.get('/events', validatePagination, communityController.getEvents);
router.post('/events', authenticateToken, requireVerificationTier(2), validateEventCreation, communityController.createEvent);
router.get('/events/:id', validateId, communityController.getEvent);
router.put('/events/:id', authenticateToken, validateId, communityController.updateEvent);
router.delete('/events/:id', authenticateToken, validateId, communityController.deleteEvent);

module.exports = router;
