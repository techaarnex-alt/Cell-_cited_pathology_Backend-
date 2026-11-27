const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const testCatalogueService = require('../services/testCatalogue.service');

const getCategories = catchAsync(async (req, res) => {
  const result = await testCatalogueService.getCategories(req.laboratoryId);
  return sendSuccess(res, 200, 'Catalogue categories retrieved successfully', result);
});

const getCategoryTests = catchAsync(async (req, res) => {
  const category = req.params.category || 'All';
  const result = await testCatalogueService.getCategoryTests(req.laboratoryId, category, req.query);
  return sendSuccess(res, 200, 'Catalogue tests retrieved successfully', result.tests, {
    pagination: result.pagination,
  });
});

const getTestById = catchAsync(async (req, res) => {
  const test = await testCatalogueService.getTestById(req.laboratoryId, req.params.testId);
  return sendSuccess(res, 200, 'Test retrieved successfully', test);
});

const createTest = catchAsync(async (req, res) => {
  const category = req.params.category || req.body.category || 'Others';
  const test = await testCatalogueService.createTest(req.laboratoryId, category, req.body, req.user, req);
  return sendSuccess(res, 201, 'Test created successfully', test);
});

const updateTest = catchAsync(async (req, res) => {
  const test = await testCatalogueService.updateTest(req.laboratoryId, req.params.testId, req.body, req.user, req);
  return sendSuccess(res, 200, 'Test updated successfully', test);
});

const deleteTest = catchAsync(async (req, res) => {
  const result = await testCatalogueService.deleteTest(req.laboratoryId, req.params.testId, req.user, req);
  return sendSuccess(res, 200, 'Test removed successfully', result);
});

const reorderCategories = catchAsync(async (req, res) => {
  const result = await testCatalogueService.reorderCategories(req.laboratoryId, req.body.orderedCategoryNames);
  return sendSuccess(res, 200, 'Categories reordered successfully', result);
});

const reorderCategoryTests = catchAsync(async (req, res) => {
  const category = req.params.category;
  const result = await testCatalogueService.reorderCategoryTests(req.laboratoryId, category, req.body.orderedTestIds);
  return sendSuccess(res, 200, 'Category tests reordered successfully', result);
});

const reorderTestParameters = catchAsync(async (req, res) => {
  const testId = req.params.testId;
  const result = await testCatalogueService.reorderTestParameters(req.laboratoryId, testId, req.body.orderedParamIds);
  return sendSuccess(res, 200, 'Test parameters reordered successfully', result);
});

const addParameter = catchAsync(async (req, res) => {
  const result = await testCatalogueService.addParameter(req.laboratoryId, req.params.testId, req.body);
  return sendSuccess(res, 201, 'Parameter added successfully', result);
});

const updateParameter = catchAsync(async (req, res) => {
  const result = await testCatalogueService.updateParameter(
    req.laboratoryId,
    req.params.testId,
    req.params.paramId,
    req.body
  );
  return sendSuccess(res, 200, 'Parameter updated successfully', result);
});

const removeParameter = catchAsync(async (req, res) => {
  const result = await testCatalogueService.removeParameter(
    req.laboratoryId,
    req.params.testId,
    req.params.paramId
  );
  return sendSuccess(res, 200, 'Parameter removed successfully', result);
});

module.exports = {
  getCategories,
  getCategoryTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  reorderCategories,
  reorderCategoryTests,
  reorderTestParameters,
  addParameter,
  updateParameter,
  removeParameter,
};
