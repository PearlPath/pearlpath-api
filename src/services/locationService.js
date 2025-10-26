const { geoUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class LocationService {
  // Calculate distance between two points
  calculateDistance(lat1, lng1, lat2, lng2) {
    return geoUtils.calculateDistance(lat1, lng1, lat2, lng2);
  }

  // Check if point is within radius
  isWithinRadius(userLat, userLng, targetLat, targetLng, radiusKm) {
    return geoUtils.isWithinRadius(userLat, userLng, targetLat, targetLng, radiusKm);
  }

  // Generate bounding box for search
  generateBoundingBox(lat, lng, radiusKm) {
    return geoUtils.generateBoundingBox(lat, lng, radiusKm);
  }

  // Find nearby guides
  async findNearbyGuides(lat, lng, radius = 10, filters = {}) {
    try {
      const Guide = require('../models/Guide');
      const guides = await Guide.findNearby(lat, lng, radius, filters);
      
      return guides.map(guide => {
        const distance = guide.calculateDistance(lat, lng);
        return {
          ...guide.toPublicObject(),
          distance: distance ? Math.round(distance * 100) / 100 : null
        };
      });
    } catch (error) {
      logger.error('Error finding nearby guides:', error);
      throw error;
    }
  }

  // Find nearby drivers
  async findNearbyDrivers(lat, lng, radius = 5, filters = {}) {
    try {
      const Driver = require('../models/Driver');
      const drivers = await Driver.findNearby(lat, lng, radius, filters);
      
      return drivers.map(driver => {
        const distance = driver.calculateDistance(lat, lng);
        return {
          ...driver.toPublicObject(),
          distance: distance ? Math.round(distance * 100) / 100 : null,
          location: driver.getLocationData() // Privacy-blurred location
        };
      });
    } catch (error) {
      logger.error('Error finding nearby drivers:', error);
      throw error;
    }
  }

  // Find nearby POIs
  async findNearbyPOIs(lat, lng, radius = 10, category = null) {
    try {
      const POI = require('../models/POI');
      const pois = await POI.findNearby(lat, lng, radius, category);
      
      return pois.map(poi => {
        const distance = poi.calculateDistance(lat, lng);
        return {
          ...poi.toPublicObject(),
          distance: distance ? Math.round(distance * 100) / 100 : null
        };
      });
    } catch (error) {
      logger.error('Error finding nearby POIs:', error);
      throw error;
    }
  }

  // Calculate route distance and duration (placeholder for future integration with mapping service)
  async calculateRoute(origin, destination, mode = 'driving') {
    try {
      // This would typically integrate with Google Maps or similar service
      // For now, returning a placeholder response
      const distance = this.calculateDistance(
        origin.lat, origin.lng,
        destination.lat, destination.lng
      );
      
      // Estimate duration based on distance and mode
      let durationMinutes;
      switch (mode) {
        case 'walking':
          durationMinutes = distance * 12; // ~12 minutes per km
          break;
        case 'cycling':
          durationMinutes = distance * 4; // ~4 minutes per km
          break;
        case 'driving':
        default:
          durationMinutes = distance * 2; // ~2 minutes per km
          break;
      }

      return {
        distance: Math.round(distance * 100) / 100,
        duration: Math.round(durationMinutes),
        mode
      };
    } catch (error) {
      logger.error('Error calculating route:', error);
      throw error;
    }
  }

  // Get current weather (placeholder for future integration)
  async getCurrentWeather(lat, lng) {
    try {
      // This would typically integrate with a weather API
      // For now, returning a placeholder response
      return {
        temperature: 28,
        condition: 'sunny',
        humidity: 75,
        windSpeed: 12,
        description: 'Partly cloudy'
      };
    } catch (error) {
      logger.error('Error getting weather:', error);
      throw error;
    }
  }

  // Validate coordinates
  validateCoordinates(lat, lng) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return { valid: false, error: 'Invalid coordinates format' };
    }
    
    if (latitude < -90 || latitude > 90) {
      return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (longitude < -180 || longitude > 180) {
      return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, lat: latitude, lng: longitude };
  }

  // Get address from coordinates (reverse geocoding placeholder)
  async reverseGeocode(lat, lng) {
    try {
      // This would typically integrate with a geocoding service
      // For now, returning a placeholder response
      return {
        address: 'Sample Address, Colombo, Sri Lanka',
        city: 'Colombo',
        country: 'Sri Lanka',
        postalCode: '00100'
      };
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  // Get coordinates from address (geocoding placeholder)
  async geocode(address) {
    try {
      // This would typically integrate with a geocoding service
      // For now, returning a placeholder response
      return {
        lat: 6.9271,
        lng: 79.8612,
        address: address,
        formattedAddress: 'Colombo, Sri Lanka'
      };
    } catch (error) {
      logger.error('Error geocoding:', error);
      throw error;
    }
  }

  // Check if location is in Sri Lanka
  isInSriLanka(lat, lng) {
    // Sri Lanka bounding box (approximate)
    const sriLankaBounds = {
      north: 9.8312,
      south: 5.9167,
      east: 81.8813,
      west: 79.6954
    };
    
    return lat >= sriLankaBounds.south && 
           lat <= sriLankaBounds.north && 
           lng >= sriLankaBounds.west && 
           lng <= sriLankaBounds.east;
  }

  // Get popular cities in Sri Lanka
  getPopularCities() {
    return [
      { name: 'Colombo', lat: 6.9271, lng: 79.8612, country: 'Sri Lanka' },
      { name: 'Kandy', lat: 7.2906, lng: 80.6337, country: 'Sri Lanka' },
      { name: 'Galle', lat: 6.0535, lng: 80.2210, country: 'Sri Lanka' },
      { name: 'Ella', lat: 6.8667, lng: 81.0500, country: 'Sri Lanka' },
      { name: 'Sigiriya', lat: 7.9569, lng: 80.7597, country: 'Sri Lanka' },
      { name: 'Anuradhapura', lat: 8.3114, lng: 80.4037, country: 'Sri Lanka' },
      { name: 'Polonnaruwa', lat: 7.9403, lng: 81.0187, country: 'Sri Lanka' },
      { name: 'Nuwara Eliya', lat: 6.9497, lng: 80.7891, country: 'Sri Lanka' },
      { name: 'Trincomalee', lat: 8.5874, lng: 81.2152, country: 'Sri Lanka' },
      { name: 'Jaffna', lat: 9.6615, lng: 80.0255, country: 'Sri Lanka' }
    ];
  }
}

module.exports = new LocationService();
