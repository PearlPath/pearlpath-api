const logger = require('../utils/logger');

// In-memory storage for caching and session management
const memoryStore = new Map();
const rateLimitStore = new Map();

// Cache helper functions (in-memory implementation)
const cache = {
  async set(key, value, ttl = 3600) {
    try {
      const expiryTime = Date.now() + (ttl * 1000);
      memoryStore.set(key, {
        value: JSON.stringify(value),
        expiry: expiryTime
      });
      logger.debug(`Cache set: ${key}`);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  },

  async get(key) {
    try {
      const item = memoryStore.get(key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        memoryStore.delete(key);
        return null;
      }
      
      return JSON.parse(item.value);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  },

  async del(key) {
    try {
      memoryStore.delete(key);
      logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  },

  async exists(key) {
    try {
      const item = memoryStore.get(key);
      if (!item) return false;
      
      if (Date.now() > item.expiry) {
        memoryStore.delete(key);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  },

  async flush() {
    try {
      memoryStore.clear();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }
};

// Rate limiting helper (in-memory implementation)
const rateLimit = {
  async checkLimit(key, limit, window) {
    try {
      const now = Date.now();
      const windowMs = window * 1000;
      
      // Clean up expired entries
      for (const [k, v] of rateLimitStore.entries()) {
        if (now - v.timestamp > windowMs) {
          rateLimitStore.delete(k);
        }
      }
      
      const current = rateLimitStore.get(key);
      
      if (!current) {
        rateLimitStore.set(key, { count: 1, timestamp: now });
        return true;
      }
      
      if (now - current.timestamp > windowMs) {
        rateLimitStore.set(key, { count: 1, timestamp: now });
        return true;
      }
      
      if (current.count >= limit) {
        return false;
      }
      
      current.count++;
      return true;
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return true; // Allow request if there's an error
    }
  },

  async getRemaining(key, limit) {
    try {
      const current = rateLimitStore.get(key);
      if (!current) return limit;
      
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutes default
      
      if (now - current.timestamp > windowMs) {
        return limit;
      }
      
      return Math.max(0, limit - current.count);
    } catch (error) {
      logger.error('Rate limit remaining error:', error);
      return limit;
    }
  }
};

// Session management (in-memory implementation)
const session = {
  async set(userId, sessionData, ttl = 86400) { // 24 hours
    const key = `session:${userId}`;
    await cache.set(key, sessionData, ttl);
  },

  async get(userId) {
    const key = `session:${userId}`;
    return await cache.get(key);
  },

  async delete(userId) {
    const key = `session:${userId}`;
    await cache.del(key);
  }
};

// Cleanup function to remove expired entries periodically
const cleanupExpiredEntries = () => {
  const now = Date.now();
  
  // Clean cache entries
  for (const [key, item] of memoryStore.entries()) {
    if (now > item.expiry) {
      memoryStore.delete(key);
    }
  }
  
  // Clean rate limit entries
  for (const [key, item] of rateLimitStore.entries()) {
    if (now - item.timestamp > 15 * 60 * 1000) { // 15 minutes
      rateLimitStore.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

// Initialize in-memory cache
const connectCache = async () => {
  try {
    logger.info('In-memory cache initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize in-memory cache:', error);
    throw error;
  }
};

const getRedisClient = () => {
  // Return a mock client for compatibility
  return {
    get: async (key) => {
      const item = memoryStore.get(key);
      return item ? item.value : null;
    },
    set: async (key, value) => {
      memoryStore.set(key, { value, expiry: Date.now() + 3600000 });
    },
    del: async (key) => {
      memoryStore.delete(key);
    },
    exists: async (key) => {
      return memoryStore.has(key);
    }
  };
};

module.exports = {
  connectCache,
  getRedisClient, // Keep for compatibility
  cache,
  rateLimit,
  session
};