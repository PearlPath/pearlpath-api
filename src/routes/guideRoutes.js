const express = require('express');
const router = express.Router();
const guideController = require('../controllers/guideController');
const { authenticateToken, requireProfessionalAccess } = require('../middleware/authMiddleware');
const { validateGuideCreation, validateGuideUpdate, validateGuideSearch, validateId } = require('../middleware/validationMiddleware');

// Public routes
router.get('/search', validateGuideSearch, guideController.searchGuides);
router.get('/:id', validateId, guideController.getGuide);

// Protected routes
router.post('/', authenticateToken, requireProfessionalAccess, validateGuideCreation, guideController.createGuide);
router.put('/:id', authenticateToken, validateId, validateGuideUpdate, guideController.updateGuide);
router.delete('/:id', authenticateToken, validateId, guideController.deleteGuide);

// Guide-specific routes
router.put('/:id/availability', authenticateToken, validateId, guideController.updateAvailability);
router.put('/:id/location', authenticateToken, validateId, guideController.updateLocation);
router.post('/:id/portfolio', authenticateToken, validateId, guideController.addToPortfolio);
router.get('/:id/bookings', authenticateToken, validateId, guideController.getGuideBookings);
router.get('/:id/stats', authenticateToken, validateId, guideController.getGuideStats);

module.exports = router;
