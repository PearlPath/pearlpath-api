const { db } = require('../config/database');
const { geoUtils, businessUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class Driver {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.vehicleType = data.vehicle_type;
    this.vehicleNumber = data.vehicle_number;
    this.vehicleModel = data.vehicle_model;
    this.vehicleYear = data.vehicle_year;
    this.licenseNumber = data.license_number;
    this.insuranceNumber = data.insurance_number;
    this.maxPassengers = data.max_passengers;
    this.baseRate = data.base_rate;
    this.perKmRate = data.per_km_rate;
    this.perMinuteRate = data.per_minute_rate;
    this.availableDays = data.available_days;
    this.workingHours = data.working_hours;
    this.rating = data.rating || 0;
    this.totalReviews = data.total_reviews || 0;
    this.totalRides = data.total_rides || 0;
    this.isOnline = data.is_online || false;
    this.currentLat = data.current_lat;
    this.currentLng = data.current_lng;
    this.lastLocationUpdate = data.last_location_update;
    this.verificationStatus = data.verification_status || 'pending';
    this.verificationDocuments = data.verification_documents || [];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.user = data.user;
  }

  // Create a new driver
  static async create(driverData) {
    try {
      const driver = {
        id: require('uuid').v4(),
        user_id: driverData.userId,
        vehicle_type: driverData.vehicleType,
        vehicle_number: driverData.vehicleNumber,
        vehicle_model: driverData.vehicleModel,
        vehicle_year: driverData.vehicleYear,
        license_number: driverData.licenseNumber,
        insurance_number: driverData.insuranceNumber,
        max_passengers: driverData.maxPassengers || 3,
        base_rate: driverData.baseRate,
        per_km_rate: driverData.perKmRate,
        per_minute_rate: driverData.perMinuteRate,
        available_days: driverData.availableDays,
        working_hours: driverData.workingHours,
        rating: 0,
        total_reviews: 0,
        total_rides: 0,
        is_online: false,
        verification_status: 'pending',
        verification_documents: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdDriver = await db.drivers.create(driver);
      return new Driver(createdDriver);
    } catch (error) {
      logger.error('Error creating driver:', error);
      throw error;
    }
  }

  // Find driver by ID
  static async findById(id) {
    try {
      const driver = await db.drivers.findById(id);
      return driver ? new Driver(driver) : null;
    } catch (error) {
      logger.error('Error finding driver by ID:', error);
      throw error;
    }
  }

  // Find driver by user ID
  static async findByUserId(userId) {
    try {
      const { data, error } = await db.supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? new Driver(data) : null;
    } catch (error) {
      logger.error('Error finding driver by user ID:', error);
      throw error;
    }
  }

  // Find drivers near location
  static async findNearby(lat, lng, radius = 5, filters = {}) {
    try {
      const drivers = await db.drivers.findNearby(lat, lng, radius);
      
      let filteredDrivers = drivers;

      // Apply additional filters
      if (filters.vehicleType) {
        filteredDrivers = filteredDrivers.filter(driver => 
          driver.vehicle_type === filters.vehicleType
        );
      }

      if (filters.maxPassengers) {
        filteredDrivers = filteredDrivers.filter(driver => 
          driver.max_passengers >= filters.maxPassengers
        );
      }

      if (filters.availableNow) {
        const now = new Date();
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
        const currentHour = now.getHours();
        
        filteredDrivers = filteredDrivers.filter(driver => {
          const workingStart = parseInt(driver.working_hours.start.split(':')[0]);
          const workingEnd = parseInt(driver.working_hours.end.split(':')[0]);
          return driver.available_days.includes(dayOfWeek) && 
                 driver.is_online && 
                 currentHour >= workingStart && 
                 currentHour <= workingEnd;
        });
      }

      return filteredDrivers.map(driver => new Driver(driver));
    } catch (error) {
      logger.error('Error finding nearby drivers:', error);
      throw error;
    }
  }

  // Update driver
  async update(updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const updatedDriver = await db.drivers.update(this.id, updates);
      return new Driver(updatedDriver);
    } catch (error) {
      logger.error('Error updating driver:', error);
      throw error;
    }
  }

  // Update online status
  async updateOnlineStatus(isOnline) {
    try {
      await this.update({ is_online: isOnline });
      this.isOnline = isOnline;
    } catch (error) {
      logger.error('Error updating driver online status:', error);
      throw error;
    }
  }

  // Update location
  async updateLocation(lat, lng) {
    try {
      await db.drivers.updateLocation(this.id, lat, lng);
      
      this.currentLat = lat;
      this.currentLng = lng;
      this.lastLocationUpdate = new Date().toISOString();
    } catch (error) {
      logger.error('Error updating driver location:', error);
      throw error;
    }
  }

  // Update rating
  async updateRating(newRating) {
    try {
      const totalReviews = this.totalReviews + 1;
      const rating = ((this.rating * this.totalReviews) + newRating) / totalReviews;

      await this.update({
        rating: Math.round(rating * 10) / 10,
        total_reviews: totalReviews
      });

      this.rating = Math.round(rating * 10) / 10;
      this.totalReviews = totalReviews;
    } catch (error) {
      logger.error('Error updating driver rating:', error);
      throw error;
    }
  }

  // Increment ride count
  async incrementRides() {
    try {
      const totalRides = this.totalRides + 1;
      await this.update({ total_rides: totalRides });
      this.totalRides = totalRides;
    } catch (error) {
      logger.error('Error incrementing driver rides:', error);
      throw error;
    }
  }

  // Calculate distance from user
  calculateDistance(userLat, userLng) {
    if (!this.currentLat || !this.currentLng) return null;
    return geoUtils.calculateDistance(userLat, userLng, this.currentLat, this.currentLng);
  }

  // Check if driver is available for ride
  isAvailableForRide(startTime, duration) {
    if (!this.isOnline) return false;

    const startDate = new Date(startTime);
    const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    if (!this.availableDays.includes(dayOfWeek)) return false;

    const startHour = startDate.getHours();
    const workingStart = parseInt(this.workingHours.start.split(':')[0]);
    const workingEnd = parseInt(this.workingHours.end.split(':')[0]);
    const endHour = startHour + duration;

    return startHour >= workingStart && endHour <= workingEnd;
  }

  // Calculate ride price
  calculatePrice(distance, duration, surgeMultiplier = 1) {
    const basePrice = this.baseRate;
    const distancePrice = distance * this.perKmRate;
    const timePrice = duration * this.perMinuteRate;
    const totalPrice = (basePrice + distancePrice + timePrice) * surgeMultiplier;
    
    return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
  }

  // Calculate surge multiplier based on demand and conditions
  calculateSurgeMultiplier(demand = 0.5, weather = 'clear') {
    return businessUtils.calculateSurgeMultiplier(
      new Date().getHours(),
      weather,
      demand
    );
  }

  // Get safe driver data
  toSafeObject() {
    return {
      id: this.id,
      userId: this.userId,
      vehicleType: this.vehicleType,
      vehicleNumber: this.vehicleNumber,
      vehicleModel: this.vehicleModel,
      vehicleYear: this.vehicleYear,
      maxPassengers: this.maxPassengers,
      baseRate: this.baseRate,
      perKmRate: this.perKmRate,
      perMinuteRate: this.perMinuteRate,
      availableDays: this.availableDays,
      workingHours: this.workingHours,
      rating: this.rating,
      totalReviews: this.totalReviews,
      totalRides: this.totalRides,
      isOnline: this.isOnline,
      verificationStatus: this.verificationStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: this.user ? {
        id: this.user.id,
        firstName: this.user.first_name,
        lastName: this.user.last_name,
        profileImage: this.user.profile_image
      } : null
    };
  }

  // Get public profile data
  toPublicObject() {
    return {
      id: this.id,
      vehicleType: this.vehicleType,
      vehicleModel: this.vehicleModel,
      vehicleYear: this.vehicleYear,
      maxPassengers: this.maxPassengers,
      baseRate: this.baseRate,
      perKmRate: this.perKmRate,
      perMinuteRate: this.perMinuteRate,
      rating: this.rating,
      totalReviews: this.totalReviews,
      totalRides: this.totalRides,
      isOnline: this.isOnline,
      verificationStatus: this.verificationStatus,
      user: this.user ? {
        firstName: this.user.first_name,
        lastName: this.user.last_name,
        profileImage: this.user.profile_image
      } : null
    };
  }

  // Get location data for map display (privacy blurred)
  getLocationData() {
    if (!this.isOnline || !this.currentLat || !this.currentLng) {
      return null;
    }

    // Add some random offset for privacy when stationary
    const offset = 0.001; // ~100m offset
    const latOffset = (Math.random() - 0.5) * offset;
    const lngOffset = (Math.random() - 0.5) * offset;

    return {
      lat: this.currentLat + latOffset,
      lng: this.currentLng + lngOffset,
      lastUpdate: this.lastLocationUpdate
    };
  }
}

module.exports = Driver;
