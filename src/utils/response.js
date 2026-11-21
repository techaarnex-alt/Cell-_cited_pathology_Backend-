/**
 * Standard API Response Utilities
 */

const sendSuccess = (res, statusCode = 200, message = 'Operation successful', data = {}, extraMeta = {}) => {
  const requestId = res.req?.id || res.locals?.requestId || 'req-unknown';
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: {
      requestId,
      ...extraMeta,
    },
  });
};

const sendError = (res, statusCode = 400, message = 'Operation failed', error = {}, extraMeta = {}) => {
  const requestId = res.req?.id || res.locals?.requestId || 'req-unknown';
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: error.code || 'ERROR',
      ...(error.details ? { details: error.details } : {}),
      ...(process.env.NODE_ENV === 'development' && error.stack ? { stack: error.stack } : {}),
    },
    meta: {
      requestId,
      ...extraMeta,
    },
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
