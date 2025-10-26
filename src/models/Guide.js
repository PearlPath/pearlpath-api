const { db } = require('../config/database');
const { geoUtils, businessUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class Guide {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.languages = data.languages;
    this.specializations = data.specializations;
    this.hourlyRate = data.hourly_rate;
    this.bio = data.bio;
    this.experience = data.experience;
    this.licenseNumber = data.license_number;
    this.vehicleOwned = data.vehicle_owned;
    this.maxGroupSize = data.max_group_size;
    this.availableDays = data.available_days;
    this.workingHours = data.working_hours;
    this.rating = data.rating || 0;
    this.totalReviews = data.total_reviews || 0;
    this.totalBookings = data.total_bookings || 0;
    this.isAvailable = data.is_available || false;
    this.currentLat = data.current_lat;
    this.currentLng = data.current_lng;
    this.lastLocationUpdate = data.last_location_update;
    this.portfolio = data.portfolio || [];
    this.verificationStatus = data.verification_status || 'pending';
    this.verificationDocuments = data.verification_documents || [];
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.user = data.user;
  }

  // Create a new guide
  static async create(guideData) {
    try {
      const guide = {
        id: require('uuid').v4(),
        user_id: guideData.userId,
        languages: guideData.languages,
        specializations: guideData.specializations,
        hourly_rate: guideData.hourlyRate,
        bio: guideData.bio,
        experience: guideData.experience,
        license_number: guideData.licenseNumber,
        vehicle_owned: guideData.vehicleOwned || false,
        max_group_size: guideData.maxGroupSize || 10,
        available_days: guideData.availableDays,
        working_hours: guideData.workingHours,
        rating: 0,
        total_reviews: 0,
        total_bookings: 0,
        is_available: false,
        verification_status: 'pending',
        verification_documents: [],
        portfolio: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdGuide = await db.guides.create(guide);
      return new Guide(createdGuide);
    } catch (error) {
      logger.error('Error creating guide:', error);
      throw error;
    }
  }

  // Find guide by ID
  static async findById(id) {
    try {
      const guide = await db.guides.findById(id);
      return guide ? new Guide(guide) : null;
    } catch (error) {
      logger.error('Error finding guide by ID:', error);
      throw error;
    }
  }

  // Find guide by user ID
  static async findByUserId(userId) {
    try {
      const { data, error } = await db.supabase
        .from('guides')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? new Guide(data) : null;
    } catch (error) {
      logger.error('Error finding guide by user ID:', error);
      throw error;
    }
  }

  // Find guides near location
  static async findNearby(lat, lng, radius = 10, filters = {}) {
    try {
      const guides = await db.guides.findNearby(lat, lng, radius);
      
      let filteredGuides = guides;

      // Apply additional filters
      if (filters.languages && filters.languages.length > 0) {
        filteredGuides = filteredGuides.filter(guide => 
          filters.languages.some(lang => guide.languages.includes(lang))
        );
      }

      if (filters.specializations && filters.specializations.length > 0) {
        filteredGuides = filteredGuides.filter(guide => 
          filters.specializations.some(spec => guide.specializations.includes(spec))
        );
      }

      if (filters.minPrice !== undefined) {
        filteredGuides = filteredGuides.filter(guide => guide.hourly_rate >= filters.minPrice);
      }

      if (filters.maxPrice !== undefined) {
        filteredGuides = filteredGuides.filter(guide => guide.hourly_rate <= filters.maxPrice);
      }

      if (filters.availableToday) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
        filteredGuides = filteredGuides.filter(guide => 
          guide.available_days.includes(today) && guide.is_available
        );
      }

      return filteredGuides.map(guide => new Guide(guide));
    } catch (error) {
      logger.error('Error finding nearby guides:', error);
      throw error;
    }
  }

  // Update guide
  async update(updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const updatedGuide = await db.guides.update(this.id, updates);
      return new Guide(updatedGuide);
    } catch (error) {
      logger.error('Error updating guide:', error);
      throw error;
    }
  }

  // Update availability
  async updateAvailability(isAvailable) {
    try {
      await this.update({ is_available: isAvailable });
      this.isAvailable = isAvailable;
    } catch (error) {
      logger.error('Error updating guide availability:', error);
      throw error;
    }
  }

  // Update location
  async updateLocation(lat, lng) {
    try {
      await db.guides.update(this.id, {
        current_lat: lat,
        current_lng: lng,
        last_location_update: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      this.currentLat = lat;
      this.currentLng = lng;
      this.lastLocationUpdate = new Date().toISOString();
    } catch (error) {
      logger.error('Error updating guide location:', error);
      throw error;
    }
  }

  // Add to portfolio
  async addToPortfolio(portfolioItem) {
    try {
      const portfolio = [...this.portfolio, {
        id: require('uuid').v4(),
        ...portfolioItem,
        addedAt: new Date().toISOString()
      }];

      await this.update({ portfolio });
      this.portfolio = portfolio;
    } catch (error) {
      logger.error('Error adding to portfolio:', error);
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
      logger.error('Error updating guide rating:', error);
      throw error;
    }
  }

  // Increment booking count
  async incrementBookings() {
    try {
      const totalBookings = this.totalBookings + 1;
      await this.update({ total_bookings: totalBookings });
      this.totalBookings = totalBookings;
    } catch (error) {
      logger.error('Error incrementing guide bookings:', error);
      throw error;
    }
  }

  // Calculate distance from user
  calculateDistance(userLat, userLng) {
    if (!this.currentLat || !this.currentLng) return null;
    return geoUtils.calculateDistance(userLat, userLng, this.currentLat, this.currentLng);
  }

  // Check if guide is available for booking
  isAvailableForBooking(startTime, duration) {
    if (!this.isAvailable) return false;

    const startDate = new Date(startTime);
    const dayOfWeek = startDate.toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    if (!this.availableDays.includes(dayOfWeek)) return false;

    const startHour = startDate.getHours();
    const workingStart = parseInt(this.workingHours.start.split(':')[0]);
    const workingEnd = parseInt(this.workingHours.end.split(':')[0]);
    const endHour = startHour + duration;

    return startHour >= workingStart && endHour <= workingEnd;
  }

  // Calculate booking price
  calculatePrice(duration, groupSize = 1) {
    const basePrice = this.hourlyRate * duration;
    const groupMultiplier = groupSize > this.maxGroupSize ? 1.5 : 1;
    return basePrice * groupMultiplier;
  }

  // Get safe guide data
  toSafeObject() {
    return {
      id: this.id,
      userId: this.userId,
      languages: this.languages,
      specializations: this.specializations,
      hourlyRate: this.hourlyRate,
      bio: this.bio,
      experience: this.experience,
      vehicleOwned: this.vehicleOwned,
      maxGroupSize: this.maxGroupSize,
      availableDays: this.availableDays,
      workingHours: this.workingHours,
      rating: this.rating,
      totalReviews: this.totalReviews,
      totalBookings: this.totalBookings,
      isAvailable: this.isAvailable,
      portfolio: this.portfolio,
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
      languages: this.languages,
      specializations: this.specializations,
      hourlyRate: this.hourlyRate,
      bio: this.bio,
      experience: this.experience,
      vehicleOwned: this.vehicleOwned,
      maxGroupSize: this.maxGroupSize,
      availableDays: this.availableDays,
      workingHours: this.workingHours,
      rating: this.rating,
      totalReviews: this.totalReviews,
      totalBookings: this.totalBookings,
      isAvailable: this.isAvailable,
      portfolio: this.portfolio,
      verificationStatus: this.verificationStatus,
      user: this.user ? {
        firstName: this.user.first_name,
        lastName: this.user.last_name,
        profileImage: this.user.profile_image
      } : null
    };
  }
}

module.exports = Guide;
