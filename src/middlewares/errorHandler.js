const { sendError } = require('../utils/response');
const logger = require('../utils/logger');
const ERROR_CODES = require('../constants/errorCodes');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred';
  let code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let details = err.details || null;

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier: ${err.value}`;
    code = ERROR_CODES.BAD_REQUEST;
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value entered for ${field}: ${err.keyValue ? err.keyValue[field] : ''}`;
    code = ERROR_CODES.CONFLICT;
  }

  // Handle Mongoose schema validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = ERROR_CODES.VALIDATION_ERROR;
    details = Object.values(err.errors).map((item) => ({
      message: item.message,
      path: item.path,
    }));
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    code = ERROR_CODES.UNAUTHORIZED;
  }

  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - Server Error: ${message}`, err);
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} - Client Error (${statusCode}): ${message}`);
  }

  return sendError(res, statusCode, message, {
    code,
    details,
    stack: err.stack,
  });
};

module.exports = errorHandler;
