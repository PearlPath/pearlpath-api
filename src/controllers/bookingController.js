const Booking = require('../models/Booking');
const Guide = require('../models/Guide');
const Driver = require('../models/Driver');
const { responseUtils, businessUtils } = require('../utils/helpers');
const { handleNotFoundError, handleValidationError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Create booking
const createBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookingData = { ...req.body, userId };

    // Validate guide/driver availability
    if (bookingData.guideId) {
      const guide = await Guide.findById(bookingData.guideId);
      if (!guide) {
        throw handleNotFoundError('Guide not found');
      }

      if (!guide.isAvailableForBooking(bookingData.startDate, bookingData.duration)) {
        return res.status(400).json(responseUtils.error('Guide not available for the selected time', 400));
      }
    }

    if (bookingData.driverId) {
      const driver = await Driver.findById(bookingData.driverId);
      if (!driver) {
        throw handleNotFoundError('Driver not found');
      }

      if (!driver.isAvailableForRide(bookingData.startDate, bookingData.duration)) {
        return res.status(400).json(responseUtils.error('Driver not available for the selected time', 400));
      }
    }

    const booking = await Booking.create(bookingData);

    logger.info(`Booking created: ${booking.id} by user: ${userId}`);

    res.status(201).json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get booking by ID
const getBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    res.json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update booking
const updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can update this booking
    const canUpdate = 
      booking.userId === userId ||
      booking.guideId === userId ||
      booking.driverId === userId ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canUpdate) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const updatedBooking = await booking.update(updates);

    logger.info(`Booking updated: ${id}`);

    res.json(responseUtils.success({
      booking: updatedBooking.toSafeObject()
    }, 'Booking updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Confirm booking
const confirmBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can confirm this booking
    const canConfirm = 
      booking.guideId === userId ||
      booking.driverId === userId ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canConfirm) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await booking.confirm();

    logger.info(`Booking confirmed: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking confirmed successfully'));
  } catch (error) {
    next(error);
  }
};

// Start booking
const startBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can start this booking
    const canStart = 
      booking.guideId === userId ||
      booking.driverId === userId ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canStart) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await booking.start();

    logger.info(`Booking started: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking started successfully'));
  } catch (error) {
    next(error);
  }
};

// Complete booking
const completeBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can complete this booking
    const canComplete = 
      booking.guideId === userId ||
      booking.driverId === userId ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canComplete) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await booking.complete();

    // Update commission
    await booking.updateCommission();

    // Increment booking counts
    if (booking.guideId) {
      const guide = await Guide.findById(booking.guideId);
      if (guide) {
        await guide.incrementBookings();
      }
    }

    if (booking.driverId) {
      const driver = await Driver.findById(booking.driverId);
      if (driver) {
        await driver.incrementRides();
      }
    }

    logger.info(`Booking completed: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking completed successfully'));
  } catch (error) {
    next(error);
  }
};

// Cancel booking
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can cancel this booking
    const canCancel = 
      booking.userId === userId ||
      booking.guideId === userId ||
      booking.driverId === userId ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canCancel) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    if (!booking.canBeCancelled()) {
      return res.status(400).json(responseUtils.error('Booking cannot be cancelled at this time', 400));
    }

    const refundAmount = booking.calculateRefundAmount();
    await booking.cancel(userId, reason, refundAmount);

    logger.info(`Booking cancelled: ${id} by user: ${userId}, refund: ${refundAmount}`);

    res.json(responseUtils.success({
      booking: booking.toSafeObject(),
      refundAmount
    }, 'Booking cancelled successfully'));
  } catch (error) {
    next(error);
  }
};

// Rate booking
const rateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user.id;

    if (rating < 1 || rating > 5) {
      return res.status(400).json(responseUtils.error('Rating must be between 1 and 5', 400));
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      throw handleNotFoundError('Booking not found');
    }

    // Check if user can rate this booking
    if (booking.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    if (booking.status !== 'completed') {
      return res.status(400).json(responseUtils.error('Can only rate completed bookings', 400));
    }

    await booking.addRating(rating, review);

    // Update guide/driver rating
    if (booking.guideId) {
      const guide = await Guide.findById(booking.guideId);
      if (guide) {
        await guide.updateRating(rating);
      }
    }

    if (booking.driverId) {
      const driver = await Driver.findById(booking.driverId);
      if (driver) {
        await driver.updateRating(rating);
      }
    }

    logger.info(`Booking rated: ${id} - ${rating} stars by user: ${userId}`);

    res.json(responseUtils.success({
      booking: booking.toSafeObject()
    }, 'Booking rated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get user bookings
const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, type, startDate, endDate, page = 1, limit = 10 } = req.query;

    const bookings = await Booking.findByUser(userId, {
      status,
      type,
      startDate,
      endDate
    });

    const offset = (page - 1) * limit;
    const paginatedBookings = bookings.slice(offset, offset + parseInt(limit));

    res.json(responseUtils.success({
      bookings: paginatedBookings.map(booking => booking.toSafeObject()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.length,
        pages: Math.ceil(bookings.length / limit)
      }
    }, 'User bookings retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get booking statistics
const getBookingStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const bookings = await Booking.findByUser(userId, { startDate, endDate });

    const stats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      inProgress: bookings.filter(b => b.status === 'in_progress').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalAmount: bookings.reduce((sum, b) => sum + parseFloat(b.totalAmount), 0),
      averageRating: bookings
        .filter(b => b.rating)
        .reduce((sum, b, _, arr) => sum + b.rating / arr.length, 0)
    };

    res.json(responseUtils.success({
      stats
    }, 'Booking statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Calculate booking price
const calculatePrice = async (req, res, next) => {
  try {
    const { guideId, driverId, duration, groupSize = 1, distance, surgeMultiplier = 1 } = req.body;

    let totalAmount = 0;
    let breakdown = {};

    if (guideId) {
      const guide = await Guide.findById(guideId);
      if (!guide) {
        throw handleNotFoundError('Guide not found');
      }

      const guidePrice = guide.calculatePrice(parseInt(duration), parseInt(groupSize));
      totalAmount += guidePrice;
      breakdown.guide = {
        hourlyRate: guide.hourlyRate,
        duration: parseInt(duration),
        groupSize: parseInt(groupSize),
        amount: guidePrice
      };
    }

    if (driverId) {
      const driver = await Driver.findById(driverId);
      if (!driver) {
        throw handleNotFoundError('Driver not found');
      }

      const driverPrice = driver.calculatePrice(
        parseFloat(distance || 0),
        parseInt(duration),
        parseFloat(surgeMultiplier)
      );
      totalAmount += driverPrice;
      breakdown.driver = {
        baseRate: driver.baseRate,
        perKmRate: driver.perKmRate,
        perMinuteRate: driver.perMinuteRate,
        distance: parseFloat(distance || 0),
        duration: parseInt(duration),
        surgeMultiplier: parseFloat(surgeMultiplier),
        amount: driverPrice
      };
    }

    const commission = businessUtils.calculateGuideCommission(totalAmount, true) + 
                     businessUtils.calculateDriverCommission(totalAmount);

    res.json(responseUtils.success({
      totalAmount: Math.round(totalAmount * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      breakdown
    }, 'Price calculated successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  getBooking,
  updateBooking,
  confirmBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  rateBooking,
  getUserBookings,
  getBookingStats,
  calculatePrice
};
