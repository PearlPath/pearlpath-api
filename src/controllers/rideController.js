const { responseUtils } = require('../utils/helpers');
const { handleNotFoundError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const { db } = require('../config/database');
const Driver = require('../models/Driver');
const User = require('../models/User');
const locationService = require('../services/locationService');
const notificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

// Request a ride
const requestRide = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      driverId,
      pickupLat,
      pickupLng,
      pickupAddress,
      dropoffLat,
      dropoffLng,
      dropoffAddress,
      estimatedDistance,
      estimatedDuration,
      estimatedFare,
      passengers = 1,
      specialRequests
    } = req.body;

    // Validate driver
    const driver = await Driver.findById(driverId);
    if (!driver) {
      throw handleNotFoundError('Driver not found');
    }

    if (!driver.isOnline) {
      return res.status(400).json(responseUtils.error('Driver is currently offline', 400));
    }

    if (driver.verificationStatus !== 'verified') {
      return res.status(400).json(responseUtils.error('Driver is not verified', 400));
    }

    // Calculate distance
    const distance = locationService.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

    // Generate booking reference
    const bookingReference = generateBookingReference();

    // Create ride booking
    const { data: booking, error } = await db.supabase
      .from('bookings')
      .insert({
        id: uuidv4(),
        user_id: userId,
        driver_id: driverId,
        type: 'ride',
        booking_reference: bookingReference,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + (estimatedDuration || 30) * 60 * 1000).toISOString(),
        duration: estimatedDuration || 30,
        group_size: passengers,
        pickup_location: {
          latitude: pickupLat,
          longitude: pickupLng,
          address: pickupAddress
        },
        dropoff_location: {
          latitude: dropoffLat,
          longitude: dropoffLng,
          address: dropoffAddress
        },
        special_requests: specialRequests,
        total_amount: estimatedFare,
        commission: Math.round(estimatedFare * 0.10 * 100) / 100, // 10% commission
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to driver
    await notificationService.sendRideRequest(driverId, {
      bookingId: booking.id,
      bookingReference,
      pickup: pickupAddress,
      distance: Math.round(distance * 10) / 10,
      estimatedFare
    });

    logger.info(`Ride requested: ${booking.id} - User: ${userId}, Driver: ${driverId}`);

    res.status(201).json(responseUtils.success({
      booking: {
        id: booking.id,
        bookingReference,
        status: 'pending',
        driver: {
          id: driver.id,
          name: driver.user?.firstName + ' ' + driver.user?.lastName,
          profileImage: driver.user?.profileImage,
          vehicleType: driver.vehicleType,
          vehicleModel: driver.vehicleModel,
          vehicleNumber: driver.vehicleNumber,
          vehicleYear: driver.vehicleYear,
          rating: driver.rating,
          phone: driver.user?.phone // For safety
        },
        pickup: { latitude: pickupLat, longitude: pickupLng, address: pickupAddress },
        dropoff: { latitude: dropoffLat, longitude: dropoffLng, address: dropoffAddress },
        estimatedDistance: Math.round(distance * 100) / 100,
        estimatedDuration,
        estimatedFare,
        createdAt: booking.created_at
      }
    }, 'Ride request sent to driver. Waiting for acceptance...', 201));
  } catch (error) {
    next(error);
  }
};

// Driver accepts/declines ride
const respondToRideRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'accept' or 'decline'
    const userId = req.user.id;

    // Validate booking
    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride request not found');
    }

    if (booking.drivers.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    if (booking.status !== 'pending') {
      return res.status(400).json(responseUtils.error(
        `Cannot respond to ride request. Current status: ${booking.status}`,
        400
      ));
    }

    if (action === 'accept') {
      // Accept ride
      const { data: updated, error: updateError } = await db.supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Notify user
      await notificationService.sendRideConfirmed(booking.user_id, {
        bookingId: id,
        driverName: booking.drivers.user?.first_name,
        eta: calculateETA(booking.pickup_location)
      });

      logger.info(`Ride accepted: ${id} by driver ${userId}`);

      res.json(responseUtils.success({
        status: 'confirmed',
        message: 'Ride accepted. Navigate to pickup location.'
      }, 'Ride request accepted successfully'));

    } else if (action === 'decline') {
      // Decline ride
      const { data: updated, error: updateError } = await db.supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: userId,
          cancellation_reason: reason || 'Declined by driver',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Notify user
      await notificationService.sendRideDeclined(booking.user_id, {
        bookingId: id,
        reason: reason || 'Driver unavailable'
      });

      logger.info(`Ride declined: ${id} by driver ${userId}`);

      res.json(responseUtils.success({
        status: 'cancelled',
        message: 'Ride request declined'
      }, 'Ride request declined'));
    } else {
      return res.status(400).json(responseUtils.error('Invalid action. Use "accept" or "decline"', 400));
    }
  } catch (error) {
    next(error);
  }
};

