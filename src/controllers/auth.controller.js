const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const authService = require('../services/auth.service');

const login = catchAsync(async (req, res) => {
  const { username, email, password } = req.body;
  const identifier = username || email;
  const result = await authService.login(identifier, password, req);
  return sendSuccess(res, 200, 'Login successful', result);
});

const getMe = catchAsync(async (req, res) => {
  const result = await authService.getMe(req.user._id);
  return sendSuccess(res, 200, 'User profile retrieved successfully', result);
});

const updateProfile = catchAsync(async (req, res) => {
  const result = await authService.updateProfile(req.user._id, req.body, req);
  return sendSuccess(res, 200, 'User profile updated successfully', result);
});

const forgetPassword = catchAsync(async (req, res) => {
  const { email, username } = req.body;
  const result = await authService.forgetPassword({ email, username }, req);
  return sendSuccess(res, 200, 'Password reset OTP generated and sent successfully', result);
});

const resetPassword = catchAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  const { oldPassword, newPassword, confirmPassword, email, username, otp } = req.body;

  // If admin is already logged in (token present or oldPassword provided without OTP)
  if (oldPassword || (authHeader && authHeader.startsWith('Bearer ') && !otp)) {
    const result = await authService.resetPasswordLoggedIn({
      authHeader,
      oldPassword,
      newPassword,
      confirmPassword,
      reqUser: req.user,
    }, req);
    return sendSuccess(res, 200, 'Password has been reset successfully.', result);
  }

  // Otherwise, fallback to OTP-based reset (forget password flow)
  const result = await authService.resetPassword({ email, username, otp, newPassword }, req);
  return sendSuccess(res, 200, 'Password has been reset successfully. You can now login with your new password.', result);
});

const logout = catchAsync(async (req, res) => {
  const result = await authService.logout(req.user, req);
  return sendSuccess(res, 200, 'Logged out successfully', result);
});

module.exports = {
  login,
  logout,
  getMe,
  updateProfile,
  forgetPassword,
  resetPassword,
};
