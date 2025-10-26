const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken, requireBookingAccess } = require('../middleware/authMiddleware');
const { validateBookingCreation, validateBookingUpdate, validateId, validatePagination } = require('../middleware/validationMiddleware');

// Protected routes
router.post('/', authenticateToken, validateBookingCreation, bookingController.createBooking);
router.get('/my-bookings', authenticateToken, validatePagination, bookingController.getUserBookings);
router.get('/stats', authenticateToken, bookingController.getBookingStats);
router.post('/calculate-price', authenticateToken, bookingController.calculatePrice);

// Booking-specific routes
router.get('/:id', authenticateToken, validateId, requireBookingAccess, bookingController.getBooking);
router.put('/:id', authenticateToken, validateId, requireBookingAccess, validateBookingUpdate, bookingController.updateBooking);
router.post('/:id/confirm', authenticateToken, validateId, requireBookingAccess, bookingController.confirmBooking);
router.post('/:id/start', authenticateToken, validateId, requireBookingAccess, bookingController.startBooking);
router.post('/:id/complete', authenticateToken, validateId, requireBookingAccess, bookingController.completeBooking);
router.post('/:id/cancel', authenticateToken, validateId, requireBookingAccess, bookingController.cancelBooking);
router.post('/:id/rate', authenticateToken, validateId, requireBookingAccess, bookingController.rateBooking);

module.exports = router;