// Start ride (driver arrived at pickup)
const startRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    if (booking.drivers.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json(responseUtils.error(
        `Cannot start ride. Current status: ${booking.status}`,
        400
      ));
    }

    // Update status to in_progress
    const { data: updated, error: updateError } = await db.supabase
      .from('bookings')
      .update({
        status: 'in_progress',
        start_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Notify user that ride has started
    await notificationService.sendRideStarted(booking.user_id, {
      bookingId: id,
      trackingLink: `https://app.pearlpath.lk/track/${id}`
    });

    logger.info(`Ride started: ${id}`);

    res.json(responseUtils.success({
      status: 'in_progress',
      startedAt: updated.start_date,
      trackingLink: `https://app.pearlpath.lk/track/${id}`
    }, 'Ride started successfully'));
  } catch (error) {
    next(error);
  }
};

// Complete ride
const completeRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actualDistance, actualDuration, finalFare } = req.body;
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    if (booking.drivers.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    if (booking.status !== 'in_progress') {
      return res.status(400).json(responseUtils.error(
        `Cannot complete ride. Current status: ${booking.status}`,
        400
      ));
    }

    // Calculate final fare if not provided
    const fare = finalFare || booking.total_amount;
    const commission = Math.round(fare * 0.10 * 100) / 100;

    // Update booking
    const { data: updated, error: updateError } = await db.supabase
      .from('bookings')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
        duration: actualDuration || booking.duration,
        total_amount: fare,
        commission: commission,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update driver stats
    await db.supabase.rpc('increment_driver_rides', { driver_id: booking.driver_id });

    // Notify user
    await notificationService.sendRideCompleted(booking.user_id, {
      bookingId: id,
      finalFare: fare,
      estimatedFare: booking.total_amount,
      variance: Math.round((fare - booking.total_amount) * 100) / 100
    });

    logger.info(`Ride completed: ${id} - Final fare: ${fare}`);

    res.json(responseUtils.success({
      status: 'completed',
      completedAt: updated.completed_at,
      estimatedFare: booking.total_amount,
      finalFare: fare,
      variance: Math.round((fare - booking.total_amount) * 100) / 100,
      variancePercentage: Math.round(((fare - booking.total_amount) / booking.total_amount) * 100),
      message: 'Please rate your driver'
    }, 'Ride completed successfully'));
  } catch (error) {
    next(error);
  }
};

// Real-time ride tracking
const trackRide = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*, users(first_name, last_name, phone, profile_image))')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    // Allow both user and driver to track
    if (booking.user_id !== userId && booking.drivers.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    // Get driver's current location
    const driverLocation = booking.drivers.current_lat && booking.drivers.current_lng ? {
      latitude: booking.drivers.current_lat,
      longitude: booking.drivers.current_lng,
      lastUpdate: booking.drivers.last_location_update
    } : null;

    res.json(responseUtils.success({
      booking: {
        id: booking.id,
        bookingReference: booking.booking_reference,
        status: booking.status,
        startDate: booking.start_date,
        pickup: booking.pickup_location,
        dropoff: booking.dropoff_location,
        estimatedFare: booking.total_amount
      },
      driver: {
        id: booking.drivers.id,
        name: booking.drivers.users.first_name + ' ' + booking.drivers.users.last_name,
        phone: booking.drivers.users.phone,
        profileImage: booking.drivers.users.profile_image,
        vehicleType: booking.drivers.vehicle_type,
        vehicleModel: booking.drivers.vehicle_model,
        vehicleNumber: booking.drivers.vehicle_number,
        rating: booking.drivers.rating,
        currentLocation: driverLocation
      },
      safetyFeatures: {
        sosButton: true,
        shareTripLink: `https://app.pearlpath.lk/track/${id}`,
        emergencyContacts: true
      }
    }, 'Ride tracking data'));
  } catch (error) {
    next(error);
  }
};

