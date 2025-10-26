const User = require('../models/User');
const { responseUtils, validationUtils, jwtUtils } = require('../utils/helpers');
const { handleAuthError, handleValidationError, handleConflictError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Register new user
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, language, role, dateOfBirth, nationality } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw handleConflictError('User with this email already exists');
    }

    // Check if phone is already registered
    const existingPhone = await User.findByPhone(phone);
    if (existingPhone) {
      throw handleConflictError('User with this phone number already exists');
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      language,
      role,
      dateOfBirth,
      nationality
    });

    // Generate tokens
    const tokens = user.generateTokens();

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json(responseUtils.success({
      user: user.toSafeObject(),
      tokens
    }, 'User registered successfully', 201));
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      throw handleAuthError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw handleAuthError('Invalid email or password');
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw handleAuthError('Account is not active');
    }

    // Update last login
    await user.updateLastLogin();

    // Generate tokens
    const tokens = user.generateTokens();

    logger.info(`User logged in: ${user.email}`);

    res.json(responseUtils.success({
      user: user.toSafeObject(),
      tokens
    }, 'Login successful'));
  } catch (error) {
    next(error);
  }
};

// Refresh access token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw handleAuthError('Refresh token required');
    }

    // Verify refresh token
    const decoded = jwtUtils.verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);

    if (!user || user.status !== 'active') {
      throw handleAuthError('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = user.generateTokens();

    res.json(responseUtils.success({
      tokens
    }, 'Token refreshed successfully'));
  } catch (error) {
    next(error);
  }
};

// Get current user profile
const getProfile = async (req, res, next) => {
  try {
    const user = req.user;
    res.json(responseUtils.success({
      user: user.toSafeObject()
    }, 'Profile retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

// Update user profile
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated through this endpoint
    delete updates.password;
    delete updates.email;
    delete updates.role;
    delete updates.verificationTier;
    delete updates.status;

    const updatedUser = await req.user.update(updates);

    logger.info(`User profile updated: ${updatedUser.email}`);

    res.json(responseUtils.success({
      user: updatedUser.toSafeObject()
    }, 'Profile updated successfully'));
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Verify current password
    const isCurrentPasswordValid = await user.verifyPassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw handleAuthError('Current password is incorrect');
    }

    // Update password
    await user.update({ password: newPassword });

    logger.info(`Password changed for user: ${user.email}`);

    res.json(responseUtils.success(null, 'Password changed successfully'));
  } catch (error) {
    next(error);
  }
};

// Logout user
const logout = async (req, res, next) => {
  try {
    // In a real implementation, you would invalidate the token
    // For now, we'll just return success
    logger.info(`User logged out: ${req.user.email}`);

    res.json(responseUtils.success(null, 'Logout successful'));
  } catch (error) {
    next(error);
  }
};

// Delete user account
const deleteAccount = async (req, res, next) => {
  try {
    const user = req.user;
    const { password } = req.body;

    // Verify password before deletion
    const isPasswordValid = await user.verifyPassword(password);
    if (!isPasswordValid) {
      throw handleAuthError('Password is incorrect');
    }

    // Delete user account
    await user.delete();

    logger.info(`User account deleted: ${user.email}`);

    res.json(responseUtils.success(null, 'Account deleted successfully'));
  } catch (error) {
    next(error);
  }
};

// Verify email
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // In a real implementation, you would verify the email token
    // For now, we'll just mark the email as verified
    await req.user.verifyEmail();

    logger.info(`Email verified for user: ${req.user.email}`);

    res.json(responseUtils.success(null, 'Email verified successfully'));
  } catch (error) {
    next(error);
  }
};

// Resend email verification
const resendEmailVerification = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.isEmailVerified) {
      return res.status(400).json(responseUtils.error('Email is already verified', 400));
    }

    // In a real implementation, you would send verification email
    logger.info(`Email verification resent for user: ${user.email}`);

    res.json(responseUtils.success(null, 'Verification email sent'));
  } catch (error) {
    next(error);
  }
};

// Forgot password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return res.json(responseUtils.success(null, 'If email exists, password reset instructions have been sent'));
    }

    // In a real implementation, you would generate reset token and send email
    logger.info(`Password reset requested for user: ${user.email}`);

    res.json(responseUtils.success(null, 'If email exists, password reset instructions have been sent'));
  } catch (error) {
    next(error);
  }
};

// Reset password
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // In a real implementation, you would verify the reset token
    // For now, we'll just update the password
    const user = await User.findById(req.user.id);
    await user.update({ password: newPassword });

    logger.info(`Password reset for user: ${user.email}`);

    res.json(responseUtils.success(null, 'Password reset successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  deleteAccount,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword
};
