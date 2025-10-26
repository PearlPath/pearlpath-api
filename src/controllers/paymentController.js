const crypto = require('crypto');
const axios = require('axios');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// PayHere configuration
const PAYHERE_CONFIG = {
  merchantId: process.env.PAYHERE_MERCHANT_ID,
  merchantSecret: process.env.PAYHERE_MERCHANT_SECRET,
  sandboxUrl: 'https://sandbox.payhere.lk/pay/checkout',
  liveUrl: 'https://www.payhere.lk/pay/checkout',
  notifyUrl: process.env.PAYHERE_NOTIFY_URL || `${process.env.BASE_URL}/api/payments/notify`,
  returnUrl: process.env.PAYHERE_RETURN_URL || `${process.env.FRONTEND_URL}/payment/success`,
  cancelUrl: process.env.PAYHERE_CANCEL_URL || `${process.env.FRONTEND_URL}/payment/cancel`
};

// Create PayHere payment request
const createPaymentRequest = async (req, res, next) => {
  try {
    const { bookingId, amount, currency = 'LKR' } = req.body;
    const userId = req.user.id;

    // Validate booking exists and belongs to user
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    if (booking.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    // Generate unique order ID
    const orderId = `PP_${bookingId}_${Date.now()}`;
    
    // Create payment data for PayHere
    const paymentData = {
      merchant_id: PAYHERE_CONFIG.merchantId,
      return_url: PAYHERE_CONFIG.returnUrl,
      cancel_url: PAYHERE_CONFIG.cancelUrl,
      notify_url: PAYHERE_CONFIG.notifyUrl,
      first_name: req.user.firstName,
      last_name: req.user.lastName,
      email: req.user.email,
      phone: req.user.phone,
      address: booking.pickupLocation?.address || 'Colombo, Sri Lanka',
      city: 'Colombo',
      country: 'Sri Lanka',
      order_id: orderId,
      items: `Booking ${booking.bookingReference}`,
      currency: currency,
      amount: amount.toFixed(2),
      custom_1: bookingId,
      custom_2: userId
    };

    // Generate hash for PayHere
    const hashString = 
      PAYHERE_CONFIG.merchantId +
      orderId +
      amount.toFixed(2) +
      currency +
      paymentData.first_name +
      paymentData.last_name +
      paymentData.email +
      paymentData.phone +
      paymentData.address +
      paymentData.city +
      paymentData.country +
      PAYHERE_CONFIG.merchantSecret;

    const hash = crypto.createHash('sha1').update(hashString).digest('hex').toUpperCase();
    paymentData.hash = hash;

    // Determine PayHere URL based on environment
    const payHereUrl = process.env.NODE_ENV === 'production' 
      ? PAYHERE_CONFIG.liveUrl 
      : PAYHERE_CONFIG.sandboxUrl;

    logger.info(`PayHere payment request created for booking: ${bookingId}, order: ${orderId}`);

    res.json(responseUtils.success({
      paymentData,
      payHereUrl,
      orderId
    }, 'Payment request created successfully'));
  } catch (error) {
    next(error);
  }
};

// Handle PayHere notification/callback
const handlePayHereNotification = async (req, res, next) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      custom_1, // bookingId
      custom_2  // userId
    } = req.body;

    // Verify the payment
    const verificationString = 
      PAYHERE_CONFIG.merchantSecret +
      merchant_id +
      order_id +
      payment_id +
      payhere_amount +
      payhere_currency +
      status_code;

    const verificationHash = crypto.createHash('md5').update(verificationString).digest('hex').toUpperCase();

    if (verificationHash !== md5sig) {
      logger.error('PayHere notification verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const bookingId = custom_1;
    const userId = custom_2;

    // Update booking payment status based on PayHere response
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      logger.error(`Booking not found for PayHere notification: ${bookingId}`);
      return res.status(404).json({ error: 'Booking not found' });
    }

    let paymentStatus;
    switch (status_code) {
      case '2': // Success
        paymentStatus = 'completed';
        await booking.updatePaymentStatus('completed', 'payhere', payment_id);
        logger.info(`PayHere payment completed for booking: ${bookingId}, payment: ${payment_id}`);
        break;
      case '-1': // Canceled
        paymentStatus = 'canceled';
        await booking.updatePaymentStatus('canceled', 'payhere', payment_id);
        logger.info(`PayHere payment canceled for booking: ${bookingId}, payment: ${payment_id}`);
        break;
      case '-2': // Failed
        paymentStatus = 'failed';
        await booking.updatePaymentStatus('failed', 'payhere', payment_id);
        logger.info(`PayHere payment failed for booking: ${bookingId}, payment: ${payment_id}`);
        break;
      case '0': // Pending
        paymentStatus = 'pending';
        await booking.updatePaymentStatus('pending', 'payhere', payment_id);
        logger.info(`PayHere payment pending for booking: ${bookingId}, payment: ${payment_id}`);
        break;
      default:
        logger.warn(`Unknown PayHere status code: ${status_code} for booking: ${bookingId}`);
        paymentStatus = 'unknown';
    }

    // Return success response to PayHere
    res.json({ status: 'success' });
  } catch (error) {
    logger.error('Error handling PayHere notification:', error);
    next(error);
  }
};

