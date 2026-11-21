const Joi = require('joi');
const { PAYMENT_METHODS, INVOICE_STATUS } = require('../constants/status');

const createInvoiceSchema = Joi.object({
  reportId: Joi.string().trim().required().messages({
    'any.required': 'Report ID is required to generate an invoice',
  }),
  total: Joi.number().min(0),
  discount: Joi.number().min(0).default(0),
});

const recordPaymentSchema = Joi.object({
  amount: Joi.number().greater(0).required().messages({
    'any.required': 'Payment amount is required',
    'number.greater': 'Payment amount must be greater than zero',
  }),
  method: Joi.string().valid(...Object.values(PAYMENT_METHODS)).default(PAYMENT_METHODS.CASH),
  reference: Joi.string().trim().allow('').default(''),
  notes: Joi.string().trim().allow('').default(''),
  discount: Joi.number().min(0).default(0),
});

const queryInvoiceSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...Object.values(INVOICE_STATUS)),
  reportId: Joi.string().trim(),
  patientId: Joi.string().trim(),
});

module.exports = {
  createInvoiceSchema,
  recordPaymentSchema,
  queryInvoiceSchema,
};
