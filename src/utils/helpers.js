const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const moment = require('moment');

// Password utilities
const passwordUtils = {
  async hash(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  },

  async compare(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  },

  generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
};

// JWT utilities
const jwtUtils = {
  generateTokens(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
    });

    return { accessToken, refreshToken };
  },

  verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  },

  verifyRefreshToken(token) {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  },

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }
};

// Distance calculation utilities
const geoUtils = {
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  },

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  },

  isWithinRadius(userLat, userLng, targetLat, targetLng, radiusKm) {
    const distance = this.calculateDistance(userLat, userLng, targetLat, targetLng);
    return distance <= radiusKm;
  },

  generateBoundingBox(lat, lng, radiusKm) {
    const latDelta = radiusKm / 111; // Approximate degrees per km for latitude
    const lngDelta = radiusKm / (111 * Math.cos(this.toRadians(lat))); // Adjust for longitude
    
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta
    };
  }
};

// String utilities
const stringUtils = {
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  truncate(text, length = 100) {
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + '...';
  },

  capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

// Date utilities
const dateUtils = {
  formatDate(date, format = 'YYYY-MM-DD') {
    return moment(date).format(format);
  },

  addDays(date, days) {
    return moment(date).add(days, 'days').toDate();
  },

  addHours(date, hours) {
    return moment(date).add(hours, 'hours').toDate();
  },

  isToday(date) {
    return moment(date).isSame(moment(), 'day');
  },

  isPast(date) {
    return moment(date).isBefore(moment());
  },

  isFuture(date) {
    return moment(date).isAfter(moment());
  },

  getTimeDifference(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    return end.diff(start, 'minutes');
  }
};

// File utilities
const fileUtils = {
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  },

  generateUniqueFilename(originalName) {
    const ext = this.getFileExtension(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}.${ext}`;
  },

  isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const ext = this.getFileExtension(filename);
    return imageExtensions.includes(ext);
  },

  isVideoFile(filename) {
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const ext = this.getFileExtension(filename);
    return videoExtensions.includes(ext);
  }
};

// Response utilities
const responseUtils = {
  success(data = null, message = 'Success', statusCode = 200) {
    return {
      success: true,
      message,
      data,
      statusCode
    };
  },

  error(message = 'Error', statusCode = 500, errors = null) {
    return {
      success: false,
      message,
      errors,
      statusCode
    };
  },

  paginated(data, pagination) {
    return {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        pages: Math.ceil(pagination.total / pagination.limit)
      }
    };
  }
};

// Validation utilities
const validationUtils = {
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isValidPhone(phone) {
    const phoneRegex = /^(\+94|0)[0-9]{9}$/;
    return phoneRegex.test(phone);
  },

  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim().replace(/[<>]/g, '');
  }
};

// Business logic utilities
const businessUtils = {
  calculateGuideCommission(amount, isVerified = true) {
    const commissionRate = isVerified ? 0.10 : 0.15; // 10% for verified, 15% for unverified
    return amount * commissionRate;
  },

  calculateDriverCommission(amount) {
    const commissionRate = 0.05; // 5% for drivers
    return amount * commissionRate;
  },

  calculateSurgeMultiplier(time, weather, demand) {
    let multiplier = 1.0;
    
    // Peak time multiplier (rush hours, weekends)
    if (time >= 7 && time <= 9) multiplier += 0.2; // Morning rush
    if (time >= 17 && time <= 19) multiplier += 0.2; // Evening rush
    if (new Date().getDay() === 0 || new Date().getDay() === 6) multiplier += 0.1; // Weekend
    
    // Weather multiplier
    if (weather === 'rain') multiplier += 0.15;
    if (weather === 'storm') multiplier += 0.25;
    
    // Demand multiplier
    if (demand > 0.8) multiplier += 0.3;
    else if (demand > 0.6) multiplier += 0.15;
    
    return Math.min(multiplier, 2.0); // Cap at 2x
  },

  generateBookingReference() {
    const prefix = 'PP';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }
};

module.exports = {
  passwordUtils,
  jwtUtils,
  geoUtils,
  stringUtils,
  dateUtils,
  fileUtils,
  responseUtils,
  validationUtils,
  businessUtils
};
