const { validate, validateQuery } = require('../utils/validation');
const { handleValidationError } = require('./errorMiddleware');

// User validation middleware
const validateUserRegistration = validate(require('../utils/validation').userValidation.register);
const validateUserLogin = validate(require('../utils/validation').userValidation.login);
const validateUserUpdate = validate(require('../utils/validation').userValidation.updateProfile);
const validatePasswordChange = validate(require('../utils/validation').userValidation.changePassword);

// Guide validation middleware
const validateGuideCreation = validate(require('../utils/validation').guideValidation.create);
const validateGuideUpdate = validate(require('../utils/validation').guideValidation.update);
const validateGuideSearch = validateQuery(require('../utils/validation').guideValidation.search);

// Driver validation middleware
const validateDriverCreation = validate(require('../utils/validation').driverValidation.create);
const validateDriverLocationUpdate = validate(require('../utils/validation').driverValidation.updateLocation);

// POI validation middleware
const validatePOICreation = validate(require('../utils/validation').poiValidation.create);
const validatePOISearch = validateQuery(require('../utils/validation').poiValidation.search);

// Booking validation middleware
const validateBookingCreation = validate(require('../utils/validation').bookingValidation.create);
const validateBookingUpdate = validate(require('../utils/validation').bookingValidation.update);

// Community validation middleware
const validateCommunityUpdate = validate(require('../utils/validation').communityValidation.createUpdate);
const validateEventCreation = validate(require('../utils/validation').communityValidation.createEvent);

// Custom validation middleware
const validateId = (req, res, next) => {
  const { id } = req.params;
  const { commonSchemas } = require('../utils/validation');
  
  const { error } = commonSchemas.id.validate(id);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      errors: [{ field: 'id', message: error.message }]
    });
  }
  
  next();
};

const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page number',
      errors: [{ field: 'page', message: 'Page must be a positive integer' }]
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid limit',
      errors: [{ field: 'limit', message: 'Limit must be between 1 and 100' }]
    });
  }
  
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };
  
  next();
};

const validateLocation = (req, res, next) => {
  const { lat, lng } = req.query;
  const { commonSchemas } = require('../utils/validation');
  
  const latError = commonSchemas.latitude.validate(lat);
  const lngError = commonSchemas.longitude.validate(lng);
  
  if (latError.error || lngError.error) {
    const errors = [];
    if (latError.error) {
      errors.push({ field: 'lat', message: latError.error.message });
    }
    if (lngError.error) {
      errors.push({ field: 'lng', message: lngError.error.message });
    }
    
    return res.status(400).json({
      success: false,
      message: 'Invalid location coordinates',
      errors
    });
  }
  
  next();
};

const validateFileUpload = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded',
      errors: [{ field: 'files', message: 'At least one file is required' }]
    });
  }
  
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp').split(',');
  
  for (const fieldName in req.files) {
    const file = req.files[fieldName];
    
    if (file.size > maxSize) {
      return res.status(413).json({
        success: false,
        message: 'File too large',
        errors: [{ field: fieldName, message: `File size must be less than ${maxSize / 1024 / 1024}MB` }]
      });
    }
    
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type',
        errors: [{ field: fieldName, message: `File type must be one of: ${allowedTypes.join(', ')}` }]
      });
    }
  }
  
  next();
};

const validateSearchQuery = (req, res, next) => {
  const { query } = req.query;
  
  if (query && (query.length < 2 || query.length > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid search query',
      errors: [{ field: 'query', message: 'Search query must be between 2 and 100 characters' }]
    });
  }
  
  next();
};

const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date',
        errors: [{ field: 'startDate', message: 'Start date must be a valid date' }]
      });
    }
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid end date',
        errors: [{ field: 'endDate', message: 'End date must be a valid date' }]
      });
    }
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range',
        errors: [{ field: 'endDate', message: 'End date must be after start date' }]
      });
    }
  }
  
  next();
};

const validateLanguage = (req, res, next) => {
  const { language } = req.query;
  const { commonSchemas } = require('../utils/validation');
  
  if (language) {
    const { error } = commonSchemas.language.validate(language);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language',
        errors: [{ field: 'language', message: error.message }]
      });
    }
  }
  
  next();
};

const validateStatus = (req, res, next) => {
  const { status } = req.query;
  const { commonSchemas } = require('../utils/validation');
  
  if (status) {
    const { error } = commonSchemas.status.validate(status);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        errors: [{ field: 'status', message: error.message }]
      });
    }
  }
  
  next();
};

module.exports = {
  // User validation
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordChange,
  
  // Guide validation
  validateGuideCreation,
  validateGuideUpdate,
  validateGuideSearch,
  
  // Driver validation
  validateDriverCreation,
  validateDriverLocationUpdate,
  
  // POI validation
  validatePOICreation,
  validatePOISearch,
  
  // Booking validation
  validateBookingCreation,
  validateBookingUpdate,
  
  // Community validation
  validateCommunityUpdate,
  validateEventCreation,
  
  // Custom validation
  validateId,
  validatePagination,
  validateLocation,
  validateFileUpload,
  validateSearchQuery,
  validateDateRange,
  validateLanguage,
  validateStatus
};
