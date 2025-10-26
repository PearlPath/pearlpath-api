const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateId, validatePagination } = require('../middleware/validationMiddleware');

// PayHere payment routes
router.post('/create-request', authenticateToken, paymentController.createPaymentRequest);
router.post('/notify', paymentController.handlePayHereNotification);
router.get('/status/:orderId', authenticateToken, validateId, paymentController.getPaymentStatus);

// Payment method routes
router.get('/methods', authenticateToken, paymentController.getPaymentMethods);

// Payment history and refunds
router.get('/history', authenticateToken, validatePagination, paymentController.getPaymentHistory);
router.post('/refund', authenticateToken, paymentController.refundPayment);

module.exports = router;
