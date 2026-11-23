const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const User = require('../models/User');
const Laboratory = require('../models/Laboratory');
const { logAuditEvent } = require('./audit.service');
const emailService = require('./email.service');

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
  const clean = String(username || '').toLowerCase().trim();
  const query = clean.includes('@')
    ? { email: clean }
    : { $or: [{ username: clean }, { email: clean }] };

  const user = await User.findOne(query)
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

const forgetPassword = async ({ email, username }, req = null) => {
  const query = {};
  if (email) {
    query.email = email.toLowerCase().trim();
  } else if (username) {
    query.username = username.toLowerCase().trim();
  }

  const user = await User.findOne(query).select('+password +resetPasswordOtp +resetPasswordExpires');

  if (!user || !user.isActive) {
    throw ApiError.notFound('No active account found with the provided details', ERROR_CODES.NOT_FOUND);
  }

  if (!user.email) {
    throw ApiError.badRequest('No registered email address found for this account. Please contact laboratory administrator.');
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  user.resetPasswordOtp = hashedOtp;
  user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  await user.save();

  // Send OTP email via EmailJS
  const emailResult = await emailService.sendOtpEmail({
    toEmail: user.email,
    toName: user.name,
    otp,
  });

  await logAuditEvent({
    laboratoryId: user.laboratoryId,
    actorId: user._id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user._id,
    action: 'FORGOT_PASSWORD_OTP_REQUESTED',
    req,
  });

  // Mask email for privacy (e.g. a***n@cellcited.com)
  const [localPart, domain] = user.email.split('@');
  const maskedLocal = localPart.length <= 2
    ? localPart[0] + '*'
    : localPart[0] + '*'.repeat(Math.max(1, localPart.length - 2)) + localPart.slice(-1);
  const maskedEmail = `${maskedLocal}@${domain}`;

  return {
    email: maskedEmail,
    expiresIn: '10 minutes',
    emailSent: emailResult.sent,
    ...(emailResult.devMode && emailResult.otp ? { devOtp: emailResult.otp } : {}),
    note: emailResult.devMode ? 'EmailJS credentials not configured or running in dev mode. OTP has been logged to backend console.' : undefined,
  };
};

const resetPassword = async ({ email, username, otp, newPassword }, req = null) => {
  const query = {};
  if (email) {
    query.email = email.toLowerCase().trim();
  } else if (username) {
    query.username = username.toLowerCase().trim();
  }

  const user = await User.findOne(query).select('+password +resetPasswordOtp +resetPasswordExpires');

  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found or account is deactivated', ERROR_CODES.NOT_FOUND);
  }

  if (!user.resetPasswordOtp || !user.resetPasswordExpires) {
    throw ApiError.badRequest('No active password reset request found for this account. Please request a new OTP first.', null, ERROR_CODES.BAD_REQUEST);
  }

  if (new Date() > user.resetPasswordExpires) {
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    throw ApiError.badRequest('The OTP has expired. Please request a new OTP.', null, ERROR_CODES.OTP_EXPIRED);
  }

  const hashedInput = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
  const isMatch = user.resetPasswordOtp === hashedInput || user.resetPasswordOtp === String(otp).trim();

  if (!isMatch) {
    throw ApiError.badRequest('Invalid OTP. Please check the OTP sent to your email.', null, ERROR_CODES.INVALID_OTP);
  }

  // Update password (User model pre-save hook will hash with bcrypt)
  user.password = newPassword;
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await logAuditEvent({
    laboratoryId: user.laboratoryId,
    actorId: user._id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user._id,
    action: 'PASSWORD_RESET_COMPLETED',
    req,
  });

  return {
    userId: user._id,
    username: user.username,
    email: user.email,
  };
};

