const Joi = require('joi');

// Common validation schemas
const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().lowercase().trim().required(),
  phone: Joi.string().pattern(/^(\+94|0)[0-9]{9}$/).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  name: Joi.string().min(2).max(50).trim().required(),
  description: Joi.string().max(1000).trim(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  price: Joi.number().min(0).precision(2),
  rating: Joi.number().min(1).max(5),
  language: Joi.string().valid('en', 'si', 'ta').required(),
  userRole: Joi.string().valid('tourist', 'contributor', 'guide', 'driver', 'moderator', 'admin').required(),
  verificationTier: Joi.number().min(1).max(3),
  status: Joi.string().valid('active', 'inactive', 'pending', 'suspended', 'verified', 'rejected').required()
};

// User validation schemas
const userValidation = {
  register: Joi.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    firstName: commonSchemas.name,
    lastName: commonSchemas.name,
    phone: commonSchemas.phone,
    language: commonSchemas.language,
    role: commonSchemas.userRole.default('tourist'),
    dateOfBirth: Joi.date().max('now').required(),
    nationality: Joi.string().min(2).max(50).required()
  }),

  login: Joi.object({
    email: commonSchemas.email,
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    firstName: commonSchemas.name.optional(),
    lastName: commonSchemas.name.optional(),
    phone: commonSchemas.phone.optional(),
    language: commonSchemas.language.optional(),
    bio: commonSchemas.description.optional(),
    profileImage: Joi.string().uri().optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    nationality: Joi.string().min(2).max(50).optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password
  })
};

// Guide validation schemas
const guideValidation = {
  create: Joi.object({
    userId: commonSchemas.id,
    languages: Joi.array().items(commonSchemas.language).min(1).max(6).required(),
    specializations: Joi.array().items(
      Joi.string().valid('heritage', 'food', 'nature', 'photography', 'adventure', 'culture', 'religion', 'wildlife')
    ).min(1).required(),
    hourlyRate: commonSchemas.price.required(),
    bio: commonSchemas.description.required(),
    experience: Joi.number().min(0).max(50).required(),
    licenseNumber: Joi.string().min(5).max(20).required(),
    vehicleOwned: Joi.boolean().default(false),
    maxGroupSize: Joi.number().min(1).max(20).default(10),
    availableDays: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    workingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    }).required()
  }),

  update: Joi.object({
    languages: Joi.array().items(commonSchemas.language).min(1).max(6).optional(),
    specializations: Joi.array().items(
      Joi.string().valid('heritage', 'food', 'nature', 'photography', 'adventure', 'culture', 'religion', 'wildlife')
    ).min(1).optional(),
    hourlyRate: commonSchemas.price.optional(),
    bio: commonSchemas.description.optional(),
    experience: Joi.number().min(0).max(50).optional(),
    maxGroupSize: Joi.number().min(1).max(20).optional(),
    availableDays: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).optional(),
    workingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
    }).optional()
  }),

  search: Joi.object({
    lat: commonSchemas.latitude,
    lng: commonSchemas.longitude,
    radius: Joi.number().min(1).max(50).default(10),
    languages: Joi.array().items(commonSchemas.language).optional(),
    specializations: Joi.array().items(
      Joi.string().valid('heritage', 'food', 'nature', 'photography', 'adventure', 'culture', 'religion', 'wildlife')
    ).optional(),
    minPrice: commonSchemas.price.optional(),
    maxPrice: commonSchemas.price.optional(),
    availableToday: Joi.boolean().default(false)
  })
};

// Driver validation schemas
const driverValidation = {
  create: Joi.object({
    userId: commonSchemas.id,
    vehicleType: Joi.string().valid('standard', 'luxury', 'air_conditioned').required(),
    vehicleNumber: Joi.string().min(5).max(15).required(),
    vehicleModel: Joi.string().min(2).max(50).required(),
    vehicleYear: Joi.number().min(1990).max(new Date().getFullYear()).required(),
    licenseNumber: Joi.string().min(5).max(20).required(),
    insuranceNumber: Joi.string().min(5).max(30).required(),
    maxPassengers: Joi.number().min(1).max(8).default(3),
    baseRate: commonSchemas.price.required(),
    perKmRate: commonSchemas.price.required(),
    perMinuteRate: commonSchemas.price.required(),
    availableDays: Joi.array().items(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ).min(1).required(),
    workingHours: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    }).required()
  }),

  updateLocation: Joi.object({
    lat: commonSchemas.latitude,
    lng: commonSchemas.longitude
  })
};

