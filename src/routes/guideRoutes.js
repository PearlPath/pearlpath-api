const express = require('express');
const router = express.Router();
const guideController = require('../controllers/guideController');
const { authenticateToken, requireProfessionalAccess } = require('../middleware/authMiddleware');
const { validateGuideCreation, validateGuideUpdate, validateGuideSearch, validateId } = require('../middleware/validationMiddleware');

// Public routes - Marketplace
router.get('/search', validateGuideSearch, guideController.searchGuides);
router.get('/:id', validateId, guideController.getGuideById);

// Public package & availability routes
router.get('/:id/packages', validateId, guideController.getGuidePackages);
router.get('/:id/availability', validateId, guideController.getAvailabilityCalendar);
router.get('/:id/instant-booking-check', validateId, guideController.checkInstantBooking);

// Protected routes - Guide Management
router.post('/', authenticateToken, requireProfessionalAccess, validateGuideCreation, guideController.createGuide);
router.put('/:id', authenticateToken, validateId, validateGuideUpdate, guideController.updateGuide);
router.delete('/:id', authenticateToken, validateId, guideController.deleteGuide);

// Protected routes - Package Management
router.post('/:id/packages', authenticateToken, validateId, guideController.upsertGuidePackage);
router.put('/:id/packages/:packageId', authenticateToken, validateId, guideController.upsertGuidePackage);

// Protected routes - Earnings & Analytics
router.get('/:id/earnings', authenticateToken, validateId, guideController.getEarningsDashboard);

module.exports = router;
