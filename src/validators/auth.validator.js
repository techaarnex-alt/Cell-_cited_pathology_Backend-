const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().trim().messages({
    'string.empty': 'Username cannot be empty',
  }),
  email: Joi.string().trim().email().messages({
    'string.email': 'Please provide a valid email address',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
    'string.empty': 'Password cannot be empty',
  }),
})
  .or('username', 'email')
  .messages({
    'object.missing': 'Username or email is required',
  });

const forgetPasswordSchema = Joi.object({
  email: Joi.string().trim().email().messages({
    'string.email': 'Please provide a valid email address',
  }),
  username: Joi.string().trim(),
})
  .or('email', 'username')
  .messages({
    'object.missing': 'Please provide email or username to send the reset OTP',
  });

const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().email().messages({
    'string.email': 'Please provide a valid email address',
  }),
  username: Joi.string().trim(),
  otp: Joi.string().trim().messages({
    'string.empty': 'OTP cannot be empty',
  }),
  oldPassword: Joi.string().messages({
    'string.empty': 'Old password cannot be empty',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'New password must be at least 6 characters long',
    'any.required': 'New password is required',
    'string.empty': 'New password cannot be empty',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Confirm password does not match new password',
  }),
})
  .or('otp', 'oldPassword')
  .messages({
    'object.missing': 'Please provide old password or OTP to reset password',
  });

module.exports = {
  loginSchema,
  forgetPasswordSchema,
  resetPasswordSchema,
};
