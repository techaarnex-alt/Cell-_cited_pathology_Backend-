const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const testGroupService = require('../services/testGroup.service');

const getTestGroups = catchAsync(async (req, res) => {
  const groups = await testGroupService.getTestGroups(req.laboratoryId);
  return sendSuccess(res, 200, 'Test groups retrieved successfully', groups);
});

const createTestGroup = catchAsync(async (req, res) => {
  const group = await testGroupService.createTestGroup(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Test group created successfully', group);
});

module.exports = {
  getTestGroups,
  createTestGroup,
};
