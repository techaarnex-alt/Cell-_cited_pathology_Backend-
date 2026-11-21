const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const authService = require('../services/auth.service');

const login = catchAsync(async (req, res) => {
  const { username, password } = req.body;
  const result = await authService.login(username, password, req);
  return sendSuccess(res, 200, 'Login successful', result);
});

const getMe = catchAsync(async (req, res) => {
  const result = await authService.getMe(req.user._id);
  return sendSuccess(res, 200, 'User profile retrieved successfully', result);
});

module.exports = {
  login,
  getMe,
};
