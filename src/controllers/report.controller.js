const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const reportService = require('../services/report.service');

const getReports = catchAsync(async (req, res) => {
  const result = await reportService.getReports(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Reports retrieved successfully', result.reports, {
    pagination: result.pagination,
  });
});

const getReportById = catchAsync(async (req, res) => {
  const report = await reportService.getReportById(req.laboratoryId, req.params.id);
  return sendSuccess(res, 200, 'Report retrieved successfully', report);
});

const createReport = catchAsync(async (req, res) => {
  const result = await reportService.createReport(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Draft report created successfully', result.report);
});

const updateResults = catchAsync(async (req, res) => {
  const report = await reportService.updateResults(
    req.laboratoryId,
    req.params.id,
    req.body.items,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Results saved successfully', report);
});

const finalizeReport = catchAsync(async (req, res) => {
  const report = await reportService.finalizeReport(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Report finalised successfully', report);
});

const reopenReport = catchAsync(async (req, res) => {
  const report = await reportService.reopenReport(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Report reopened successfully for corrections', report);
});

const requestDocument = catchAsync(async (req, res) => {
  const document = await reportService.requestDocument(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 201, 'Document generated successfully', document);
});

const updateReport = catchAsync(async (req, res) => {
  const report = await reportService.updateReport(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 200, 'Report updated successfully', report);
});

module.exports = {
  getReports,
  getReportById,
  createReport,
  updateResults,
  finalizeReport,
  reopenReport,
  requestDocument,
  updateReport,
};
