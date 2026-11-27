const Joi = require('joi');

const createTestSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow('').default(''),
  testCode: Joi.string().trim().uppercase().allow(''),
  name: Joi.string().trim().allow(''),
  investigation: Joi.string().trim().allow(''),
  category: Joi.string().trim().default('General'),
  unit: Joi.string().trim().allow('').default(''),
  referenceRange: Joi.string().trim().allow('').default(''),
  range: Joi.string().trim().allow(''),
  rate: Joi.number().min(0).default(0),
  pricing: Joi.object({
    net: Joi.number().min(0),
    mrp: Joi.number().min(0),
    currency: Joi.string().default('INR'),
  }),
  sampleInstructions: Joi.string().allow(''),
  temperature: Joi.string().allow(''),
  method: Joi.string().allow(''),
  cutoffTime: Joi.string().allow(''),
  reportingTime: Joi.string().allow(''),
  alertable: Joi.boolean().default(true),
  isActive: Joi.boolean().default(true),
}).unknown(true);

const updateTestSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow(''),
  testCode: Joi.string().trim().uppercase().allow(''),
  name: Joi.string().trim(),
  investigation: Joi.string().trim(),
  category: Joi.string().trim(),
  unit: Joi.string().trim().allow(''),
  referenceRange: Joi.string().trim().allow(''),
  range: Joi.string().trim().allow(''),
  rate: Joi.number().min(0),
  pricing: Joi.object({
    net: Joi.number().min(0),
    mrp: Joi.number().min(0),
    currency: Joi.string(),
  }),
  sampleInstructions: Joi.string().allow(''),
  temperature: Joi.string().allow(''),
  method: Joi.string().allow(''),
  cutoffTime: Joi.string().allow(''),
  reportingTime: Joi.string().allow(''),
  alertable: Joi.boolean(),
  isActive: Joi.boolean(),
}).min(1).unknown(true);

const queryTestSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(2000).default(100),
  search: Joi.string().trim().allow('').default(''),
  category: Joi.string().trim().allow(''),
  isActive: Joi.boolean(),
}).unknown(true);

module.exports = {
  createTestSchema,
  updateTestSchema,
  queryTestSchema,
};
