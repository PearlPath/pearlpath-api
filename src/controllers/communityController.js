const { responseUtils, dateUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const { db } = require('../config/database');
const { cache } = require('../config/cache');

// Time-boxed expiration based on update type
const EXPIRATION_PERIODS = {
  closure: 7 * 24 * 60 * 60 * 1000, // 7 days
  scam_alert: 30 * 24 * 60 * 60 * 1000, // 30 days
  safety_alert: 30 * 24 * 60 * 60 * 1000, // 30 days
  tip: 90 * 24 * 60 * 60 * 1000, // 90 days
  price_update: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// Get community updates with filters
const getCommunityUpdates = async (req, res, next) => {
  try {
    const { 
      type, 
      severity, 
      city,
      lat,
      lng,
      radius = 10,
      includeExpired = false,
      limit = 20, 
      offset = 0 
    } = req.query;

    // Build query
    let query = db.supabase
      .from('community_updates')
      .select('*, user:users(id, first_name, last_name, profile_image, verification_tier)');

    // Filter by type
    if (type) {
      query = query.eq('type', type);
    }

    // Filter by severity
    if (severity) {
      query = query.eq('severity', severity);
    }

    // Filter by active status
    if (!includeExpired) {
      query = query.eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: updates, error, count } = await query;

    if (error) throw error;

    // Filter by location if coordinates provided
    let filteredUpdates = updates || [];
    if (lat && lng && radius) {
      const locationService = require('../services/locationService');
      filteredUpdates = filteredUpdates.filter(update => {
        if (!update.location || !update.location.latitude || !update.location.longitude) {
          return false;
        }
        const distance = locationService.calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          update.location.latitude,
          update.location.longitude
        );
        return distance <= parseFloat(radius);
      });
    }

    // Calculate expiration info
    const enhancedUpdates = filteredUpdates.map(update => {
      const expiresAt = update.expires_at ? new Date(update.expires_at) : null;
      const now = new Date();
      
      return {
        ...update,
        isExpired: expiresAt ? expiresAt < now : false,
        daysUntilExpiration: expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null,
        timeAgo: getTimeAgo(new Date(update.created_at))
      };
    });

    res.json(responseUtils.success({
      updates: enhancedUpdates,
      total: filteredUpdates.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (updates || []).length === parseInt(limit)
      }
    }, 'Community updates retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Create community update with photo/video verification and time-boxing
const createCommunityUpdate = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Require photo/video verification
    if (!updateData.images || updateData.images.length === 0) {
      return res.status(400).json(responseUtils.error(
        'Photo or video verification is required for all community updates',
        400
      ));
    }

    // Validate update type
    if (!Object.keys(EXPIRATION_PERIODS).includes(updateData.type)) {
      return res.status(400).json(responseUtils.error(
        `Invalid update type. Must be one of: ${Object.keys(EXPIRATION_PERIODS).join(', ')}`,
        400
      ));
    }

    // Set automatic expiration based on type
    const expirationMs = EXPIRATION_PERIODS[updateData.type];
    const expiresAt = new Date(Date.now() + expirationMs);

    // Create the update
    const { data: update, error } = await db.supabase
      .from('community_updates')
      .insert({
        id: require('uuid').v4(),
        user_id: userId,
        type: updateData.type,
        title: updateData.title,
        description: updateData.description,
        location: updateData.location,
        severity: updateData.severity || 'medium',
        expires_at: expiresAt.toISOString(),
        images: updateData.images,
        tags: updateData.tags || [],
        upvotes: 0,
        downvotes: 0,
        is_verified: req.user.verificationTier >= 2, // Auto-verify tier 2+ users
        verified_by: req.user.verificationTier >= 2 ? userId : null,
        verified_at: req.user.verificationTier >= 2 ? new Date().toISOString() : null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Community update created: ${update.id} by user: ${userId}, type: ${updateData.type}, expires: ${expiresAt}`);

    // Clear cache for nearby updates
    if (updateData.location?.latitude && updateData.location?.longitude) {
      await cache.del(`updates_${Math.floor(updateData.location.latitude)}_${Math.floor(updateData.location.longitude)}`);
    }

    res.status(201).json(responseUtils.success({
      update,
      expiresAt: expiresAt.toISOString(),
      expiresInDays: Math.ceil(expirationMs / (1000 * 60 * 60 * 24)),
      requiresVerification: req.user.verificationTier < 2
    }, 'Community update created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get events
const getEvents = async (req, res, next) => {
  try {
    const { category, city, startDate, endDate, limit = 20, offset = 0 } = req.query;

    // This would typically query the events table
    // For now, returning a placeholder response
    const events = [];

    res.json(responseUtils.success({
      events,
      total: events.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false
      }
    }, 'Events retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Create event
const createEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventData = { ...req.body, userId };

    // This would typically create a new event
    // For now, returning a placeholder response
    const event = {
      id: require('uuid').v4(),
      ...eventData,
      createdAt: new Date().toISOString()
    };

    logger.info(`Event created: ${event.id} by user: ${userId}`);

    res.status(201).json(responseUtils.success({
      event
    }, 'Event created successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Get event by ID
const getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    // This would typically query the events table
    // For now, returning a placeholder response
    const event = null;

    if (!event) {
      throw handleNotFoundError('Event not found');
    }

    res.json(responseUtils.success({
      event
    }, 'Event retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update event
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // This would typically update the event
    // For now, returning a placeholder response
    const event = null;

    if (!event) {
      throw handleNotFoundError('Event not found');
    }

    // Check if user created this event or is admin/moderator
    if (event.userId !== userId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    logger.info(`Event updated: ${id}`);

    res.json(responseUtils.success({
      event: { ...event, ...updates }
    }, 'Event updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Delete event
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // This would typically delete the event
    // For now, returning a placeholder response
    const event = null;

    if (!event) {
      throw handleNotFoundError('Event not found');
    }

    // Check if user created this event or is admin
    if (event.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    logger.info(`Event deleted: ${id}`);

    res.json(responseUtils.success(null, 'Event deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Vote on community update
const voteOnUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vote } = req.body; // 'up' or 'down'
    const userId = req.user.id;

    if (!['up', 'down'].includes(vote)) {
      return res.status(400).json(responseUtils.error('Vote must be "up" or "down"', 400));
    }

    // This would typically update the vote count
    // For now, returning a placeholder response
    logger.info(`Vote cast on update: ${id} - ${vote} by user: ${userId}`);

    res.json(responseUtils.success({
      vote,
      updateId: id
    }, 'Vote cast successfully'));
  } catch (error) {
    next(error);
  }
};

// Report community update
const reportUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.id;

    // This would typically create a report
    // For now, returning a placeholder response
    const report = {
      id: require('uuid').v4(),
      updateId: id,
      reporterId: userId,
      reason,
      description,
      createdAt: new Date().toISOString()
    };

    logger.info(`Update reported: ${id} by user: ${userId}`);

    res.status(201).json(responseUtils.success({
      report
    }, 'Report submitted successfully', 201));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunityUpdates,
  createCommunityUpdate,
  getNearbyUpdates,
  getEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  voteOnUpdate,
  reportUpdate,
  verifyUpdate,
  getEmergencyServices
};

// Get nearby updates with real-time filtering
const getNearbyUpdates = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, types, severity } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    // Check cache
    const cacheKey = `updates_${Math.floor(parseFloat(lat))}_${Math.floor(parseFloat(lng))}_${radius}`;
    const cachedResult = await cache.get(cacheKey);
    
    if (cachedResult) {
      logger.debug(`Cache hit for nearby updates: ${cacheKey}`);
      return res.json(responseUtils.success(cachedResult, 'Nearby updates found (cached)'));
    }

    // Get all active updates
    let query = db.supabase
      .from('community_updates')
      .select('*, user:users(id, first_name, last_name, verification_tier)')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

    // Filter by types if provided
    if (types) {
      const typesArray = types.split(',');
      query = query.in('type', typesArray);
    }

    // Filter by severity if provided
    if (severity) {
      query = query.eq('severity', severity);
    }

    query = query.order('created_at', { ascending: false });

    const { data: updates, error } = await query;

    if (error) throw error;

    // Filter by distance
    const locationService = require('../services/locationService');
    const nearbyUpdates = (updates || [])
      .filter(update => {
        if (!update.location?.latitude || !update.location?.longitude) {
          return false;
        }
        const distance = locationService.calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          update.location.latitude,
          update.location.longitude
        );
        return distance <= parseFloat(radius);
      })
      .map(update => {
        const distance = locationService.calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          update.location.latitude,
          update.location.longitude
        );
        
        const expiresAt = update.expires_at ? new Date(update.expires_at) : null;
        const now = new Date();
        
        return {
          ...update,
          distance: Math.round(distance * 100) / 100,
          distanceText: `${Math.round(distance * 10) / 10}km away`,
          daysUntilExpiration: expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null,
          timeAgo: getTimeAgo(new Date(update.created_at)),
          urgency: calculateUrgency(update.severity, expiresAt)
        };
      })
      .sort((a, b) => a.distance - b.distance);

    const result = {
      updates: nearbyUpdates,
      total: nearbyUpdates.length,
      searchParams: { lat, lng, radius, types, severity }
    };

    // Cache for 3 minutes
    await cache.set(cacheKey, result, 180);

    res.json(responseUtils.success(result, 'Nearby updates found successfully'));
  } catch (error) {
    next(error);
  }
};

// Emergency services locator
const getEmergencyServices = async (req, res, next) => {
  try {
    const { lat, lng, type } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(responseUtils.error('Latitude and longitude are required', 400));
    }

    // Emergency service types: hospital, police, fire, embassy
    const emergencyServices = [
      {
        type: 'hospital',
        name: 'General Hospital Colombo',
        phone: '+94112691111',
        latitude: 6.9271,
        longitude: 79.8612,
        address: 'Colombo 00800, Sri Lanka',
        available24x7: true
      },
      {
        type: 'police',
        name: 'Sri Lanka Police Emergency',
        phone: '119',
        latitude: 6.9271,
        longitude: 79.8612,
        address: 'Police Headquarters, Colombo',
        available24x7: true
      },
      {
        type: 'fire',
        name: 'Fire & Rescue',
        phone: '110',
        latitude: 6.9271,
        longitude: 79.8612,
        address: 'Fire Department, Colombo',
        available24x7: true
      }
    ];

    // Filter by type if provided
    let filteredServices = emergencyServices;
    if (type) {
      filteredServices = emergencyServices.filter(service => service.type === type);
    }

    // Calculate distances
    const locationService = require('../services/locationService');
    const servicesWithDistance = filteredServices.map(service => {
      const distance = locationService.calculateDistance(
        parseFloat(lat),
        parseFloat(lng),
        service.latitude,
        service.longitude
      );
      
      return {
        ...service,
        distance: Math.round(distance * 100) / 100,
        distanceText: `${Math.round(distance * 10) / 10}km away`
      };
    }).sort((a, b) => a.distance - b.distance);

    res.json(responseUtils.success({
      services: servicesWithDistance,
      total: servicesWithDistance.length,
      emergencyNumbers: {
        police: '119',
        ambulance: '110',
        fire: '110',
        tourist_police: '+94112421052'
      }
    }, 'Emergency services found successfully'));
  } catch (error) {
    next(error);
  }
};

// Verify community update (Admin/Moderator)
const verifyUpdate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json(responseUtils.error('Verification access denied', 403));
    }

    const { data: update, error } = await db.supabase
      .from('community_updates')
      .update({
        is_verified: true,
        verified_by: userId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Community update verified: ${id} by user: ${userId}`);

    res.json(responseUtils.success({
      update
    }, 'Update verified successfully'));
  } catch (error) {
    next(error);
  }
};

// Helper functions
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
}

function calculateUrgency(severity, expiresAt) {
  if (!expiresAt) return 'normal';
  
  const daysUntilExpiration = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
  
  if (severity === 'critical') return 'critical';
  if (severity === 'high' || daysUntilExpiration <= 2) return 'high';
  if (severity === 'medium' || daysUntilExpiration <= 7) return 'medium';
  return 'low';
}
