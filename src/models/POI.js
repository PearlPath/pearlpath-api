const { db } = require('../config/database');
const { geoUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class POI {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.category = data.category;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.address = data.address;
    this.city = data.city;
    this.entryFee = data.entry_fee;
    this.operatingHours = data.operating_hours;
    this.bestTimeToVisit = data.best_time_to_visit;
    this.accessibility = data.accessibility;
    this.images = data.images || [];
    this.tags = data.tags || [];
    this.rating = data.rating || 0;
    this.totalReviews = data.total_reviews || 0;
    this.visitCount = data.visit_count || 0;
    this.isVerified = data.is_verified || false;
    this.verifiedBy = data.verified_by;
    this.verifiedAt = data.verified_at;
    this.createdBy = data.created_by;
    this.status = data.status || 'active';
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new POI
  static async create(poiData) {
    try {
      const poi = {
        id: require('uuid').v4(),
        name: poiData.name,
        description: poiData.description,
        category: poiData.category,
        latitude: poiData.latitude,
        longitude: poiData.longitude,
        address: poiData.address,
        city: poiData.city,
        entry_fee: poiData.entryFee || 0,
        operating_hours: poiData.operatingHours || {},
        best_time_to_visit: poiData.bestTimeToVisit,
        accessibility: poiData.accessibility,
        images: poiData.images || [],
        tags: poiData.tags || [],
        rating: 0,
        total_reviews: 0,
        visit_count: 0,
        is_verified: false,
        created_by: poiData.createdBy,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdPOI = await db.pois.create(poi);
      return new POI(createdPOI);
    } catch (error) {
      logger.error('Error creating POI:', error);
      throw error;
    }
  }

  // Find POI by ID
  static async findById(id) {
    try {
      const poi = await db.pois.findById(id);
      return poi ? new POI(poi) : null;
    } catch (error) {
      logger.error('Error finding POI by ID:', error);
      throw error;
    }
  }

  // Find POIs near location
  static async findNearby(lat, lng, radius = 10, category = null) {
    try {
      const pois = await db.pois.findNearby(lat, lng, radius, category);
      return pois.map(poi => new POI(poi));
    } catch (error) {
      logger.error('Error finding nearby POIs:', error);
      throw error;
    }
  }

  // Search POIs
  static async search(query, filters = {}) {
    try {
      const pois = await db.pois.search(query, filters);
      return pois.map(poi => new POI(poi));
    } catch (error) {
      logger.error('Error searching POIs:', error);
      throw error;
    }
  }

  // Update POI
  async update(updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const updatedPOI = await db.pois.update(this.id, updates);
      return new POI(updatedPOI);
    } catch (error) {
      logger.error('Error updating POI:', error);
      throw error;
    }
  }

  // Add image
  async addImage(imageUrl) {
    try {
      const images = [...this.images, imageUrl];
      await this.update({ images });
      this.images = images;
    } catch (error) {
      logger.error('Error adding image to POI:', error);
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
      logger.error('Error updating POI rating:', error);
      throw error;
    }
  }

  // Increment visit count
  async incrementVisitCount() {
    try {
      const visitCount = this.visitCount + 1;
      await this.update({ visit_count: visitCount });
      this.visitCount = visitCount;
    } catch (error) {
      logger.error('Error incrementing POI visit count:', error);
      throw error;
    }
  }

  // Verify POI
  async verify(verifiedBy) {
    try {
      await this.update({
        is_verified: true,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString()
      });

      this.isVerified = true;
      this.verifiedBy = verifiedBy;
      this.verifiedAt = new Date().toISOString();
    } catch (error) {
      logger.error('Error verifying POI:', error);
      throw error;
    }
  }

  // Calculate distance from user
  calculateDistance(userLat, userLng) {
    return geoUtils.calculateDistance(userLat, userLng, this.latitude, this.longitude);
  }

  // Check if POI is open at given time
  isOpenAt(time = new Date()) {
    if (!this.operatingHours) return true;

    const dayOfWeek = time.toLocaleDateString('en-US', { weekday: 'lowercase' });
    const dayHours = this.operatingHours[dayOfWeek];
    
    if (!dayHours || dayHours === '') return false;

    const currentTime = time.toTimeString().slice(0, 5); // HH:MM format
    const [openTime, closeTime] = dayHours.split(' - ');
    
    if (!openTime || !closeTime) return false;

    return currentTime >= openTime && currentTime <= closeTime;
  }

  // Get current status
  getCurrentStatus() {
    const now = new Date();
    return {
      isOpen: this.isOpenAt(now),
      nextOpenTime: this.getNextOpenTime(now),
      bestTimeToVisit: this.bestTimeToVisit
    };
  }

  // Get next open time
  getNextOpenTime(fromTime = new Date()) {
    if (!this.operatingHours) return null;

    for (let i = 0; i < 7; i++) {
      const checkTime = new Date(fromTime);
      checkTime.setDate(checkTime.getDate() + i);
      
      const dayOfWeek = checkTime.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const dayHours = this.operatingHours[dayOfWeek];
      
      if (dayHours && dayHours !== '') {
        const [openTime] = dayHours.split(' - ');
        if (openTime) {
          const [hours, minutes] = openTime.split(':');
          checkTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          if (checkTime > fromTime) {
            return checkTime;
          }
        }
      }
    }
    
    return null;
  }

  // Get safe POI data
  toSafeObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      latitude: this.latitude,
      longitude: this.longitude,
      address: this.address,
      city: this.city,
      entryFee: this.entryFee,
      operatingHours: this.operatingHours,
      bestTimeToVisit: this.bestTimeToVisit,
      accessibility: this.accessibility,
      images: this.images,
      tags: this.tags,
      rating: this.rating,
      totalReviews: this.totalReviews,
      visitCount: this.visitCount,
      isVerified: this.isVerified,
      verifiedAt: this.verifiedAt,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Get public POI data
  toPublicObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      latitude: this.latitude,
      longitude: this.longitude,
      address: this.address,
      city: this.city,
      entryFee: this.entryFee,
      operatingHours: this.operatingHours,
      bestTimeToVisit: this.bestTimeToVisit,
      accessibility: this.accessibility,
      images: this.images,
      tags: this.tags,
      rating: this.rating,
      totalReviews: this.totalReviews,
      visitCount: this.visitCount,
      isVerified: this.isVerified,
      status: this.getCurrentStatus()
    };
  }
}

module.exports = POI;
