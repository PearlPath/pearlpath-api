const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/authMiddleware');
const { validatePOICreation, validatePOISearch, validateLocation, validateId } = require('../middleware/validationMiddleware');

// Public routes
router.get('/search', optionalAuth, validatePOISearch, poiController.searchPOIs);
router.get('/nearby', optionalAuth, validateLocation, poiController.findNearbyPOIs);
router.get('/category/:category', poiController.getPOIsByCategory);
router.get('/:id', validateId, poiController.getPOI);
router.get('/:id/status', validateId, poiController.getPOIStatus);

// Protected routes
router.post('/', authenticateToken, validatePOICreation, poiController.createPOI);
router.put('/:id', authenticateToken, validateId, poiController.updatePOI);
router.delete('/:id', authenticateToken, validateId, poiController.deletePOI);

// POI-specific routes
router.post('/:id/images', authenticateToken, validateId, poiController.addImage);
router.post('/:id/rate', authenticateToken, validateId, poiController.ratePOI);
router.post('/:id/verify', authenticateToken, requireRole('admin', 'moderator'), validateId, poiController.verifyPOI);

module.exports = router;
