const Driver = require('../models/Driver');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Create driver profile
const createDriver = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const driverData = { ...req.body, userId };

    // Check if user already has a driver profile
    const existingDriver = await Driver.findByUserId(userId);
    if (existingDriver) {
      return res.status(409).json(responseUtils.error('Driver profile already exists', 409));
    }

    const driver = await Driver.create(driverData);

    logger.info(`Driver profile created: ${driver.id} for user: ${userId}`);

    res.status(201).json(responseUtils.success({
      driver: driver.toSafeObject()
    }, 'Driver profile created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get driver profile
const getDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const driver = await Driver.findById(id);

    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    res.json(responseUtils.success({
      driver: driver.toPublicObject()
    }, 'Driver profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update driver profile
const updateDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile
    if (driver.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const updatedDriver = await driver.update(updates);

    logger.info(`Driver profile updated: ${id}`);

    res.json(responseUtils.success({
      driver: updatedDriver.toSafeObject()
    }, 'Driver profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Find nearby drivers
const findNearbyDrivers = async (req, res, next) => {
  try {
    const { lat, lng, radius = 5, ...filters } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    const drivers = await Driver.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius),
      filters
    );

    // Calculate distances and add to response
    const driversWithDistance = drivers.map(driver => {
      const distance = driver.calculateDistance(parseFloat(lat), parseFloat(lng));
      return {
        ...driver.toPublicObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null,
        location: driver.getLocationData() // Privacy-blurred location
      };
    });

    res.json(responseUtils.success({
      drivers: driversWithDistance,
      total: driversWithDistance.length,
      searchParams: { lat, lng, radius, filters }
    }, 'Nearby drivers found successfully'));
  } catch (error) {
    next(error);
  }
};

// Update driver online status
const updateOnlineStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isOnline } = req.body;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile
    if (driver.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await driver.updateOnlineStatus(isOnline);

    logger.info(`Driver online status updated: ${id} - ${isOnline ? 'Online' : 'Offline'}`);

    res.json(responseUtils.success({
      isOnline: driver.isOnline
    }, 'Online status updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Update driver location
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile
    if (driver.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await driver.updateLocation(parseFloat(lat), parseFloat(lng));

    logger.info(`Driver location updated: ${id} - ${lat}, ${lng}`);

    res.json(responseUtils.success({
      location: { lat: driver.currentLat, lng: driver.currentLng }
    }, 'Location updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Calculate fare estimate
const calculateFare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { distance, duration, surgeMultiplier = 1 } = req.body;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    const fare = driver.calculatePrice(
      parseFloat(distance),
      parseFloat(duration),
      parseFloat(surgeMultiplier)
    );

    const breakdown = {
      baseRate: driver.baseRate,
      distancePrice: distance * driver.perKmRate,
      timePrice: duration * driver.perMinuteRate,
      surgeMultiplier: surgeMultiplier,
      total: fare
    };

    res.json(responseUtils.success({
      fare,
      breakdown,
      driver: {
        id: driver.id,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        rating: driver.rating
      }
    }, 'Fare calculated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get driver's rides
const getDriverRides = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.query;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile or is admin/moderator
    if (driver.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const Booking = require('../models/Booking');
    const rides = await Booking.findByDriver(id, { status, startDate, endDate });

    res.json(responseUtils.success({
      rides: rides.map(ride => ride.toSafeObject())
    }, 'Driver rides retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get driver statistics
const getDriverStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile or is admin/moderator
    if (driver.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const stats = {
      totalRides: driver.totalRides,
      totalReviews: driver.totalReviews,
      rating: driver.rating,
      isOnline: driver.isOnline,
      verificationStatus: driver.verificationStatus,
      vehicleInfo: {
        type: driver.vehicleType,
        model: driver.vehicleModel,
        year: driver.vehicleYear,
        maxPassengers: driver.maxPassengers
      }
    };

    res.json(responseUtils.success({
      stats
    }, 'Driver statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete driver profile
const deleteDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    // Check if user owns this driver profile or is admin
    if (driver.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    await driver.delete();

    logger.info(`Driver profile deleted: ${id}`);

    res.json(responseUtils.success(null, 'Driver profile deleted successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDriver,
  getDriver,
  updateDriver,
  findNearbyDrivers,
  updateOnlineStatus,
  updateLocation,
  calculateFare,
  getDriverRides,
  getDriverStats,
  deleteDriver
};
