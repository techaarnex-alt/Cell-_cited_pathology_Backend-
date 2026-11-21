const Joi = require('joi');
const { REPORT_STATUS } = require('../constants/status');

const createReportSchema = Joi.object({
  patientId: Joi.string().trim().required().messages({
    'any.required': 'Patient ID is required',
  }),
  doctorId: Joi.string().trim().allow(null, '').default(null),
  sampleType: Joi.string().trim().allow('').default('Blood'),
  registeredOn: Joi.string().trim().allow('').default(''),
  collectedOn: Joi.string().trim().allow('').default(''),
  reportedOn: Joi.string().trim().allow('').default(''),
  testGroupIds: Joi.array().items(Joi.string().trim()).default([]),
  testIds: Joi.array().items(Joi.string().trim()).default([]),
  tests: Joi.array().items(Joi.string().trim()).default([]),
  testGroups: Joi.array().items(Joi.string().trim()).default([]),
  feeOverride: Joi.number().min(0).allow(null),
});

const resultItemSchema = Joi.object({
  reportItemId: Joi.string().trim().allow(null, ''),
  testName: Joi.string().trim(),
  value: Joi.string().trim().allow('').default(''),
  unit: Joi.string().trim().allow(''),
  referenceRange: Joi.string().trim().allow(''),
  remark: Joi.string().trim().allow(''),
});

const updateResultsSchema = Joi.object({
  items: Joi.array().items(resultItemSchema).required().messages({
    'any.required': 'Results items array is required',
  }),
});

const finalizeReportSchema = Joi.object({
  items: Joi.array().items(resultItemSchema).default([]),
  expectedVersion: Joi.number().integer(),
  reportedOn: Joi.string().trim().allow(''),
});

const reopenReportSchema = Joi.object({
  reason: Joi.string().trim().min(5).required().messages({
    'any.required': 'A clinical reason is required to reopen a finalised report',
    'string.min': 'Reason must be at least 5 characters long',
  }),
});

const documentRequestSchema = Joi.object({
  withLetterhead: Joi.boolean().default(true),
});

const queryReportSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...Object.values(REPORT_STATUS)),
  patientId: Joi.string().trim(),
  doctorId: Joi.string().trim(),
  search: Joi.string().trim().allow('').default(''),
  reportNumber: Joi.string().trim(),
});

module.exports = {
  createReportSchema,
  updateResultsSchema,
  finalizeReportSchema,
  reopenReportSchema,
  documentRequestSchema,
  queryReportSchema,
};
