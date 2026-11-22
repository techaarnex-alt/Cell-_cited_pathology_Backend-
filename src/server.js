const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { seedInitialData } = require('./utils/seeder');
const logger = require('./utils/logger');

let server;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Auto-seed required default records (laboratory, admin user, curated tests, groups, doctors)
    await seedInitialData();

    server = app.listen(env.PORT, () => {
      logger.info(`[Server] Cell Cited Pathology Lab Backend running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      logger.info(`[Swagger] OpenAPI 3.0 documentation available at http://localhost:${env.PORT}/api-docs`);
      logger.info(`[Swagger] JSON specification available at http://localhost:${env.PORT}/api-docs.json`);
    });
  } catch (error) {
    logger.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
};

const handleShutdown = async (signal) => {
  logger.info(`[Server] Received ${signal}. Commencing graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('[Server] HTTP server closed.');
      await disconnectDB();
      logger.info('[Server] Graceful shutdown complete.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds timeout
    setTimeout(() => {
      logger.warn('[Server] Forcing immediate shutdown after timeout.');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled Rejection at Promise:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('[Server] Uncaught Exception thrown:', error);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
