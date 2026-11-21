const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    if (!schema) return next();

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message.replace(/['"]/g, ''),
        path: detail.path.join('.'),
      }));
      return next(
        new ApiError(400, 'Request validation failed', ERROR_CODES.VALIDATION_ERROR, details)
      );
    }

    req[property] = value;
    next();
  };
};

module.exports = validateRequest;
