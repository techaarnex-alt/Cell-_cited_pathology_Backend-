const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const dashboardService = require('../services/dashboard.service');

const getStats = catchAsync(async (req, res) => {
  const stats = await dashboardService.getDashboardStats(req.laboratoryId);
  return sendSuccess(res, 200, 'Dashboard statistics retrieved successfully', stats);
});

module.exports = {
  getStats,
};
