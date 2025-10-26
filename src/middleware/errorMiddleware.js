const logger = require('../utils/logger');

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Supabase errors
  if (err.code && err.code.startsWith('PGRST')) {
    switch (err.code) {
      case 'PGRST116':
        error = { message: 'Resource not found', statusCode: 404 };
        break;
      case 'PGRST301':
        error = { message: 'Duplicate entry', statusCode: 409 };
        break;
      case 'PGRST302':
        error = { message: 'Invalid input', statusCode: 400 };
        break;
      default:
        error = { message: 'Database error', statusCode: 500 };
    }
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = { message: 'File too large', statusCode: 413 };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = { message: 'Unexpected file field', statusCode: 400 };
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    error = { 
      message: 'Too many requests, please try again later', 
      statusCode: 429 
    };
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error handler
const handleValidationError = (errors) => {
  const error = new AppError('Validation failed', 400);
  error.errors = errors;
  return error;
};

// Authorization error handler
const handleAuthError = (message = 'Unauthorized') => {
  return new AppError(message, 401);
};

// Forbidden error handler
const handleForbiddenError = (message = 'Forbidden') => {
  return new AppError(message, 403);
};

// Not found error handler
const handleNotFoundError = (message = 'Resource not found') => {
  return new AppError(message, 404);
};

// Conflict error handler
const handleConflictError = (message = 'Resource already exists') => {
  return new AppError(message, 409);
};

// Unprocessable entity error handler
const handleUnprocessableError = (message = 'Unprocessable entity') => {
  return new AppError(message, 422);
};

// Too many requests error handler
const handleRateLimitError = (message = 'Too many requests') => {
  return new AppError(message, 429);
};

// Internal server error handler
const handleInternalError = (message = 'Internal server error') => {
  return new AppError(message, 500);
};

// Service unavailable error handler
const handleServiceUnavailableError = (message = 'Service unavailable') => {
  return new AppError(message, 503);
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  AppError,
  handleValidationError,
  handleAuthError,
  handleForbiddenError,
  handleNotFoundError,
  handleConflictError,
  handleUnprocessableError,
  handleRateLimitError,
  handleInternalError,
  handleServiceUnavailableError
};
