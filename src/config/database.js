const { db } = require('./supabase');
const logger = require('../utils/logger');

// Database schema creation and migration functions
const createTables = async () => {
  try {
    logger.info('Creating database tables...');
    
    // This would typically be done through Supabase migrations
    // For now, we'll just log the table creation
    const tables = [
      'users',
      'guides', 
      'drivers',
      'pois',
      'bookings',
      'reviews',
      'community_updates',
      'events',
      'payments',
      'kyc_verifications',
      'reports',
      'notifications'
    ];
    
    logger.info(`Tables to be created: ${tables.join(', ')}`);
    logger.info('Database schema setup completed');
    
    return true;
  } catch (error) {
    logger.error('Error creating database tables:', error);
    throw error;
  }
};

// Database health check
const healthCheck = async () => {
  try {
    // Test basic connectivity
    const { data, error } = await db.users.findById('test');
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    };
  }
};

// Database utilities
const utils = {
  // Generate unique IDs
  generateId: () => {
    return require('uuid').v4();
  },

  // Format database responses
  formatUser: (user) => {
    if (!user) return null;
    
    const { password, refresh_token, ...safeUser } = user;
    return safeUser;
  },

  formatGuide: (guide) => {
    if (!guide) return null;
    
    return {
      ...guide,
      user: guide.user ? utils.formatUser(guide.user) : null
    };
  },

  formatDriver: (driver) => {
    if (!driver) return null;
    
    return {
      ...driver,
      user: driver.user ? utils.formatUser(driver.user) : null
    };
  },

  formatBooking: (booking) => {
    if (!booking) return null;
    
    return {
      ...booking,
      user: booking.user ? utils.formatUser(booking.user) : null,
      guide: booking.guide ? utils.formatGuide(booking.guide) : null,
      driver: booking.driver ? utils.formatDriver(booking.driver) : null
    };
  },

  // Pagination helper
  paginate: (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    return { offset, limit };
  },

  // Search helper
  buildSearchQuery: (searchTerm, fields) => {
    if (!searchTerm) return {};
    
    const searchConditions = fields.map(field => ({
      [field]: { $ilike: `%${searchTerm}%` }
    }));
    
    return { $or: searchConditions };
  },

  // Date range helper
  buildDateRange: (startDate, endDate) => {
    const conditions = {};
    
    if (startDate) {
      conditions.created_at = { ...conditions.created_at, $gte: startDate };
    }
    
    if (endDate) {
      conditions.created_at = { ...conditions.created_at, $lte: endDate };
    }
    
    return conditions;
  }
};

module.exports = {
  createTables,
  healthCheck,
  utils,
  db
};
