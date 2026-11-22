const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  const sensitiveFields = ['password', 'passwordHash', 'token', 'authorization', 'secret', 'jwt'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
};

const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      meta: sanitizeData(meta),
    }));
  },
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      message,
      meta: sanitizeData(meta),
    }));
  },
  error: (message, error = {}) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: {
        message: error.message || String(error),
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
    }));
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        meta: sanitizeData(meta),
      }));
    }
  },
};

module.exports = logger;
