const Guide = require('../models/Guide');
const User = require('../models/User');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError, handleValidationError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Create guide profile
const createGuide = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const guideData = { ...req.body, userId };

    // Check if user already has a guide profile
    const existingGuide = await Guide.findByUserId(userId);
    if (existingGuide) {
      return res.status(409).json(responseUtils.error('Guide profile already exists', 409));
    }

    const guide = await Guide.create(guideData);

    logger.info(`Guide profile created: ${guide.id} for user: ${userId}`);

    res.status(201).json(responseUtils.success({
      guide: guide.toSafeObject()
    }, 'Guide profile created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get guide profile
const getGuide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const guide = await Guide.findById(id);

    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    res.json(responseUtils.success({
      guide: guide.toPublicObject()
    }, 'Guide profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update guide profile
const updateGuide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile
    if (guide.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const updatedGuide = await guide.update(updates);

    logger.info(`Guide profile updated: ${id}`);

    res.json(responseUtils.success({
      guide: updatedGuide.toSafeObject()
    }, 'Guide profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Search guides nearby
const searchGuides = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, ...filters } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    const guides = await Guide.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius),
      filters
    );

    // Calculate distances and add to response
    const guidesWithDistance = guides.map(guide => {
      const distance = guide.calculateDistance(parseFloat(lat), parseFloat(lng));
      return {
        ...guide.toPublicObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null
      };
    });

    res.json(responseUtils.success({
      guides: guidesWithDistance,
      total: guidesWithDistance.length,
      searchParams: { lat, lng, radius, filters }
    }, 'Guides found successfully'));
  } catch (error) {
    next(error);
  }
};

// Update guide availability
const updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile
    if (guide.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await guide.updateAvailability(isAvailable);

    logger.info(`Guide availability updated: ${id} - ${isAvailable ? 'Available' : 'Unavailable'}`);

    res.json(responseUtils.success({
      isAvailable: guide.isAvailable
    }, 'Availability updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Update guide location
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile
    if (guide.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await guide.updateLocation(parseFloat(lat), parseFloat(lng));

    logger.info(`Guide location updated: ${id} - ${lat}, ${lng}`);

    res.json(responseUtils.success({
      location: { lat: guide.currentLat, lng: guide.currentLng }
    }, 'Location updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Add to portfolio
const addToPortfolio = async (req, res, next) => {
  try {
    const { id } = req.params;
    const portfolioItem = req.body;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile
    if (guide.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await guide.addToPortfolio(portfolioItem);

    logger.info(`Portfolio item added to guide: ${id}`);

    res.json(responseUtils.success({
      portfolio: guide.portfolio
    }, 'Portfolio item added successfully'));
  } catch (error) {
    next(error);
  }
};

// Get guide's bookings
const getGuideBookings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.query;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile or is admin/moderator
    if (guide.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const Booking = require('../models/Booking');
    const bookings = await Booking.findByGuide(id, { status, startDate, endDate });

    res.json(responseUtils.success({
      bookings: bookings.map(booking => booking.toSafeObject())
    }, 'Guide bookings retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get guide statistics
const getGuideStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile or is admin/moderator
    if (guide.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const stats = {
      totalBookings: guide.totalBookings,
      totalReviews: guide.totalReviews,
      rating: guide.rating,
      experience: guide.experience,
      isAvailable: guide.isAvailable,
      verificationStatus: guide.verificationStatus
    };

    res.json(responseUtils.success({
      stats
    }, 'Guide statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete guide profile
const deleteGuide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    // Check if user owns this guide profile or is admin
    if (guide.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await guide.delete();

    logger.info(`Guide profile deleted: ${id}`);

    res.json(responseUtils.success(null, 'Guide profile deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGuide,
  getGuide,
  updateGuide,
  searchGuides,
  updateAvailability,
  updateLocation,
  addToPortfolio,
  getGuideBookings,
  getGuideStats,
  deleteGuide
};
