const { db } = require('../config/database');
const logger = require('../utils/logger');

class NotificationService {
  async createNotification(userId, type, title, message, data = null) {
    try {
      const notification = {
        id: require('uuid').v4(),
        user_id: userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
        is_read: false,
        created_at: new Date().toISOString()
      };

      // This would typically insert into the notifications table
      // For now, we'll just log it
      logger.info(`Notification created for user ${userId}: ${title}`);

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  async sendBookingNotification(booking, type) {
    const notifications = [];

    // Notify the user
    let userTitle, userMessage;
    switch (type) {
      case 'confirmed':
        userTitle = 'Booking Confirmed';
        userMessage = `Your booking ${booking.bookingReference} has been confirmed`;
        break;
      case 'started':
        userTitle = 'Booking Started';
        userMessage = `Your booking ${booking.bookingReference} has started`;
        break;
      case 'completed':
        userTitle = 'Booking Completed';
        userMessage = `Your booking ${booking.bookingReference} has been completed`;
        break;
      case 'cancelled':
        userTitle = 'Booking Cancelled';
        userMessage = `Your booking ${booking.bookingReference} has been cancelled`;
        break;
    }

    notifications.push(
      await this.createNotification(
        booking.userId,
        'booking',
        userTitle,
        userMessage,
        { bookingId: booking.id, type }
      )
    );

    // Notify the guide if applicable
    if (booking.guideId) {
      let guideTitle, guideMessage;
      switch (type) {
        case 'confirmed':
          guideTitle = 'New Booking Confirmed';
          guideMessage = `You have a new confirmed booking: ${booking.bookingReference}`;
          break;
        case 'cancelled':
          guideTitle = 'Booking Cancelled';
          guideMessage = `Booking ${booking.bookingReference} has been cancelled`;
          break;
      }

      if (guideTitle) {
        notifications.push(
          await this.createNotification(
            booking.guideId,
            'booking',
            guideTitle,
            guideMessage,
            { bookingId: booking.id, type }
          )
        );
      }
    }

    // Notify the driver if applicable
    if (booking.driverId) {
      let driverTitle, driverMessage;
      switch (type) {
        case 'confirmed':
          driverTitle = 'New Booking Confirmed';
          driverMessage = `You have a new confirmed booking: ${booking.bookingReference}`;
          break;
        case 'cancelled':
          driverTitle = 'Booking Cancelled';
          driverMessage = `Booking ${booking.bookingReference} has been cancelled`;
          break;
      }

      if (driverTitle) {
        notifications.push(
          await this.createNotification(
            booking.driverId,
            'booking',
            driverTitle,
            driverMessage,
            { bookingId: booking.id, type }
          )
        );
      }
    }

    return notifications;
  }

  async sendVerificationNotification(userId, type, status) {
    let title, message;
    
    switch (type) {
      case 'email':
        title = status === 'verified' ? 'Email Verified' : 'Email Verification Required';
        message = status === 'verified' 
          ? 'Your email has been successfully verified'
          : 'Please verify your email address to access all features';
        break;
      case 'phone':
        title = status === 'verified' ? 'Phone Verified' : 'Phone Verification Required';
        message = status === 'verified'
          ? 'Your phone number has been successfully verified'
          : 'Please verify your phone number to access all features';
        break;
      case 'kyc':
        title = status === 'verified' ? 'KYC Verified' : 'KYC Verification Required';
        message = status === 'verified'
          ? 'Your identity has been verified. You now have access to professional features'
          : 'Please complete your KYC verification to access professional features';
        break;
    }

    return this.createNotification(
      userId,
      'verification',
      title,
      message,
      { type, status }
    );
  }

  async sendCommunityUpdateNotification(updateId, type) {
    // This would typically notify users who are interested in the area
    // For now, we'll just log it
    logger.info(`Community update notification: ${updateId} - ${type}`);
  }

  async sendEventNotification(eventId, type) {
    // This would typically notify users who are interested in events
    // For now, we'll just log it
    logger.info(`Event notification: ${eventId} - ${type}`);
  }

  async sendSafetyAlertNotification(alert) {
    // This would typically notify all users in the affected area
    // For now, we'll just log it
    logger.info(`Safety alert notification: ${alert.title}`);
  }

  async getUserNotifications(userId, limit = 20, offset = 0) {
    try {
      // This would typically query the notifications table
      // For now, returning a placeholder response
      const notifications = [];

      return {
        notifications,
        total: notifications.length,
        pagination: {
          limit,
          offset,
          hasMore: false
        }
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      // This would typically update the notification status
      // For now, we'll just log it
      logger.info(`Notification marked as read: ${notificationId} for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      // This would typically update all notifications for the user
      // For now, we'll just log it
      logger.info(`All notifications marked as read for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      // This would typically count unread notifications
      // For now, returning 0
      return 0;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
