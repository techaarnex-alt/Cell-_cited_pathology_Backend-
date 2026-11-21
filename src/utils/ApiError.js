const ERROR_CODES = require('../constants/errorCodes');

class ApiError extends Error {
  constructor(statusCode, message, code = ERROR_CODES.BAD_REQUEST, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null, code = ERROR_CODES.BAD_REQUEST) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Unauthorized access', code = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'Forbidden action', code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message = 'Resource conflict or duplicate entry', code = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static internal(message = 'Internal server error', code = ERROR_CODES.INTERNAL_SERVER_ERROR) {
    return new ApiError(500, message, code);
  }
}

module.exports = ApiError;
