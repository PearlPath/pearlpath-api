const POI = require('../models/POI');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Create POI
const createPOI = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const poiData = { ...req.body, createdBy: userId };

    const poi = await POI.create(poiData);

    logger.info(`POI created: ${poi.id} by user: ${userId}`);

    res.status(201).json(responseUtils.success({
      poi: poi.toSafeObject()
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

// Find nearby POIs
const findNearbyPOIs = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, category } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    const pois = await POI.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius),
      category
    );

    // Calculate distances and add to response
    const poisWithDistance = pois.map(poi => {
      const distance = poi.calculateDistance(parseFloat(lat), parseFloat(lng));
      return {
        ...poi.toPublicObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null
      };
    });

    res.json(responseUtils.success({
      pois: poisWithDistance,
      total: poisWithDistance.length,
      searchParams: { lat, lng, radius, category }
    }, 'Nearby POIs found successfully'));
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
  deletePOI
};