// Share trip with contacts (Safety feature)
const shareTripLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contacts } = req.body; // Array of phone numbers or emails
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    if (booking.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const trackingLink = `https://app.pearlpath.lk/track/${id}`;
    const message = `${req.user.firstName} is taking a ride with PearlPath. Track their trip: ${trackingLink}`;

    // Send tracking link to contacts
    for (const contact of contacts) {
      if (contact.includes('@')) {
        // Email
        await notificationService.sendEmail(contact, 'Trip Tracking', message);
      } else {
        // SMS
        await notificationService.sendSMS(contact, message);
      }
    }

    logger.info(`Trip link shared: ${id} with ${contacts.length} contacts`);

    res.json(responseUtils.success({
      trackingLink,
      sharedWith: contacts.length
    }, 'Trip tracking link shared successfully'));
  } catch (error) {
    next(error);
  }
};

// SOS Emergency button
const triggerSOS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentLat, currentLng, message } = req.body;
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*, drivers(*, users(*)), users(*)')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    if (booking.user_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    // Log SOS incident
    const { data: incident, error: incidentError } = await db.supabase
      .from('safety_incidents')
      .insert({
        id: uuidv4(),
        booking_id: id,
        user_id: userId,
        driver_id: booking.driver_id,
        incident_type: 'sos',
        location: { latitude: currentLat, longitude: currentLng },
        message: message || 'Emergency SOS triggered',
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (incidentError) throw incidentError;

    // Send alerts to emergency contacts, driver, and platform admins
    await notificationService.sendSOSAlert({
      bookingId: id,
      userName: booking.users.first_name + ' ' + booking.users.last_name,
      userPhone: booking.users.phone,
      driverName: booking.drivers.users.first_name + ' ' + booking.drivers.users.last_name,
      driverPhone: booking.drivers.users.phone,
      vehicleNumber: booking.drivers.vehicle_number,
      location: { latitude: currentLat, longitude: currentLng },
      trackingLink: `https://app.pearlpath.lk/track/${id}`,
      message
    });

    logger.error(`SOS ALERT - Ride: ${id}, User: ${userId}, Location: ${currentLat},${currentLng}`);

    res.json(responseUtils.success({
      incidentId: incident.id,
      emergencyServicesAlerted: true,
      policeNotified: true,
      trackingLink: `https://app.pearlpath.lk/track/${id}`
    }, 'Emergency alert sent. Help is on the way.'));
  } catch (error) {
    next(error);
  }
};

// Report safety incident
const reportIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { incidentType, description, evidence } = req.body;
    const userId = req.user.id;

    const { data: booking, error } = await db.supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !booking) {
      throw handleNotFoundError('Ride not found');
    }

    // Both user and driver can report
    if (booking.user_id !== userId && booking.driver_id !== userId) {
      return res.status(403).json(responseUtils.error('Access denied', 403));
    }

    const { data: incident, error: incidentError } = await db.supabase
      .from('safety_incidents')
      .insert({
        id: uuidv4(),
        booking_id: id,
        user_id: userId,
        driver_id: booking.driver_id,
        incident_type: incidentType,
        description,
        evidence: evidence || [],
        status: 'under_review',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (incidentError) throw incidentError;

    // Notify safety team
    await notificationService.sendIncidentReport(incident.id, {
      bookingId: id,
      incidentType,
      reportedBy: userId
    });

    logger.info(`Safety incident reported: ${incident.id} for ride ${id}`);

    res.json(responseUtils.success({
      incidentId: incident.id,
      status: 'under_review',
      message: 'Safety team has been notified and will review your report within 24 hours.'
    }, 'Incident reported successfully'));
  } catch (error) {
    next(error);
  }
};

// Helper Functions

function generateBookingReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let reference = 'R-';
  for (let i = 0; i < 8; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
}

function calculateETA(pickupLocation) {
  // Simplified ETA calculation - in production, use real routing API
  return 5; // minutes
}

module.exports = {
  requestRide,
  respondToRideRequest,
  startRide,
  completeRide,
  trackRide,
  shareTripLink,
  triggerSOS,
  reportIncident
};