// Get payment status
const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // This would typically query PayHere API for payment status
    // For now, returning a placeholder response
    const paymentStatus = {
      orderId,
      status: 'pending',
      amount: 0,
      currency: 'LKR',
      paymentId: null,
      createdAt: new Date().toISOString()
    };

    res.json(responseUtils.success({
      paymentStatus
    }, 'Payment status retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get payment methods (PayHere supported methods)
const getPaymentMethods = async (req, res, next) => {
  try {
    const paymentMethods = [
      {
        id: 'credit_card',
        name: 'Credit Card',
        type: 'card',
        description: 'Visa, MasterCard, American Express',
        enabled: true
      },
      {
        id: 'debit_card',
        name: 'Debit Card',
        type: 'card',
        description: 'Visa Debit, MasterCard Debit',
        enabled: true
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        type: 'bank',
        description: 'Direct bank transfer',
        enabled: true
      },
      {
        id: 'ezcash',
        name: 'eZ Cash',
        type: 'mobile',
        description: 'Dialog eZ Cash mobile payment',
        enabled: true
      },
      {
        id: 'mobitel',
        name: 'Mobitel mCash',
        type: 'mobile',
        description: 'Mobitel mCash mobile payment',
        enabled: true
      }
    ];

    res.json(responseUtils.success({
      paymentMethods
    }, 'Payment methods retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get payment history
const getPaymentHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, limit = 20, offset = 0 } = req.query;

    // This would typically query the payments table
    // For now, returning a placeholder response
    const payments = [];

    res.json(responseUtils.success({
      payments,
      total: payments.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      }
    }, 'Payment history retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Refund payment
const refundPayment = async (req, res, next) => {
  try {
    const { paymentId, amount, reason } = req.body;
    const userId = req.user.id;

    // This would typically process the refund through PayHere
    // For now, returning a placeholder response
    const refund = {
      id: require('uuid').v4(),
      paymentId,
      amount,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    logger.info(`Refund requested: ${refund.id} for payment: ${paymentId}`);

    res.status(201).json(responseUtils.success({
      refund
    }, 'Refund requested successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Validate PayHere configuration
const validatePayHereConfig = () => {
  const required = [
    'PAYHERE_MERCHANT_ID',
    'PAYHERE_MERCHANT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error(`Missing PayHere configuration: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
};

module.exports = {
  createPaymentRequest,
  handlePayHereNotification,
  getPaymentStatus,
  getPaymentMethods,
  getPaymentHistory,
  refundPayment,
  validatePayHereConfig
};