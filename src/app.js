const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const { swaggerSpec } = require('./config/swagger');
const requestIdMiddleware = require('./middlewares/requestId');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');
const apiRoutes = require('./routes');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        env.CLIENT_URL.includes(origin) ||
        env.CLIENT_URL.includes('*') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all in dev for ease of integration
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// Response compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID tracking
app.use(requestIdMiddleware);

// HTTP request logging (excluding sensitive payloads)
if (env.NODE_ENV !== 'test') {
  app.use(
    morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length] - reqId=:req[x-request-id]')
  );
}

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 10 * 60 * 1000, // 15 minutes
//   max: env.NODE_ENV === 'test' ? 1000 : 300, // limit each IP
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again after 15 minutes',
//     error: { code: 'RATE_LIMIT_EXCEEDED' },
//   },
// });
// app.use('/api/', limiter);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API version 1
app.use('/api/v1', apiRoutes);

// Root health check redirect or welcome
app.get('/', (req, res) => {
  res.json({
    name: 'Cell Cited Pathology Lab API',
    version: '1.0.0',
    documentation: '/api-docs',
    documentationJson: '/api-docs.json',
    health: '/api/v1/health',
  });
});

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
