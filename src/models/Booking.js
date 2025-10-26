const { db } = require('../config/database');
const { businessUtils, dateUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class Booking {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.guideId = data.guide_id;
    this.driverId = data.driver_id;
    this.type = data.type; // 'guide', 'driver', 'combined'
    this.bookingReference = data.booking_reference;
    this.startDate = data.start_date;
    this.endDate = data.end_date;
    this.duration = data.duration;
    this.groupSize = data.group_size;
    this.pickupLocation = data.pickup_location;
    this.dropoffLocation = data.dropoff_location;
    this.specialRequests = data.special_requests;
    this.totalAmount = data.total_amount;
    this.commission = data.commission || 0;
    this.status = data.status;
    this.paymentStatus = data.payment_status;
    this.paymentMethod = data.payment_method;
    this.paymentId = data.payment_id;
    this.cancelledAt = data.cancelled_at;
    this.cancelledBy = data.cancelled_by;
    this.cancellationReason = data.cancellation_reason;
    this.refundAmount = data.refund_amount;
    this.rating = data.rating;
    this.review = data.review;
    this.completedAt = data.completed_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.user = data.user;
    this.guide = data.guide;
    this.driver = data.driver;
  }

  // Create a new booking
  static async create(bookingData) {
    try {
      const booking = {
        id: require('uuid').v4(),
        user_id: bookingData.userId,
        guide_id: bookingData.guideId || null,
        driver_id: bookingData.driverId || null,
        type: bookingData.type,
        booking_reference: businessUtils.generateBookingReference(),
        start_date: bookingData.startDate,
        end_date: bookingData.endDate,
        duration: bookingData.duration,
        group_size: bookingData.groupSize,
        pickup_location: bookingData.pickupLocation,
        dropoff_location: bookingData.dropoffLocation || null,
        special_requests: bookingData.specialRequests || null,
        total_amount: bookingData.totalAmount,
        commission: 0, // Will be calculated after payment
        status: 'pending',
        payment_status: 'pending',
        payment_method: null,
        payment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdBooking = await db.bookings.create(booking);
      return new Booking(createdBooking);
    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }

  // Find booking by ID
  static async findById(id) {
    try {
      const booking = await db.bookings.findById(id);
      return booking ? new Booking(booking) : null;
    } catch (error) {
      logger.error('Error finding booking by ID:', error);
      throw error;
    }
  }

  // Find bookings by user
  static async findByUser(userId, filters = {}) {
    try {
      const bookings = await db.bookings.findByUser(userId);
      
      let filteredBookings = bookings;

      if (filters.status) {
        filteredBookings = filteredBookings.filter(booking => booking.status === filters.status);
      }

      if (filters.type) {
        filteredBookings = filteredBookings.filter(booking => booking.type === filters.type);
      }

      if (filters.startDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) <= new Date(filters.endDate)
        );
      }

      return filteredBookings.map(booking => new Booking(booking));
    } catch (error) {
      logger.error('Error finding bookings by user:', error);
      throw error;
    }
  }

  // Find bookings by guide
  static async findByGuide(guideId, filters = {}) {
    try {
      const { data, error } = await db.supabase
        .from('bookings')
        .select(`
          *,
          user:users(*),
          driver:drivers(*)
        `)
        .eq('guide_id', guideId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      let filteredBookings = data;

      if (filters.status) {
        filteredBookings = filteredBookings.filter(booking => booking.status === filters.status);
      }

      if (filters.startDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) <= new Date(filters.endDate)
        );
      }

      return filteredBookings.map(booking => new Booking(booking));
    } catch (error) {
      logger.error('Error finding bookings by guide:', error);
      throw error;
    }
  }

  // Find bookings by driver
  static async findByDriver(driverId, filters = {}) {
    try {
      const { data, error } = await db.supabase
        .from('bookings')
        .select(`
          *,
          user:users(*),
          guide:guides(*)
        `)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      let filteredBookings = data;

      if (filters.status) {
        filteredBookings = filteredBookings.filter(booking => booking.status === filters.status);
      }

      if (filters.startDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) >= new Date(filters.startDate)
        );
      }

      if (filters.endDate) {
        filteredBookings = filteredBookings.filter(booking => 
          new Date(booking.start_date) <= new Date(filters.endDate)
        );
      }

      return filteredBookings.map(booking => new Booking(booking));
    } catch (error) {
      logger.error('Error finding bookings by driver:', error);
      throw error;
    }
  }

  // Update booking
  async update(updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const updatedBooking = await db.bookings.update(this.id, updates);
      return new Booking(updatedBooking);
    } catch (error) {
      logger.error('Error updating booking:', error);
      throw error;
    }
  }

  // Confirm booking
  async confirm() {
    try {
      await this.update({ status: 'confirmed' });
      this.status = 'confirmed';
    } catch (error) {
      logger.error('Error confirming booking:', error);
      throw error;
    }
  }

  // Start booking
  async start() {
    try {
      await this.update({ status: 'in_progress' });
      this.status = 'in_progress';
    } catch (error) {
      logger.error('Error starting booking:', error);
      throw error;
    }
  }

  // Complete booking
  async complete() {
    try {
      await this.update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      });
      this.status = 'completed';
      this.completedAt = new Date().toISOString();
    } catch (error) {
      logger.error('Error completing booking:', error);
      throw error;
    }
  }

  // Cancel booking
  async cancel(cancelledBy, reason, refundAmount = 0) {
    try {
      await this.update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
        refund_amount: refundAmount
      });

      this.status = 'cancelled';
      this.cancelledAt = new Date().toISOString();
      this.cancelledBy = cancelledBy;
      this.cancellationReason = reason;
      this.refundAmount = refundAmount;
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  // Update payment status
  async updatePaymentStatus(status, paymentMethod = null, paymentId = null) {
    try {
      await this.update({
        payment_status: status,
        payment_method: paymentMethod,
        payment_id: paymentId
      });

      this.paymentStatus = status;
      this.paymentMethod = paymentMethod;
      this.paymentId = paymentId;
    } catch (error) {
      logger.error('Error updating payment status:', error);
      throw error;
    }
  }

  // Calculate commission
  calculateCommission() {
    let commission = 0;
    
    if (this.guideId) {
      const guideCommission = businessUtils.calculateGuideCommission(this.totalAmount, true);
      commission += guideCommission;
    }
    
    if (this.driverId) {
      const driverCommission = businessUtils.calculateDriverCommission(this.totalAmount);
      commission += driverCommission;
    }
    
    return commission;
  }

  // Update commission
  async updateCommission() {
    try {
      const commission = this.calculateCommission();
      await this.update({ commission });
      this.commission = commission;
    } catch (error) {
      logger.error('Error updating commission:', error);
      throw error;
    }
  }

  // Add rating and review
  async addRating(rating, review = null) {
    try {
      await this.update({
        rating: rating,
        review: review
      });

      this.rating = rating;
      this.review = review;
    } catch (error) {
      logger.error('Error adding rating to booking:', error);
      throw error;
    }
  }

  // Check if booking can be cancelled
  canBeCancelled() {
    const now = new Date();
    const startTime = new Date(this.startDate);
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
    
    return ['pending', 'confirmed'].includes(this.status) && hoursUntilStart > 2;
  }

  // Calculate refund amount
  calculateRefundAmount() {
    if (this.status !== 'cancelled') return 0;
    
    const now = new Date();
    const startTime = new Date(this.startDate);
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
    
    if (hoursUntilStart > 24) {
      return this.totalAmount; // Full refund
    } else if (hoursUntilStart > 2) {
      return this.totalAmount * 0.5; // 50% refund
    } else {
      return 0; // No refund
    }
  }

  // Get booking duration in hours
  getDurationInHours() {
    return dateUtils.getTimeDifference(this.startDate, this.endDate) / 60;
  }

  // Check if booking is active
  isActive() {
    const now = new Date();
    const startTime = new Date(this.startDate);
    const endTime = new Date(this.endDate);
    
    return now >= startTime && now <= endTime && this.status === 'in_progress';
  }

  // Get safe booking data
  toSafeObject() {
    return {
      id: this.id,
      userId: this.userId,
      guideId: this.guideId,
      driverId: this.driverId,
      type: this.type,
      bookingReference: this.bookingReference,
      startDate: this.startDate,
      endDate: this.endDate,
      duration: this.duration,
      groupSize: this.groupSize,
      pickupLocation: this.pickupLocation,
      dropoffLocation: this.dropoffLocation,
      specialRequests: this.specialRequests,
      totalAmount: this.totalAmount,
      commission: this.commission,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      cancellationReason: this.cancellationReason,
      refundAmount: this.refundAmount,
      rating: this.rating,
      review: this.review,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      user: this.user ? {
        id: this.user.id,
        firstName: this.user.first_name,
        lastName: this.user.last_name,
        email: this.user.email,
        phone: this.user.phone
      } : null,
      guide: this.guide ? {
        id: this.guide.id,
        languages: this.guide.languages,
        specializations: this.guide.specializations,
        hourlyRate: this.guide.hourly_rate,
        rating: this.guide.rating,
        user: this.guide.user ? {
          firstName: this.guide.user.first_name,
          lastName: this.guide.user.last_name,
          profileImage: this.guide.user.profile_image
        } : null
      } : null,
      driver: this.driver ? {
        id: this.driver.id,
        vehicleType: this.driver.vehicle_type,
        vehicleModel: this.driver.vehicle_model,
        rating: this.driver.rating,
        user: this.driver.user ? {
          firstName: this.driver.user.first_name,
          lastName: this.driver.user.last_name,
          profileImage: this.driver.user.profile_image
        } : null
      } : null
    };
  }
}

module.exports = Booking;
