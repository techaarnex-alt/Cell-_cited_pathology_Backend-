const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const User = require('../models/User');
const Laboratory = require('../models/Laboratory');
const { logAuditEvent } = require('./audit.service');

const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
      laboratoryId: user.laboratoryId,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );
};

const login = async (username, password, req = null) => {
  const user = await User.findOne({ username: username.toLowerCase().trim() })
    .select('+password')
    .populate('laboratoryId');

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Invalid username or password', ERROR_CODES.AUTHENTICATION_ERROR);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid username or password', ERROR_CODES.AUTHENTICATION_ERROR);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);

  await logAuditEvent({
    laboratoryId: user.laboratoryId._id || user.laboratoryId,
    actorId: user._id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user._id,
    action: 'LOGIN',
    req,
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      laboratory: user.laboratoryId,
    },
    token,
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId)
    .populate('laboratoryId')
    .lean();

  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found or deactivated');
  }

  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    laboratory: user.laboratoryId,
  };
};

module.exports = {
  login,
  getMe,
  signToken,
};
