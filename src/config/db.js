const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');

// Set reliable public DNS resolvers to ensure MongoDB SRV record lookup succeeds on Windows/Node.js
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if custom DNS set is restricted
}

const mongooseOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 30000,
  autoIndex: env.NODE_ENV !== 'production',
};

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('[MongoDB] Connected to database successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[MongoDB] Connection disconnected.');
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    console.log('[MongoDB] Connection re-established.');
  });

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, mongooseOptions);
    isConnected = true;
    return conn;
  } catch (error) {
    console.error('[MongoDB] Failed to connect to MongoDB:', error.message);
    throw error;
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
    isConnected = false;
    console.log('[MongoDB] Connection closed gracefully.');
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