// POI validation schemas
const poiValidation = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: commonSchemas.description.required(),
    category: Joi.string().valid(
      'temple', 'beach', 'restaurant', 'hotel', 'museum', 'park', 'shopping', 'nightlife', 'adventure', 'culture'
    ).required(),
    latitude: commonSchemas.latitude,
    longitude: commonSchemas.longitude,
    address: Joi.string().min(5).max(200).required(),
    city: Joi.string().min(2).max(50).required(),
    entryFee: commonSchemas.price.optional(),
    operatingHours: Joi.object({
      monday: Joi.string().allow('').optional(),
      tuesday: Joi.string().allow('').optional(),
      wednesday: Joi.string().allow('').optional(),
      thursday: Joi.string().allow('').optional(),
      friday: Joi.string().allow('').optional(),
      saturday: Joi.string().allow('').optional(),
      sunday: Joi.string().allow('').optional()
    }).optional(),
    bestTimeToVisit: Joi.string().max(100).optional(),
    accessibility: Joi.string().max(200).optional(),
    images: Joi.array().items(Joi.string().uri()).max(10).optional(),
    tags: Joi.array().items(Joi.string().max(20)).max(10).optional()
  }),

  search: Joi.object({
    lat: commonSchemas.latitude,
    lng: commonSchemas.longitude,
    radius: Joi.number().min(1).max(100).default(10),
    category: Joi.string().valid(
      'temple', 'beach', 'restaurant', 'hotel', 'museum', 'park', 'shopping', 'nightlife', 'adventure', 'culture'
    ).optional(),
    city: Joi.string().min(2).max(50).optional(),
    query: Joi.string().min(2).max(100).optional()
  })
};

// Booking validation schemas
const bookingValidation = {
  create: Joi.object({
    type: Joi.string().valid('guide', 'driver', 'combined').required(),
    guideId: commonSchemas.id.when('type', {
      is: Joi.string().valid('guide', 'combined'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    driverId: commonSchemas.id.when('type', {
      is: Joi.string().valid('driver', 'combined'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    startDate: Joi.date().min('now').required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required(),
    duration: Joi.number().min(1).max(24).required(),
    groupSize: Joi.number().min(1).max(20).required(),
    pickupLocation: Joi.object({
      address: Joi.string().min(5).max(200).required(),
      latitude: commonSchemas.latitude,
      longitude: commonSchemas.longitude
    }).required(),
    dropoffLocation: Joi.object({
      address: Joi.string().min(5).max(200).optional(),
      latitude: commonSchemas.latitude.optional(),
      longitude: commonSchemas.longitude.optional()
    }).optional(),
    specialRequests: Joi.string().max(500).optional(),
    totalAmount: commonSchemas.price.required()
  }),

  update: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled').optional(),
    specialRequests: Joi.string().max(500).optional()
  })
};

// Community validation schemas
const communityValidation = {
  createUpdate: Joi.object({
    type: Joi.string().valid('closure', 'scam_alert', 'safety_alert', 'tip', 'price_update').required(),
    title: Joi.string().min(5).max(100).required(),
    description: Joi.string().min(10).max(1000).required(),
    location: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      latitude: commonSchemas.latitude,
      longitude: commonSchemas.longitude
    }).required(),
    severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    expiresAt: Joi.date().min('now').optional(),
    images: Joi.array().items(Joi.string().uri()).max(5).optional(),
    tags: Joi.array().items(Joi.string().max(20)).max(5).optional()
  }),

  createEvent: Joi.object({
    title: Joi.string().min(5).max(100).required(),
    description: Joi.string().min(10).max(1000).required(),
    startDate: Joi.date().min('now').required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required(),
    location: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      address: Joi.string().min(5).max(200).required(),
      latitude: commonSchemas.latitude,
      longitude: commonSchemas.longitude
    }).required(),
    category: Joi.string().valid('festival', 'market', 'music', 'art', 'religious', 'seasonal').required(),
    entryFee: commonSchemas.price.optional(),
    maxAttendees: Joi.number().min(1).optional(),
    images: Joi.array().items(Joi.string().uri()).max(5).optional(),
    tags: Joi.array().items(Joi.string().max(20)).max(5).optional()
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

// Query validation middleware
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Query validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

module.exports = {
  commonSchemas,
  userValidation,
  guideValidation,
  driverValidation,
  poiValidation,
  bookingValidation,
  communityValidation,
  validate,
  validateQuery
};
