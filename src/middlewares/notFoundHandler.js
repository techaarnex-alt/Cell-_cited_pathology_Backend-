const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const notFoundHandler = (req, res, next) => {
  next(
    new ApiError(
      404,
      `Cannot find endpoint ${req.method} ${req.originalUrl} on this server`,
      ERROR_CODES.NOT_FOUND
    )
  );
};

module.exports = notFoundHandler;
