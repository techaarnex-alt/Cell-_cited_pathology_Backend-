const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/response');
const billingService = require('../services/billing.service');

const getInvoices = catchAsync(async (req, res) => {
  const result = await billingService.getInvoices(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Invoices retrieved successfully', result.invoices, {
    pagination: result.pagination,
  });
});

const createInvoice = catchAsync(async (req, res) => {
  const invoice = await billingService.createInvoice(req.laboratoryId, req.body, req.user, req);
  return sendSuccess(res, 201, 'Invoice created successfully', invoice);
});

const recordPayment = catchAsync(async (req, res) => {
  const result = await billingService.recordPayment(
    req.laboratoryId,
    req.params.id,
    req.body,
    req.user,
    req
  );
  return sendSuccess(res, 201, 'Payment recorded successfully', result);
});

const getBillingSummary = catchAsync(async (req, res) => {
  const summary = await billingService.getBillingSummary(req.laboratoryId, req.query);
  return sendSuccess(res, 200, 'Billing summary retrieved successfully', summary);
});

module.exports = {
  getInvoices,
  createInvoice,
  recordPayment,
  getBillingSummary,
};
