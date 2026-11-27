const Joi = require('joi');

const createPatientSchema = Joi.object({
  title: Joi.string().trim().allow('').default(''),
  name: Joi.string().trim().required().messages({
    'any.required': 'Patient name is required',
    'string.empty': 'Patient name cannot be empty',
  }),
  age: Joi.number().min(0).required().messages({
    'any.required': 'Patient age is required',
    'number.min': 'Age cannot be negative',
  }),
  ageUnit: Joi.string().valid('Years', 'Months', 'Days').default('Years'),
  gender: Joi.string().valid('Male', 'Female', 'Other').required().messages({
    'any.required': 'Gender is required',
  }),
  mobile: Joi.string().trim().allow('').default(''),
  email: Joi.string().trim().email().allow('').default(''),
  aadhaar: Joi.string().trim().allow('').default(''),
  patientHistory: Joi.string().trim().allow('').default(''),
  onlineReportRequested: Joi.boolean().default(false),
  address: Joi.string().trim().allow('').default(''),
  doctorId: Joi.string().trim().allow(null, '').default(null),
  sampleType: Joi.string().trim().allow('').default('Blood'),
  registeredOn: Joi.string().trim().allow('').default(''),
  collectedOn: Joi.string().trim().allow('').default(''),
  reportedOn: Joi.string().trim().allow('').default(''),
  // Optional atomic report creation fields
  testGroupIds: Joi.array().items(Joi.string().trim()).default([]),
  testIds: Joi.array().items(Joi.string().trim()).default([]),
  tests: Joi.array().items(Joi.string().trim()).default([]),
  testGroups: Joi.array().items(Joi.string().trim()).default([]),
  feeOverride: Joi.number().min(0).allow(null),
});

const updatePatientSchema = Joi.object({
  title: Joi.string().trim().allow(''),
  name: Joi.string().trim(),
  age: Joi.number().min(0),
  ageUnit: Joi.string().valid('Years', 'Months', 'Days'),
  gender: Joi.string().valid('Male', 'Female', 'Other'),
  mobile: Joi.string().trim().allow(''),
  email: Joi.string().trim().email().allow(''),
  aadhaar: Joi.string().trim().allow(''),
  patientHistory: Joi.string().trim().allow(''),
  onlineReportRequested: Joi.boolean(),
  address: Joi.string().trim().allow(''),
  doctorId: Joi.string().trim().allow(null, ''),
  sampleType: Joi.string().trim().allow(''),
  registeredOn: Joi.string().trim().allow(''),
  collectedOn: Joi.string().trim().allow(''),
  reportedOn: Joi.string().trim().allow(''),
  expectedVersion: Joi.number(),
}).min(1);

const queryPatientSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').default(''),
  patientNumber: Joi.string().trim().allow(''),
  mobile: Joi.string().trim().allow(''),
});

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  queryPatientSchema,
};
