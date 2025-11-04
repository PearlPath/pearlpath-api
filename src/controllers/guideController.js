const Guide = require('../models/Guide');
const User = require('../models/User');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError, handleValidationError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const { cache } = require('../config/cache');
const { db } = require('../config/database');
const locationService = require('../services/locationService');

// Create guide profile with KYC verification requirement
const createGuide = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const guideData = { ...req.body, userId };

    // Require tier 2+ verification for guide profile
    if (req.user.verificationTier < 2) {
      return res.status(403).json(responseUtils.error(
        'KYC verification (Tier 2+) required to create guide profile. Please complete identity verification first.',
        403
      ));
    }

    // Check if user already has a guide profile
    const existingGuide = await Guide.findByUserId(userId);
    if (existingGuide) {
      return res.status(409).json(responseUtils.error('Guide profile already exists', 409));
    }

    // Validate portfolio if provided
    if (guideData.portfolio && guideData.portfolio.length > 0) {
      for (const item of guideData.portfolio) {
        if (!item.images || item.images.length === 0) {
          return res.status(400).json(responseUtils.error(
            'Portfolio items must include at least one photo/video',
            400
          ));
        }
      }
    }

    const guide = await Guide.create(guideData);

    logger.info(`Guide profile created: ${guide.id} for user: ${userId}`);

    res.status(201).json(responseUtils.success({
      guide: guide.toSafeObject(),
      verificationStatus: guide.verificationStatus,
      message: 'Guide profile created. Pending admin verification for full marketplace access.'
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

// Search guides nearby with advanced filters ("Guides Near Me")
const searchGuides = async (req, res, next) => {
  try {
    const { 
      lat, 
      lng, 
      radius = 10,
      languages,
      specializations,
      minPrice,
      maxPrice,
      minRating,
      availableToday,
      availableThisWeek,
      sortBy = 'distance', // distance, rating, price_low, price_high, response_time
      limit = 20,
      offset = 0
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    // Validate coordinates
    const coordValidation = locationService.validateCoordinates(lat, lng);
    if (!coordValidation.valid) {
      return res.status(400).json(responseUtils.error(coordValidation.error, 400));
    }

    // Check cache
    const cacheKey = `guides_${lat}_${lng}_${radius}_${sortBy}_${languages || 'all'}_${specializations || 'all'}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      logger.debug(`Cache hit for guide search: ${cacheKey}`);
      return res.json(responseUtils.success(cachedResult, 'Guides found (cached)'));
    }

    // Build filters
    const filters = {
      languages: languages ? languages.split(',') : undefined,
      specializations: specializations ? specializations.split(',') : undefined,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      availableToday: availableToday === 'true',
      availableThisWeek: availableThisWeek === 'true'
    };

    const guides = await Guide.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius),
      filters
    );

    // Filter by rating if specified
    let filteredGuides = guides;
    if (minRating) {
      filteredGuides = filteredGuides.filter(guide => guide.rating >= parseFloat(minRating));
    }

    // Only show verified guides in marketplace
    filteredGuides = filteredGuides.filter(guide => 
      guide.verificationStatus === 'verified'
    );

    // Calculate enhanced data for each guide
    const guidesWithEnhancedData = await Promise.all(filteredGuides.map(async (guide) => {
      const distance = guide.calculateDistance(parseFloat(lat), parseFloat(lng));
      const availability = await getGuideAvailability(guide.id);
      const responseTime = await getAverageResponseTime(guide.id);
      const lastMinuteDeals = await getLastMinuteDeals(guide.id);
      
      return {
        ...guide.toPublicObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null,
        distanceText: getDistanceText(distance),
        availability: {
          availableToday: availability.today,
          availableThisWeek: availability.thisWeek,
          nextAvailable: availability.nextAvailable
        },
        responseTime: responseTime,
        hasLastMinuteDeals: lastMinuteDeals.length > 0,
        lastMinuteDeals: lastMinuteDeals,
        packages: await getGuidePackages(guide.id)
      };
    }));

    // Sort results
    const sortedGuides = sortGuides(guidesWithEnhancedData, sortBy);

    // Apply pagination
    const paginatedGuides = sortedGuides.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    const result = {
      guides: paginatedGuides,
      total: sortedGuides.length,
      filtered: paginatedGuides.length,
      searchParams: { lat, lng, radius, filters, sortBy },
      userLocation: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: sortedGuides.length > parseInt(offset) + parseInt(limit)
      }
    };

    // Cache for 3 minutes
    await cache.set(cacheKey, result, 180);

    res.json(responseUtils.success(result, `${paginatedGuides.length} verified guides found near you`));
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

// Get guide packages
const getGuidePackages = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    const packages = await getGuidePackages(id);

    res.json(responseUtils.success({
      packages,
      customBookingAvailable: true,
      hourlyRate: guide.hourlyRate
    }, 'Guide packages retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Create/Update guide package
const upsertGuidePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const packageData = req.body;
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    if (guide.userId !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const { data, error } = await db.supabase
      .from('guide_packages')
      .upsert({
        id: packageData.id || require('uuid').v4(),
        guide_id: id,
        name: packageData.name,
        type: packageData.type, // half_day, full_day, multi_day, custom
        duration: packageData.duration,
        price: packageData.price,
        description: packageData.description,
        inclusions: packageData.inclusions || [],
        exclusions: packageData.exclusions || [],
        max_group_size: packageData.maxGroupSize || guide.maxGroupSize,
        available_days: packageData.availableDays || guide.availableDays,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Package ${packageData.id ? 'updated' : 'created'} for guide: ${id}`);

    res.json(responseUtils.success({
      package: data
    }, `Package ${packageData.id ? 'updated' : 'created'} successfully`));
  } catch (error) {
    next(error);
  }
};

// Get guide availability calendar
const getAvailabilityCalendar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const calendar = await generateAvailabilityCalendar(id, start, end);

    res.json(responseUtils.success({
      calendar,
      guide: {
        id: guide.id,
        name: guide.user?.first_name + ' ' + guide.user?.last_name,
        workingHours: guide.workingHours,
        availableDays: guide.availableDays
      }
    }, 'Availability calendar retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Check instant booking availability
const checkInstantBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, duration } = req.query;

    if (!startDate || !duration) {
      return res.status(400).json(responseUtils.error('Start date and duration are required', 400));
    }

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    const bookingStart = new Date(startDate);
    const now = new Date();
    const hoursUntilBooking = (bookingStart - now) / (1000 * 60 * 60);

    // Require 24-hour advance booking
    if (hoursUntilBooking < 24) {
      return res.json(responseUtils.success({
        available: false,
        reason: 'Bookings must be made at least 24 hours in advance',
        canRequestToBook: true
      }, 'Instant booking not available'));
    }

    // Check if guide is available
    const isAvailable = await checkGuideAvailability(id, bookingStart, parseInt(duration));

    res.json(responseUtils.success({
      available: isAvailable.available,
      reason: isAvailable.reason,
      instantBooking: isAvailable.available && guide.verificationStatus === 'verified',
      requestToBook: !isAvailable.available
    }, isAvailable.available ? 'Slot available for instant booking' : 'Slot not available'));
  } catch (error) {
    next(error);
  }
};

// Get guide earnings dashboard
const getEarningsDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = '30' } = req.query; // days
    const userId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    if (guide.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const earnings = await calculateEarnings(id, startDate, new Date());

    res.json(responseUtils.success({
      earnings,
      period: parseInt(period),
      guide: {
        id: guide.id,
        totalBookings: guide.totalBookings,
        rating: guide.rating
      }
    }, 'Earnings dashboard retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Helper Functions

async function getGuideAvailability(guideId) {
  try {
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    const { data: bookings, error } = await db.supabase
      .from('bookings')
      .select('start_date, end_date, status')
      .eq('guide_id', guideId)
      .in('status', ['confirmed', 'in_progress'])
      .gte('start_date', today.toISOString())
      .lte('start_date', endOfWeek.toISOString());

    if (error) throw error;

    const guide = await Guide.findById(guideId);
    const todayDayName = today.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    const availableToday = guide.isAvailable && 
                          guide.availableDays.includes(todayDayName) &&
                          !bookings.some(b => {
                            const start = new Date(b.start_date);
                            return start.toDateString() === today.toDateString();
                          });

    const availableThisWeek = bookings.length < 7; // Has slots available this week

    return {
      today: availableToday,
      thisWeek: availableThisWeek,
      nextAvailable: findNextAvailableDate(guide, bookings)
    };
  } catch (error) {
    logger.error('Error getting guide availability:', error);
    return { today: false, thisWeek: false, nextAvailable: null };
  }
}

async function getAverageResponseTime(guideId) {
  // Placeholder for chat response time tracking
  // In production, this would analyze chat message timestamps
  return {
    minutes: 15,
    text: 'Usually responds within 15 minutes'
  };
}

async function getLastMinuteDeals(guideId) {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Check for empty slots in next 3 days
    const { data: packages, error } = await db.supabase
      .from('guide_packages')
      .select('*')
      .eq('guide_id', guideId)
      .eq('is_active', true);

    if (error) throw error;

    // Check which slots are empty
    const { data: bookings, error: bookingError } = await db.supabase
      .from('bookings')
      .select('start_date')
      .eq('guide_id', guideId)
      .in('status', ['confirmed', 'pending', 'in_progress'])
      .gte('start_date', tomorrow.toISOString())
      .lte('start_date', threeDaysFromNow.toISOString());

    if (bookingError) throw bookingError;

    // Return packages with discount for empty slots
    const bookedDates = new Set(bookings.map(b => new Date(b.start_date).toDateString()));
    const emptySlots = [];

    for (let i = 1; i <= 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      if (!bookedDates.has(date.toDateString())) {
        emptySlots.push(date);
      }
    }

    return (packages || []).filter(p => emptySlots.length > 0).map(p => ({
      ...p,
      originalPrice: p.price,
      discountedPrice: Math.round(p.price * 0.85), // 15% discount
      discount: 15,
      availableDates: emptySlots.map(d => d.toISOString().split('T')[0])
    }));
  } catch (error) {
    logger.error('Error getting last minute deals:', error);
    return [];
  }
}

async function getGuidePackages(guideId) {
  try {
    const { data: packages, error } = await db.supabase
      .from('guide_packages')
      .select('*')
      .eq('guide_id', guideId)
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw error;

    return packages || [];
  } catch (error) {
    logger.error('Error getting guide packages:', error);
    return [];
  }
}

function getDistanceText(distance) {
  if (!distance) return 'Distance unknown';
  if (distance < 1) return `${Math.round(distance * 1000)}m away`;
  return `${Math.round(distance * 10) / 10}km away`;
}

function sortGuides(guides, sortBy) {
  switch (sortBy) {
    case 'rating':
      return guides.sort((a, b) => b.rating - a.rating);
    case 'price_low':
      return guides.sort((a, b) => a.hourlyRate - b.hourlyRate);
    case 'price_high':
      return guides.sort((a, b) => b.hourlyRate - a.hourlyRate);
    case 'response_time':
      return guides.sort((a, b) => a.responseTime.minutes - b.responseTime.minutes);
    case 'distance':
    default:
      return guides.sort((a, b) => (a.distance || 999) - (b.distance || 999));
  }
}

function findNextAvailableDate(guide, bookings) {
  const today = new Date();
  const bookedDates = new Set(bookings.map(b => new Date(b.start_date).toDateString()));

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    if (guide.availableDays.includes(dayName) && !bookedDates.has(date.toDateString())) {
      return date.toISOString().split('T')[0];
    }
  }

  return null;
}

async function generateAvailabilityCalendar(guideId, startDate, endDate) {
  try {
    const guide = await Guide.findById(guideId);
    const { data: bookings, error } = await db.supabase
      .from('bookings')
      .select('start_date, end_date, status')
      .eq('guide_id', guideId)
      .in('status', ['confirmed', 'pending', 'in_progress'])
      .gte('start_date', startDate.toISOString())
      .lte('start_date', endDate.toISOString());

    if (error) throw error;

    const calendar = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const isWorkingDay = guide.availableDays.includes(dayName);
      const hasBooking = bookings.some(b => 
        new Date(b.start_date).toDateString() === currentDate.toDateString()
      );

      calendar.push({
        date: dateStr,
        dayOfWeek: dayName,
        isWorkingDay,
        available: isWorkingDay && !hasBooking && guide.isAvailable,
        hasBooking,
        workingHours: isWorkingDay ? guide.workingHours : null
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return calendar;
  } catch (error) {
    logger.error('Error generating availability calendar:', error);
    return [];
  }
}

async function checkGuideAvailability(guideId, startDate, duration) {
  try {
    const guide = await Guide.findById(guideId);
    
    if (!guide.isAvailable) {
      return { available: false, reason: 'Guide is currently unavailable' };
    }

    const dayName = startDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
    if (!guide.availableDays.includes(dayName)) {
      return { available: false, reason: 'Guide is not available on this day' };
    }

    // Check working hours
    const startHour = startDate.getHours();
    const workingStart = parseInt(guide.workingHours.start.split(':')[0]);
    const workingEnd = parseInt(guide.workingHours.end.split(':')[0]);
    const endHour = startHour + duration;

    if (startHour < workingStart || endHour > workingEnd) {
      return { 
        available: false, 
        reason: `Outside working hours (${guide.workingHours.start} - ${guide.workingHours.end})` 
      };
    }

    // Check for conflicting bookings
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + duration);

    const { data: conflicts, error } = await db.supabase
      .from('bookings')
      .select('id')
      .eq('guide_id', guideId)
      .in('status', ['confirmed', 'pending', 'in_progress'])
      .or(`and(start_date.lte.${endDate.toISOString()},end_date.gte.${startDate.toISOString()})`);

    if (error) throw error;

    if (conflicts && conflicts.length > 0) {
      return { available: false, reason: 'Guide has another booking at this time' };
    }

    return { available: true, reason: 'Slot available' };
  } catch (error) {
    logger.error('Error checking guide availability:', error);
    return { available: false, reason: 'Error checking availability' };
  }
}

async function calculateEarnings(guideId, startDate, endDate) {
  try {
    const { data: bookings, error } = await db.supabase
      .from('bookings')
      .select('total_amount, commission, created_at, status')
      .eq('guide_id', guideId)
      .in('status', ['completed'])
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const totalRevenue = bookings.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
    const totalCommission = bookings.reduce((sum, b) => sum + parseFloat(b.commission), 0);
    const netEarnings = totalRevenue - totalCommission;

    // Calculate pending payouts (T+3 rule)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const pendingBookings = bookings.filter(b => new Date(b.created_at) > threeDaysAgo);
    const pendingAmount = pendingBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) - parseFloat(b.commission)), 0
    );

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      netEarnings: Math.round(netEarnings * 100) / 100,
      completedBookings: bookings.length,
      pendingPayout: Math.round(pendingAmount * 100) / 100,
      pendingBookings: pendingBookings.length,
      averageBookingValue: bookings.length > 0 ? Math.round((totalRevenue / bookings.length) * 100) / 100 : 0,
      commissionRate: totalRevenue > 0 ? Math.round((totalCommission / totalRevenue) * 100) : 10
    };
  } catch (error) {
    logger.error('Error calculating earnings:', error);
    return {
      totalRevenue: 0,
      totalCommission: 0,
      netEarnings: 0,
      completedBookings: 0,
      pendingPayout: 0,
      pendingBookings: 0,
      averageBookingValue: 0,
      commissionRate: 10
    };
  }
}
