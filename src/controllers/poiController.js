const POI = require('../models/POI');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const locationService = require('../services/locationService');
const { cache } = require('../config/cache');

// Create POI with photo/video verification requirement
const createPOI = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const poiData = { ...req.body, createdBy: userId };

    // Require photo/video verification for all contributions
    if (!poiData.images || poiData.images.length === 0) {
      return res.status(400).json(responseUtils.error(
        'Photo verification required. Please upload at least one image.',
        400
      ));
    }

    // Validate minimum image requirement (at least 1 photo)
    if (poiData.images.length < 1) {
      return res.status(400).json(responseUtils.error(
        'At least one verification photo is required',
        400
      ));
    }

    // Check if location is in Sri Lanka
    if (!locationService.isInSriLanka(poiData.latitude, poiData.longitude)) {
      return res.status(400).json(responseUtils.error(
        'POI must be located in Sri Lanka',
        400
      ));
    }

    const poi = await POI.create(poiData);

    logger.info(`POI created: ${poi.id} by user: ${userId}`);

    res.status(201).json(responseUtils.success({
      poi: poi.toSafeObject(),
      approvalStatus: poi.approvalStatus,
      message: poi.approvalStatus === 'needs_review' 
        ? 'POI submitted for review due to similarity with existing locations'
        : 'POI created and auto-approved'
    }, 'POI created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get POI by ID
const getPOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const poi = await POI.findById(id);

    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    // Increment visit count
    await poi.incrementVisitCount();

    res.json(responseUtils.success({
      poi: poi.toPublicObject()
    }, 'POI retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update POI
const updatePOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    // Check if user created this POI or is admin/moderator
    if (poi.createdBy !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const updatedPOI = await poi.update(updates);

    logger.info(`POI updated: ${id}`);

    res.json(responseUtils.success({
      poi: updatedPOI.toSafeObject()
    }, 'POI updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Search POIs
const searchPOIs = async (req, res, next) => {
  try {
    const { query, category, city, lat, lng, radius = 10 } = req.query;

    let pois;

    if (lat && lng) {
      // Location-based search
      pois = await POI.findNearby(
        parseFloat(lat),
        parseFloat(lng),
        parseInt(radius),
        category
      );
    } else if (query) {
      // Text-based search
      pois = await POI.search(query, { category, city });
    } else {
      return res.status(400).json(responseUtils.error('Search query or location coordinates required', 400));
    }

    // Calculate distances if location provided
    const poisWithDistance = pois.map(poi => {
      const result = poi.toPublicObject();
      if (lat && lng) {
        const distance = poi.calculateDistance(parseFloat(lat), parseFloat(lng));
        result.distance = distance ? Math.round(distance * 100) / 100 : null;
      }
      return result;
    });

    res.json(responseUtils.success({
      pois: poisWithDistance,
      total: poisWithDistance.length,
      searchParams: { query, category, city, lat, lng, radius }
    }, 'POIs found successfully'));
  } catch (error) {
    next(error);
  }
};

// Find nearby POIs with enhanced features
const findNearbyPOIs = async (req, res, next) => {
  try {
    const { 
      lat, 
      lng, 
      radius = 10, 
      category,
      filters = {},
      includeWeather = false,
      includeCrowdLevel = false 
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    // Validate coordinates
    const coordValidation = locationService.validateCoordinates(lat, lng);
    if (!coordValidation.valid) {
      return res.status(400).json(responseUtils.error(coordValidation.error, 400));
    }

    // Check cache first for performance
    const cacheKey = `nearby_pois_${lat}_${lng}_${radius}_${category || 'all'}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      logger.debug(`Cache hit for nearby POIs: ${cacheKey}`);
      return res.json(responseUtils.success(cachedResult, 'Nearby POIs found (cached)'));
    }

    const pois = await POI.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius),
      category
    );

    // Calculate distances and add enhanced data
    const poisWithEnhancedData = await Promise.all(pois.map(async (poi) => {
      const distance = poi.calculateDistance(parseFloat(lat), parseFloat(lng));
      const poiData = {
        ...poi.toPublicObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null,
        distanceText: distance ? `${Math.round(distance * 10) / 10}km away` : null,
        currentStatus: poi.getCurrentStatus()
      };

      // Add crowd level if requested
      if (includeCrowdLevel) {
        poiData.crowdLevel = await getCrowdLevel(poi.id);
      }

      // Add recent safety updates
      poiData.recentAlerts = await getRecentSafetyAlerts(poi.id);

      return poiData;
    }));

    // Get current weather if requested
    let weatherData = null;
    if (includeWeather) {
      try {
        weatherData = await locationService.getCurrentWeather(parseFloat(lat), parseFloat(lng));
      } catch (error) {
        logger.warn('Failed to fetch weather data:', error);
      }
    }

    const result = {
      pois: poisWithEnhancedData,
      total: poisWithEnhancedData.length,
      weather: weatherData,
      searchParams: { lat, lng, radius, category },
      userLocation: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    };

    // Cache results for 5 minutes
    await cache.set(cacheKey, result, 300);

    res.json(responseUtils.success(result, 'Nearby POIs found successfully'));
  } catch (error) {
    next(error);
  }
};

// Add image to POI
const addImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { imageUrl } = req.body;
    const userId = req.user.id;

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    // Check if user created this POI or is admin/moderator
    if (poi.createdBy !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await poi.addImage(imageUrl);

    logger.info(`Image added to POI: ${id}`);

    res.json(responseUtils.success({
      images: poi.images
    }, 'Image added successfully'));
  } catch (error) {
    next(error);
  }
};

// Rate POI
const ratePOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;

    if (rating < 1 || rating > 5) {
      return res.status(400).json(responseUtils.error('Rating must be between 1 and 5', 400));
    }

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    await poi.updateRating(rating);

    logger.info(`POI rated: ${id} - ${rating} stars by user: ${userId}`);

    res.json(responseUtils.success({
      rating: poi.rating,
      totalReviews: poi.totalReviews
    }, 'POI rated successfully'));
  } catch (error) {
    next(error);
  }
};

// Verify POI
const verifyPOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    // Check if user can verify POIs
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Verification access denied', 403));
    }

    await poi.verify(userId);

    logger.info(`POI verified: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      poi: poi.toSafeObject()
    }, 'POI verified successfully'));
  } catch (error) {
    next(error);
  }
};

// Get POI status
const getPOIStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const poi = await POI.findById(id);

    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    const status = poi.getCurrentStatus();

    res.json(responseUtils.success({
      status,
      poi: {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        city: poi.city
      }
    }, 'POI status retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get POIs by category
const getPOIsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { city, limit = 20, offset = 0 } = req.query;

    // This would typically be implemented in the POI model
    // For now, we'll use the search function
    const pois = await POI.search('', { category, city });

    const paginatedPOIs = pois.slice(offset, offset + parseInt(limit));

    res.json(responseUtils.success({
      pois: paginatedPOIs.map(poi => poi.toPublicObject()),
      total: pois.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: pois.length > offset + parseInt(limit)
      }
    }, 'POIs by category retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete POI
const deletePOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    // Check if user created this POI or is admin
    if (poi.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await poi.delete();

    logger.info(`POI deleted: ${id}`);

    res.json(responseUtils.success(null, 'POI deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Approve POI (Admin only)
const approvePOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Admin access required', 403));
    }

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    await poi.approve(userId);

    logger.info(`POI approved: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      poi: poi.toSafeObject()
    }, 'POI approved successfully'));
  } catch (error) {
    next(error);
  }
};

// Reject POI (Admin only)
const rejectPOI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Admin access required', 403));
    }

    if (!reason) {
      return res.status(400).json(responseUtils.error('Rejection reason is required', 400));
    }

    const poi = await POI.findById(id);
    if (!poi) {
      throw handleNotFoundError('POI not found');
    }

    await poi.reject(userId, reason);

    logger.info(`POI rejected: ${id} by user: ${userId}, reason: ${reason}`);

    res.json(responseUtils.success({
      poi: poi.toSafeObject()
    }, 'POI rejected successfully'));
  } catch (error) {
    next(error);
  }
};

// Get POIs pending review (Admin only)
const getPOIsForReview = async (req, res, next) => {
  try {
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Admin access required', 403));
    }

    const pois = await POI.findByApprovalStatus('needs_review');

    res.json(responseUtils.success({
      pois: pois.map(poi => poi.toSafeObject()),
      total: pois.length
    }, 'POIs pending review retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get all POI approval statuses
const getPOIApprovalStats = async (req, res, next) => {
  try {
    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Admin access required', 403));
    }

    const pending = await POI.findByApprovalStatus('pending');
    const needsReview = await POI.findByApprovalStatus('needs_review');
    const approved = await POI.findByApprovalStatus('approved');
    const rejected = await POI.findByApprovalStatus('rejected');

    res.json(responseUtils.success({
      pending: pending.length,
      needsReview: needsReview.length,
      approved: approved.length,
      rejected: rejected.length
    }, 'POI approval stats retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPOI,
  getPOI,
  updatePOI,
  searchPOIs,
  findNearbyPOIs,
  addImage,
  ratePOI,
  verifyPOI,
  getPOIStatus,
  getPOIsByCategory,
  deletePOI,
  approvePOI,
  rejectPOI,
  getPOIsForReview,
  getPOIApprovalStats
};
