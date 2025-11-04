const Driver = require('../models/Driver');
const User = require('../models/User');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const { cache } = require('../config/cache');
const { db } = require('../config/database');
const locationService = require('../services/locationService');
const weatherService = require('../services/weatherService');

// Create driver profile with KYC verification requirement
const createDriver = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const driverData = { ...req.body, userId };

    // Require tier 2+ verification for driver profile (NIC + Vehicle Registration)
    const user = await User.findById(userId);
    if (!user || user.verificationTier < 2) {
      return res.status(403).json(responseUtils.error(
        'KYC verification (Tier 2+) required. Please verify NIC and vehicle registration documents.',
        403
      ));
    }

    // Check if user already has a driver profile
    const existingDriver = await Driver.findByUserId(userId);
    if (existingDriver) {
      return res.status(409).json(responseUtils.error('Driver profile already exists', 409));
    }

    // Validate vehicle registration and license
    if (!driverData.vehicleNumber || !driverData.licenseNumber || !driverData.insuranceNumber) {
      return res.status(400).json(responseUtils.error(
        'Vehicle number, license number, and insurance number are required',
        400
      ));
    }

    const driver = await Driver.create(driverData);

    logger.info(`Driver profile created: ${driver.id} for user: ${userId} (KYC Tier ${user.verificationTier})`);

    res.status(201).json(responseUtils.success({
      driver: driver.toSafeObject(),
      verificationStatus: driver.verificationStatus,
      verificationTier: user.verificationTier,
      message: 'Vehicle documents submitted for verification. You will be notified once approved.'
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

// Find nearby drivers with live locations (Tuk-Tuk Discovery)
const findNearbyDrivers = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 5, vehicleType, minRating, sortBy = 'distance' } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    // Validate coordinates
    const coords = locationService.validateCoordinates(parseFloat(latitude), parseFloat(longitude));

    // Check cache first
    const cacheKey = `drivers_${coords.latitude}_${coords.longitude}_${radius}_${vehicleType || 'all'}_${sortBy}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info(`Returning cached drivers near ${coords.latitude}, ${coords.longitude}`);
      return res.json(responseUtils.success(cached, 'Nearby drivers found (cached)'));
    }

    // Build filters
    const filters = {
      isOnline: true,
      verificationStatus: 'verified' // Only show verified drivers
    };
    
    if (vehicleType) {
      filters.vehicleType = vehicleType;
    }
    
    if (minRating) {
      filters.minRating = parseFloat(minRating);
    }

    // Find nearby online verified drivers
    const drivers = await Driver.findNearby(
      coords.latitude,
      coords.longitude,
      parseInt(radius),
      filters
    );

    // Calculate distances and prepare response with privacy-blurred locations
    const driversWithData = drivers.map(driver => {
      const distance = locationService.calculateDistance(
        coords.latitude,
        coords.longitude,
        driver.currentLat,
        driver.currentLng
      );

      // Privacy-blurred location (round to ~100m precision when stationary)
      const blurredLocation = driver.isOnline && driver.lastLocationUpdate ? 
        getBlurredLocation(driver.currentLat, driver.currentLng, driver.isOnline) :
        { latitude: null, longitude: null, isApproximate: true };

      return {
        id: driver.id,
        name: driver.user?.firstName + ' ' + driver.user?.lastName,
        profileImage: driver.user?.profileImage,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        vehicleYear: driver.vehicleYear,
        vehicleNumber: maskVehicleNumber(driver.vehicleNumber), // Partially hidden
        maxPassengers: driver.maxPassengers,
        rating: driver.rating,
        totalReviews: driver.totalReviews,
        totalRides: driver.totalRides,
        baseRate: driver.baseRate,
        perKmRate: driver.perKmRate,
        perMinuteRate: driver.perMinuteRate,
        verificationStatus: driver.verificationStatus,
        verificationTier: driver.user?.verificationTier || 1,
        distance: Math.round(distance * 100) / 100,
        distanceText: getDistanceText(distance),
        location: blurredLocation,
        estimatedArrival: calculateETA(distance), // minutes
        isOnline: driver.isOnline,
        lastActive: driver.lastLocationUpdate
      };
    });

    // Sort drivers
    const sortedDrivers = sortDrivers(driversWithData, sortBy);

    const result = {
      drivers: sortedDrivers,
      total: sortedDrivers.length,
      searchParams: {
        radius: parseInt(radius),
        vehicleType: vehicleType || 'all',
        minRating: minRating ? parseFloat(minRating) : null,
        sortBy
      },
      userLocation: {
        latitude: coords.latitude,
        longitude: coords.longitude
      }
    };

    // Cache for 1 minute (drivers move frequently)
    cache.set(cacheKey, result, 60);

    res.json(responseUtils.success(result, 'Nearby drivers found successfully'));
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

// Calculate fare estimate with transparent breakdown
const calculateFare = async (req, res, next) => {
  try {
    const { 
      pickupLat, 
      pickupLng, 
      dropoffLat, 
      dropoffLng,
      vehicleType = 'standard',
      checkWeather = true,
      isPeakTime = false
    } = req.body;

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return res.status(400).json(responseUtils.error(
        'Pickup and dropoff coordinates are required',
        400
      ));
    }

    // Calculate distance and estimated duration
    const distance = locationService.calculateDistance(
      parseFloat(pickupLat),
      parseFloat(pickupLng),
      parseFloat(dropoffLat),
      parseFloat(dropoffLng)
    );

    // Estimate duration (average speed: 25 km/h for tuk-tuks in traffic)
    const estimatedDuration = (distance / 25) * 60; // minutes

    // Get base rates for vehicle type
    const baseRates = getBaseRates(vehicleType);

    // Calculate base fare
    let breakdown = {
      baseRate: baseRates.base,
      distanceCharge: Math.round(distance * baseRates.perKm * 100) / 100,
      timeCharge: Math.round(estimatedDuration * baseRates.perMinute * 100) / 100,
      subtotal: 0
    };

    breakdown.subtotal = breakdown.baseRate + breakdown.distanceCharge + breakdown.timeCharge;

    // Apply surge multipliers
    let surgeMultipliers = [];
    let totalSurge = 0;

    // Weather multiplier (rain = +10-15%)
    if (checkWeather) {
      try {
        const weather = await weatherService.getCurrentWeather(pickupLat, pickupLng);
        if (weather && weather.weather && weather.weather[0]) {
          const isRaining = ['Rain', 'Drizzle', 'Thunderstorm'].includes(weather.weather[0].main);
          if (isRaining) {
            const weatherSurge = 0.15; // 15% for rain
            surgeMultipliers.push({
              type: 'weather',
              reason: 'Rainy conditions',
              percentage: 15,
              amount: Math.round(breakdown.subtotal * weatherSurge * 100) / 100
            });
            totalSurge += weatherSurge;
          }
        }
      } catch (error) {
        logger.warn('Could not fetch weather data for fare calculation', error);
      }
    }

    // Peak time surge (holidays, events, rush hours)
    if (isPeakTime) {
      const peakSurge = 0.20; // 20% for peak time
      surgeMultipliers.push({
        type: 'peak_time',
        reason: 'Peak hours / Holiday',
        percentage: 20,
        amount: Math.round(breakdown.subtotal * peakSurge * 100) / 100
      });
      totalSurge += peakSurge;
    }

    // Calculate surge amount
    breakdown.surgeCharges = surgeMultipliers;
    breakdown.totalSurgeAmount = surgeMultipliers.reduce((sum, s) => sum + s.amount, 0);
    breakdown.surgeMultiplier = 1 + totalSurge;

    // Calculate final fare
    breakdown.estimatedFare = Math.round((breakdown.subtotal + breakdown.totalSurgeAmount) * 100) / 100;
    
    // Add platform fee (5%)
    breakdown.platformFee = Math.round(breakdown.estimatedFare * 0.05 * 100) / 100;
    breakdown.totalFare = Math.round((breakdown.estimatedFare + breakdown.platformFee) * 100) / 100;

    // Fare range (±10% variance for final fare)
    const fareRange = {
      min: Math.round(breakdown.totalFare * 0.90 * 100) / 100,
      max: Math.round(breakdown.totalFare * 1.10 * 100) / 100
    };

    res.json(responseUtils.success({
      breakdown,
      fareRange,
      distance: Math.round(distance * 100) / 100,
      estimatedDuration: Math.round(estimatedDuration),
      vehicleType,
      message: 'Estimated fare may vary by ±10% based on actual route and traffic'
    }, 'Fare calculated successfully'));
  } catch (error) {
    next(error);
  }
};

// Calculate fare for specific driver
const calculateDriverFare = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { distance, duration, weatherMultiplier = 1, peakTimeMultiplier = 1 } = req.body;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    if (!driver.isOnline) {
      return res.status(400).json(responseUtils.error('Driver is currently offline', 400));
    }

    // Calculate base fare
    const baseRate = driver.baseRate;
    const distancePrice = parseFloat(distance) * driver.perKmRate;
    const timePrice = parseFloat(duration) * driver.perMinuteRate;
    const subtotal = baseRate + distancePrice + timePrice;

    // Apply multipliers
    const totalMultiplier = parseFloat(weatherMultiplier) * parseFloat(peakTimeMultiplier);
    const surgeAmount = subtotal * (totalMultiplier - 1);
    const estimatedFare = subtotal + surgeAmount;

    // Platform fee (5%)
    const platformFee = estimatedFare * 0.05;
    const totalFare = estimatedFare + platformFee;

    const breakdown = {
      baseRate: Math.round(baseRate * 100) / 100,
      distanceCharge: Math.round(distancePrice * 100) / 100,
      timeCharge: Math.round(timePrice * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      weatherMultiplier: parseFloat(weatherMultiplier),
      peakTimeMultiplier: parseFloat(peakTimeMultiplier),
      surgeAmount: Math.round(surgeAmount * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      estimatedFare: Math.round(estimatedFare * 100) / 100,
      totalFare: Math.round(totalFare * 100) / 100
    };

    res.json(responseUtils.success({
      breakdown,
      driver: {
        id: driver.id,
        name: driver.user?.firstName + ' ' + driver.user?.lastName,
        vehicleType: driver.vehicleType,
        vehicleModel: driver.vehicleModel,
        vehicleNumber: maskVehicleNumber(driver.vehicleNumber),
        rating: driver.rating,
        totalRides: driver.totalRides
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

// Update subscription tier (Freemium/Premium)
const updateSubscriptionTier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subscriptionTier, paymentId } = req.body;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    if (driver.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    // Premium tier requires payment verification
    if (subscriptionTier === 'premium' && !paymentId) {
      return res.status(400).json(responseUtils.error('Payment verification required for premium tier', 400));
    }

    // Update subscription
    const { data, error } = await db.supabase
      .from('drivers')
      .update({
        subscription_tier: subscriptionTier,
        subscription_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Driver subscription updated: ${id} - ${subscriptionTier}`);

    const premiumFeatures = subscriptionTier === 'premium' ? {
      priorityInSearch: true,
      featuredPlacement: true,
      detailedAnalytics: true,
      customBranding: true,
      reducedCommission: '8% (instead of 10%)'
    } : null;

    res.json(responseUtils.success({
      subscriptionTier,
      premiumFeatures,
      message: subscriptionTier === 'premium' ? 
        'Premium subscription activated! You now have priority placement in search results.' :
        'Subscription updated successfully'
    }, 'Subscription updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get driver earnings dashboard
const getDriverEarnings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = '30' } = req.query;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    if (driver.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const earnings = await calculateDriverEarnings(id, startDate, new Date());

    res.json(responseUtils.success({
      earnings,
      period: parseInt(period),
      driver: {
        id: driver.id,
        totalRides: driver.totalRides,
        rating: driver.rating,
        subscriptionTier: driver.subscriptionTier || 'basic'
      }
    }, 'Earnings dashboard retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get driver analytics (Premium feature)
const getDriverAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    if (driver.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    // Check if driver has premium subscription
    if (driver.subscriptionTier !== 'premium') {
      return res.status(403).json(responseUtils.error(
        'Detailed analytics are only available for Premium subscribers. Upgrade to access this feature.',
        403
      ));
    }

    // Calculate analytics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: bookings, error } = await db.supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', id)
      .eq('type', 'ride')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    // Calculate various metrics
    const analytics = {
      overview: {
        totalRides: bookings.length,
        completedRides: bookings.filter(b => b.status === 'completed').length,
        cancelledRides: bookings.filter(b => b.status === 'cancelled').length,
        acceptanceRate: bookings.length > 0 ? 
          Math.round((bookings.filter(b => b.status !== 'cancelled').length / bookings.length) * 100) : 0
      },
      earnings: {
        totalRevenue: bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0),
        averageRideValue: bookings.length > 0 ?
          Math.round((bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0) / bookings.length) * 100) / 100 : 0
      },
      performance: {
        averageRating: driver.rating,
        totalReviews: driver.totalReviews,
        onlineHours: calculateOnlineHours(bookings),
        peakHours: identifyPeakHours(bookings)
      },
      geography: {
        topPickupLocations: getTopLocations(bookings, 'pickup'),
        topDropoffLocations: getTopLocations(bookings, 'dropoff')
      }
    };

    res.json(responseUtils.success({
      analytics,
      period: '30 days',
      subscriptionTier: 'premium'
    }, 'Driver analytics retrieved successfully'));
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
  calculateDriverFare,
  getDriverRides,
  getDriverStats,
  deleteDriver,
  updateSubscriptionTier,
  getDriverEarnings,
  getDriverAnalytics
};

// Helper Functions

function getBlurredLocation(lat, lng, isMoving) {
  // When stationary or offline, blur location to ~100m precision
  // When moving, show more precise location
  const precision = isMoving ? 4 : 3; // 3 decimals = ~111m, 4 decimals = ~11m
  return {
    latitude: parseFloat(lat.toFixed(precision)),
    longitude: parseFloat(lng.toFixed(precision)),
    isApproximate: !isMoving
  };
}

function maskVehicleNumber(vehicleNumber) {
  // Show first 2 and last 2 characters, mask middle
  // Example: AB1234 -> AB**34
  if (!vehicleNumber || vehicleNumber.length < 4) return '****';
  const first = vehicleNumber.substring(0, 2);
  const last = vehicleNumber.substring(vehicleNumber.length - 2);
  const masked = '*'.repeat(vehicleNumber.length - 4);
  return `${first}${masked}${last}`;
}

function getDistanceText(distance) {
  if (!distance) return 'Distance unknown';
  if (distance < 1) return `${Math.round(distance * 1000)}m away`;
  return `${Math.round(distance * 10) / 10}km away`;
}

function calculateETA(distance) {
  // Estimate arrival time based on average speed (25 km/h for tuk-tuks)
  const minutes = Math.round((distance / 25) * 60);
  return minutes < 1 ? 1 : minutes;
}

function sortDrivers(drivers, sortBy) {
  switch (sortBy) {
    case 'rating':
      return drivers.sort((a, b) => b.rating - a.rating);
    case 'price_low':
      return drivers.sort((a, b) => a.baseRate - b.baseRate);
    case 'trips':
      return drivers.sort((a, b) => b.totalRides - a.totalRides);
    case 'distance':
    default:
      return drivers.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }
}

function getBaseRates(vehicleType) {
  const rates = {
    standard: {
      base: 300,
      perKm: 50,
      perMinute: 5
    },
    air_conditioned: {
      base: 400,
      perKm: 60,
      perMinute: 6
    },
    luxury: {
      base: 500,
      perKm: 75,
      perMinute: 8
    }
  };

  return rates[vehicleType] || rates.standard;
}

async function calculateDriverEarnings(driverId, startDate, endDate) {
  try {
    const { data: bookings, error } = await db.supabase
      .from('bookings')
      .select('total_amount, commission, created_at, status')
      .eq('driver_id', driverId)
      .eq('type', 'ride')
      .in('status', ['completed'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const totalRevenue = bookings.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + parseFloat(b.commission), 0);
    const netEarnings = totalRevenue - totalCommission;

    // Pending payouts (same day payout for drivers)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingBookings = bookings.filter(b => new Date(b.created_at) >= today);
    const pendingAmount = pendingBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) - parseFloat(b.commission)), 0
    );

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      netEarnings: Math.round(netEarnings * 100) / 100,
      completedRides: bookings.length,
      pendingPayout: Math.round(pendingAmount * 100) / 100,
      pendingRides: pendingBookings.length,
      averageRideValue: bookings.length > 0 ? Math.round((totalRevenue / bookings.length) * 100) / 100 : 0,
      commissionRate: totalRevenue > 0 ? Math.round((totalCommission / totalRevenue) * 100) : 10
    };
  } catch (error) {
    logger.error('Error calculating driver earnings:', error);
    return {
      totalRevenue: 0,
      totalCommission: 0,
      netEarnings: 0,
      completedRides: 0,
      pendingPayout: 0,
      pendingRides: 0,
      averageRideValue: 0,
      commissionRate: 10
    };
  }
}

function calculateOnlineHours(bookings) {
  // Estimate online hours based on rides (rough estimate: 2x total ride duration)
  const totalRideDuration = bookings.reduce((sum, b) => sum + (b.duration || 0), 0);
  return Math.round((totalRideDuration * 2) / 60); // Convert to hours
}

function identifyPeakHours(bookings) {
  // Group bookings by hour to identify peak hours
  const hourCounts = {};
  bookings.forEach(b => {
    const hour = new Date(b.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  // Find top 3 peak hours
  const sorted = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return sorted.map(([hour, count]) => ({
    hour: `${hour}:00`,
    rideCount: count
  }));
}

function getTopLocations(bookings, type) {
  // Extract top 5 pickup or dropoff locations
  const locationCounts = {};
  
  bookings.forEach(b => {
    const location = type === 'pickup' ? b.pickup_location : b.dropoff_location;
    if (location && location.city) {
      locationCounts[location.city] = (locationCounts[location.city] || 0) + 1;
    }
  });

  return Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }));
}
