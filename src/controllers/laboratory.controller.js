const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const laboratoryService = require('../services/laboratory.service');

const getProfile = catchAsync(async (req, res) => {
  const lab = await laboratoryService.getLaboratoryProfile(req.laboratoryId);
  return sendSuccess(res, 200, 'Laboratory profile retrieved successfully', lab);
});

const updateProfile = catchAsync(async (req, res) => {
  const lab = await laboratoryService.updateLaboratoryProfile(
    req.laboratoryId,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Laboratory profile updated successfully', lab);
});

module.exports = {
  getProfile,
  updateProfile,
};
