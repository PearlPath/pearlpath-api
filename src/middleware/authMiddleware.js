const { jwtUtils } = require('../utils/helpers');
const User = require('../models/User');
const logger = require('../utils/logger');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        statusCode: 401
      });
    }

    const decoded = jwtUtils.verifyAccessToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found',
        statusCode: 401
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active',
        statusCode: 401
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        statusCode: 401
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        statusCode: 401
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      statusCode: 500
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwtUtils.verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      
      if (user && user.status === 'active') {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        statusCode: 401
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        statusCode: 403
      });
    }

    next();
  };
};

// Check if user has required verification tier
const requireVerificationTier = (minTier) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        statusCode: 401
      });
    }

    if (req.user.verificationTier < minTier) {
      return res.status(403).json({
        success: false,
        message: `Verification tier ${minTier} required`,
        statusCode: 403
      });
    }

    next();
  };
};

// Check if user owns the resource
const requireOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        statusCode: 401
      });
    }

    const resourceId = req.params[resourceIdParam];
    
    if (req.user.id !== resourceId && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - resource ownership required',
        statusCode: 403
      });
    }

    next();
  };
};

// Check if user can access booking
const requireBookingAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        statusCode: 401
      });
    }

    const bookingId = req.params.id;
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        statusCode: 404
      });
    }

    // Allow access if user is the booking owner, guide, driver, or admin/moderator
    const canAccess = 
      booking.userId === req.user.id ||
      booking.guideId === req.user.id ||
      booking.driverId === req.user.id ||
      ['admin', 'moderator'].includes(req.user.role);

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions',
        statusCode: 403
      });
    }

    req.booking = booking;
    next();
  } catch (error) {
    logger.error('Booking access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking booking access',
      statusCode: 500
    });
  }
};

// Rate limiting for sensitive operations
const sensitiveOperationLimit = (req, res, next) => {
  // This would integrate with Redis rate limiting
  // For now, we'll use a simple in-memory approach
  const key = `sensitive_${req.user?.id || req.ip}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const userAttempts = global.rateLimitStore.get(key) || [];
  const recentAttempts = userAttempts.filter(time => now - time < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    return res.status(429).json({
      success: false,
      message: 'Too many sensitive operations. Please try again later.',
      statusCode: 429,
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }

  recentAttempts.push(now);
  global.rateLimitStore.set(key, recentAttempts);

  next();
};

// Check if user can moderate content
const requireModerationAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      statusCode: 401
    });
  }

  if (!req.user.canModerate()) {
    return res.status(403).json({
      success: false,
      message: 'Moderation access required',
      statusCode: 403
    });
  }

  next();
};

// Check if user can create professional profiles
const requireProfessionalAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      statusCode: 401
    });
  }

  if (req.user.verificationTier < 2) {
    return res.status(403).json({
      success: false,
      message: 'Professional verification required',
      statusCode: 403
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireVerificationTier,
  requireOwnership,
  requireBookingAccess,
  sensitiveOperationLimit,
  requireModerationAccess,
  requireProfessionalAccess
};
