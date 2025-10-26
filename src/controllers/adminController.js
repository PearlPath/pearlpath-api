const User = require('../models/User');
const Guide = require('../models/Guide');
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Get all users
const getAllUsers = async (req, res, next) => {
  try {
    const { role, status, verificationTier, page = 1, limit = 20 } = req.query;

    // This would typically query the users table with filters
    // For now, returning a placeholder response
    const users = [];

    res.json(responseUtils.success({
      users: users.map(user => user.toSafeObject()),
      total: users.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(users.length / limit)
      }
    }, 'Users retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get user by ID
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      throw handleNotFoundError('User not found');
    }

    res.json(responseUtils.success({
      user: user.toSafeObject()
    }, 'User retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update user status
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const user = await User.findById(id);
    if (!user) {
      throw handleNotFoundError('User not found');
    }

    await user.update({ status });

    logger.info(`User status updated: ${id} to ${status} by admin: ${adminId}`);

    res.json(responseUtils.success({
      user: user.toSafeObject()
    }, 'User status updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get all guides
const getAllGuides = async (req, res, next) => {
  try {
    const { status, verificationStatus, page = 1, limit = 20 } = req.query;

    // This would typically query the guides table with filters
    // For now, returning a placeholder response
    const guides = [];

    res.json(responseUtils.success({
      guides: guides.map(guide => guide.toSafeObject()),
      total: guides.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(guides.length / limit)
      }
    }, 'Guides retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Verify guide
const verifyGuide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;

    const guide = await Guide.findById(id);
    if (!guide) {
      throw handleNotFoundError('Guide not found');
    }

    await guide.update({ verificationStatus: status });

    logger.info(`Guide verification updated: ${id} to ${status} by admin: ${adminId}`);

    res.json(responseUtils.success({
      guide: guide.toSafeObject()
    }, 'Guide verification updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get all drivers
const getAllDrivers = async (req, res, next) => {
  try {
    const { status, verificationStatus, page = 1, limit = 20 } = req.query;

    // This would typically query the drivers table with filters
    // For now, returning a placeholder response
    const drivers = [];

    res.json(responseUtils.success({
      drivers: drivers.map(driver => driver.toSafeObject()),
      total: drivers.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(drivers.length / limit)
      }
    }, 'Drivers retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Verify driver
const verifyDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;

    const driver = await Driver.findById(id);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    await driver.update({ verificationStatus: status });

    logger.info(`Driver verification updated: ${id} to ${status} by admin: ${adminId}`);

    res.json(responseUtils.success({
      driver: driver.toSafeObject()
    }, 'Driver verification updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Get all bookings
const getAllBookings = async (req, res, next) => {
  try {
    const { status, type, startDate, endDate, page = 1, limit = 20 } = req.query;

    // This would typically query the bookings table with filters
    // For now, returning a placeholder response
    const bookings = [];

    res.json(responseUtils.success({
      bookings: bookings.map(booking => booking.toSafeObject()),
      total: bookings.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(bookings.length / limit)
      }
    }, 'Bookings retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get platform statistics
const getPlatformStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // This would typically calculate platform statistics
    // For now, returning a placeholder response
    const stats = {
      totalUsers: 0,
      totalGuides: 0,
      totalDrivers: 0,
      totalBookings: 0,
      totalRevenue: 0,
      activeBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      averageRating: 0,
      topCities: [],
      recentActivity: []
    };

    res.json(responseUtils.success({
      stats
    }, 'Platform statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Get reports
const getReports = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    // This would typically query the reports table
    // For now, returning a placeholder response
    const reports = [];

    res.json(responseUtils.success({
      reports,
      total: reports.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(reports.length / limit)
      }
    }, 'Reports retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Handle report
const handleReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, resolution } = req.body;
    const adminId = req.user.id;

    // This would typically update the report status
    // For now, returning a placeholder response
    const report = {
      id,
      status: action,
      resolution,
      handledBy: adminId,
      handledAt: new Date().toISOString()
    };

    logger.info(`Report handled: ${id} - ${action} by admin: ${adminId}`);

    res.json(responseUtils.success({
      report
    }, 'Report handled successfully'));
  } catch (error) {
    next(error);
  }
};

// Get system health
const getSystemHealth = async (req, res, next) => {
  try {
    const { healthCheck } = require('../config/database');
    const dbHealth = await healthCheck();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.status,
        cache: 'healthy', // In-memory cache
        payhere: 'healthy' // This would check PayHere API
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(responseUtils.success({
      health
    }, 'System health retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllGuides,
  verifyGuide,
  getAllDrivers,
  verifyDriver,
  getAllBookings,
  getPlatformStats,
  getReports,
  handleReport,
  getSystemHealth
};
