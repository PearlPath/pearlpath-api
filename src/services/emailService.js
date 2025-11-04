const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { google } = require('googleapis');

class EmailService {
  constructor() {
    // Configure for Google OAuth 2.0 or App Password
    const useOAuth = process.env.SMTP_USE_OAUTH === 'true';
    
    if (useOAuth && process.env.SMTP_CLIENT_ID && process.env.SMTP_CLIENT_SECRET && process.env.SMTP_REFRESH_TOKEN) {
      this.transporter = this.createOAuthTransporter();
    } else {
      // Use App Password for Gmail
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS, // Use Gmail App Password here
        },
      });
    }
  }

  createOAuthTransporter() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.SMTP_CLIENT_ID,
      process.env.SMTP_CLIENT_SECRET,
      process.env.SMTP_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.SMTP_REFRESH_TOKEN,
    });

    return nodemailer.createTransporter({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        type: 'OAuth2',
        user: process.env.SMTP_USER,
        clientId: process.env.SMTP_CLIENT_ID,
        clientSecret: process.env.SMTP_CLIENT_SECRET,
        refreshToken: process.env.SMTP_REFRESH_TOKEN,
        accessToken: async () => {
          try {
            const { token } = await oauth2Client.getAccessToken();
            return token;
          } catch (error) {
            logger.error('Error getting OAuth access token:', error);
            throw error;
          }
        },
      },
    });
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"PearlPath" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to PearlPath - Sri Lanka Smart Travel Platform';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Welcome to PearlPath!</h2>
        <p>Dear ${user.firstName},</p>
        <p>Welcome to PearlPath, Sri Lanka's premier smart travel platform! We're excited to have you join our community of travelers and local experts.</p>
        
        <h3>What you can do:</h3>
        <ul>
          <li>Discover verified local guides and drivers</li>
          <li>Explore points of interest with real-time updates</li>
          <li>Book tours and transportation seamlessly</li>
          <li>Connect with the local community</li>
        </ul>
        
        <p>Start your journey by downloading our mobile app or visiting our website.</p>
        
        <p>Best regards,<br>The PearlPath Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendVerificationEmail(user, token) {
    const subject = 'Verify Your Email - PearlPath';
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Verify Your Email Address</h2>
        <p>Dear ${user.firstName},</p>
        <p>Please click the button below to verify your email address:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        
        <p>This link will expire in 24 hours.</p>
        
        <p>Best regards,<br>The PearlPath Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendPasswordResetEmail(user, token) {
    const subject = 'Reset Your Password - PearlPath';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Reset Your Password</h2>
        <p>Dear ${user.firstName},</p>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        
        <p>This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
        
        <p>Best regards,<br>The PearlPath Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendBookingConfirmationEmail(booking) {
    const subject = 'Booking Confirmed - PearlPath';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Booking Confirmed!</h2>
        <p>Dear ${booking.user.firstName},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Reference:</strong> ${booking.bookingReference}</p>
          <p><strong>Type:</strong> ${booking.type}</p>
          <p><strong>Date:</strong> ${new Date(booking.startDate).toLocaleDateString()}</p>
          <p><strong>Duration:</strong> ${booking.duration} hours</p>
          <p><strong>Total Amount:</strong> LKR ${booking.totalAmount}</p>
        </div>
        
        <p>We'll send you a reminder before your booking starts.</p>
        
        <p>Best regards,<br>The PearlPath Team</p>
      </div>
    `;

    return this.sendEmail(booking.user.email, subject, html);
  }

  async sendBookingReminderEmail(booking) {
    const subject = 'Booking Reminder - PearlPath';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">Booking Reminder</h2>
        <p>Dear ${booking.user.firstName},</p>
        <p>This is a reminder that your booking is scheduled to start soon:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Reference:</strong> ${booking.bookingReference}</p>
          <p><strong>Start Time:</strong> ${new Date(booking.startDate).toLocaleString()}</p>
          <p><strong>Duration:</strong> ${booking.duration} hours</p>
        </div>
        
        <p>Please ensure you're ready for your booking. Contact your guide/driver if you have any questions.</p>
        
        <p>Best regards,<br>The PearlPath Team</p>
      </div>
    `;

    return this.sendEmail(booking.user.email, subject, html);
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();
