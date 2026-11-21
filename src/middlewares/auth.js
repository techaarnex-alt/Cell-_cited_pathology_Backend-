const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication token is required', ERROR_CODES.UNAUTHORIZED));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Token has expired, please log in again', ERROR_CODES.UNAUTHORIZED));
      }
      return next(ApiError.unauthorized('Invalid authentication token', ERROR_CODES.UNAUTHORIZED));
    }

    const user = await User.findById(decoded.id).select('+password');
    if (!user || !user.isActive) {
      return next(ApiError.unauthorized('User account not found or deactivated', ERROR_CODES.UNAUTHORIZED));
    }

    req.user = user;
    req.laboratoryId = user.laboratoryId;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User not authenticated'));
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `User with role '${req.user.role}' is not authorized to access this resource`,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize,
};