const resetPasswordLoggedIn = async ({ authHeader, oldPassword, newPassword, confirmPassword, reqUser }, req = null) => {
  let user = reqUser;

  // 1. Check and verify token if user not already attached to req
  if (!user) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token is required to reset password for logged-in user', ERROR_CODES.UNAUTHORIZED);
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Session has expired, please log in again', ERROR_CODES.UNAUTHORIZED);
      }
      throw ApiError.unauthorized('Invalid authentication token', ERROR_CODES.UNAUTHORIZED);
    }
    user = await User.findById(decoded.id).select('+password');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User account not found or deactivated', ERROR_CODES.UNAUTHORIZED);
    }
  } else {
    if (!user.password) {
      user = await User.findById(user._id).select('+password');
    }
  }

  // 2. Validate input fields
  if (!oldPassword) {
    throw ApiError.badRequest('Old password is required', null, ERROR_CODES.BAD_REQUEST);
  }

  if (!newPassword || newPassword.length < 6) {
    throw ApiError.badRequest('New password must be at least 6 characters long', null, ERROR_CODES.BAD_REQUEST);
  }

  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    throw ApiError.badRequest('New password and confirm password do not match', null, ERROR_CODES.BAD_REQUEST);
  }

  // 3. Check old password is correct or not using bcrypt compare
  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    throw ApiError.badRequest('Incorrect old password. Please enter your correct current password.', null, ERROR_CODES.BAD_REQUEST);
  }

  // 4. Update to new password
  user.password = newPassword;
  user.resetPasswordOtp = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await logAuditEvent({
    laboratoryId: user.laboratoryId,
    actorId: user._id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user._id,
    action: 'PASSWORD_RESET_COMPLETED',
    req,
  });

  return {
    userId: user._id,
    username: user.username,
    email: user.email,
  };
};

const updateProfile = async (userId, updateData, req = null) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw ApiError.notFound('User not found or account is deactivated');
  }

  // 1. Update user fields
  const newName = updateData.name !== undefined ? updateData.name : updateData.fullName;
  if (newName !== undefined && String(newName).trim()) {
    user.name = String(newName).trim();
  }

  if (updateData.username !== undefined && String(updateData.username).trim()) {
    const cleanUsername = String(updateData.username).toLowerCase().trim();
    if (cleanUsername !== user.username) {
      const existingUser = await User.findOne({
        username: cleanUsername,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        throw ApiError.badRequest('Username is already taken by another account');
      }
      user.username = cleanUsername;
    }
  }

  if (updateData.email !== undefined && String(updateData.email).trim()) {
    user.email = String(updateData.email).toLowerCase().trim();
  }

  await user.save();

  // 2. Update laboratory fields if user is linked to a laboratory
  let laboratory = null;
  if (user.laboratoryId) {
    laboratory = await Laboratory.findById(user.laboratoryId);
    if (laboratory) {
      if (updateData.address !== undefined) {
        laboratory.address = String(updateData.address).trim();
      }
      if (updateData.authorisedSignatory !== undefined) {
        laboratory.authorisedSignatory = String(updateData.authorisedSignatory).trim();
      }

      const rawPhones =
        updateData.phones !== undefined
          ? updateData.phones
          : (updateData.phoneNumber !== undefined ? updateData.phoneNumber : updateData.phone);

      if (rawPhones !== undefined) {
        if (Array.isArray(rawPhones)) {
          laboratory.phones = rawPhones.map((p) => String(p).trim()).filter(Boolean);
        } else if (typeof rawPhones === 'string') {
          laboratory.phones = rawPhones
            .split(/[,;\n]+/)
            .map((p) => p.trim())
            .filter(Boolean);
        }
      }

      if (updateData.email !== undefined && String(updateData.email).trim()) {
        laboratory.email = String(updateData.email).toLowerCase().trim();
      }

      await laboratory.save();
    }
  }

  await logAuditEvent({
    laboratoryId: user.laboratoryId,
    actorId: user._id,
    actorRole: user.role,
    entityType: 'User',
    entityId: user._id,
    action: 'PROFILE_UPDATED',
    req,
  });

  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    laboratory: laboratory ? (laboratory.toObject ? laboratory.toObject() : laboratory) : null,
  };
};

module.exports = {
  login,
  getMe,
  updateProfile,
  forgetPassword,
  resetPassword,
  resetPasswordLoggedIn,
  signToken,
};
