const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const testService = require('../services/test.service');

const getTests = catchAsync(async (req, res) => {
  const result = await testService.getTests(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Tests retrieved successfully', result.tests, {
    pagination: result.pagination,
  });
});

const getTestById = catchAsync(async (req, res) => {
  const test = await testService.getTestById(req.laboratoryId, req.params.id);
  return sendSuccess(res, 200, 'Test retrieved successfully', test);
});

const createTest = catchAsync(async (req, res) => {
  const test = await testService.createTest(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Test created successfully', test);
});

const updateTest = catchAsync(async (req, res) => {
  const test = await testService.updateTest(req.laboratoryId, req.params.id, req.body, req.user, req);
  return sendSuccess(res, 200, 'Test updated successfully', test);
});

const deleteTest = catchAsync(async (req, res) => {
  const result = await testService.deleteTest(req.laboratoryId, req.params.id, req.user, req);
  return sendSuccess(res, 200, 'Test retired successfully', result);
});

module.exports = {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
};
