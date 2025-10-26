const { db } = require('../config/database');
const { passwordUtils, jwtUtils, validationUtils } = require('../utils/helpers');
const logger = require('../utils/logger');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.phone = data.phone;
    this.language = data.language;
    this.role = data.role;
    this.verificationTier = data.verification_tier;
    this.status = data.status;
    this.profileImage = data.profile_image;
    this.bio = data.bio;
    this.dateOfBirth = data.date_of_birth;
    this.nationality = data.nationality;
    this.isEmailVerified = data.is_email_verified;
    this.isPhoneVerified = data.is_phone_verified;
    this.lastLoginAt = data.last_login_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new user
  static async create(userData) {
    try {
      // Hash password
      const hashedPassword = await passwordUtils.hash(userData.password);
      
      const user = {
        id: require('uuid').v4(),
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone,
        language: userData.language,
        role: userData.role || 'tourist',
        verification_tier: 1,
        status: 'active',
        is_email_verified: false,
        is_phone_verified: false,
        date_of_birth: userData.dateOfBirth,
        nationality: userData.nationality,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdUser = await db.users.create(user);
      return new User(createdUser);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      const user = await db.users.findById(id);
      return user ? new User(user) : null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const user = await db.users.findByEmail(email.toLowerCase());
      return user ? new User(user) : null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by phone
  static async findByPhone(phone) {
    try {
      const user = await db.users.findByPhone(phone);
      return user ? new User(user) : null;
    } catch (error) {
      logger.error('Error finding user by phone:', error);
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    try {
      const updates = {
        ...updateData,
        updated_at: new Date().toISOString()
      };

      // Hash password if it's being updated
      if (updateData.password) {
        updates.password = await passwordUtils.hash(updateData.password);
      }

      const updatedUser = await db.users.update(this.id, updates);
      return new User(updatedUser);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  // Delete user
  async delete() {
    try {
      await db.users.delete(this.id);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  // Verify password
  async verifyPassword(password) {
    try {
      const user = await db.users.findById(this.id);
      return await passwordUtils.compare(password, user.password);
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw error;
    }
  }

  // Generate JWT tokens
  generateTokens() {
    const payload = {
      id: this.id,
      email: this.email,
      role: this.role,
      verificationTier: this.verificationTier
    };

    return jwtUtils.generateTokens(payload);
  }

  // Update last login
  async updateLastLogin() {
    try {
      await db.users.update(this.id, {
        last_login_at: new Date().toISOString()
      });
      this.lastLoginAt = new Date().toISOString();
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  // Verify email
  async verifyEmail() {
    try {
      await db.users.update(this.id, {
        is_email_verified: true,
        updated_at: new Date().toISOString()
      });
      this.isEmailVerified = true;
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  // Verify phone
  async verifyPhone() {
    try {
      await db.users.update(this.id, {
        is_phone_verified: true,
        updated_at: new Date().toISOString()
      });
      this.isPhoneVerified = true;
    } catch (error) {
      logger.error('Error verifying phone:', error);
      throw error;
    }
  }

  // Upgrade verification tier
  async upgradeVerificationTier(tier) {
    try {
      if (tier > this.verificationTier && tier <= 3) {
        await db.users.update(this.id, {
          verification_tier: tier,
          updated_at: new Date().toISOString()
        });
        this.verificationTier = tier;
      }
    } catch (error) {
      logger.error('Error upgrading verification tier:', error);
      throw error;
    }
  }

  // Get safe user data (without sensitive information)
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone,
      language: this.language,
      role: this.role,
      verificationTier: this.verificationTier,
      status: this.status,
      profileImage: this.profileImage,
      bio: this.bio,
      dateOfBirth: this.dateOfBirth,
      nationality: this.nationality,
      isEmailVerified: this.isEmailVerified,
      isPhoneVerified: this.isPhoneVerified,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Get full name
  getFullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  // Check if user is verified
  isVerified() {
    return this.verificationTier >= 2;
  }

  // Check if user is professional (guide or driver)
  isProfessional() {
    return ['guide', 'driver'].includes(this.role);
  }

  // Check if user can create content
  canCreateContent() {
    return this.verificationTier >= 2 && this.status === 'active';
  }

  // Check if user can moderate content
  canModerate() {
    return ['moderator', 'admin'].includes(this.role);
  }
}

module.exports = User;
