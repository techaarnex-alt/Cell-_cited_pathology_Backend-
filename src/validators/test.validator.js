const Joi = require('joi');

const createTestSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow('').default(''),
  name: Joi.string().trim().required().messages({
    'any.required': 'Test name is required',
    'string.empty': 'Test name cannot be empty',
  }),
  category: Joi.string().trim().default('General'),
  unit: Joi.string().trim().allow('').default(''),
  referenceRange: Joi.string().trim().allow('').default(''),
  rate: Joi.number().min(0).default(0),
  alertable: Joi.boolean().default(true),
});

const updateTestSchema = Joi.object({
  code: Joi.string().trim().uppercase().allow(''),
  name: Joi.string().trim(),
  category: Joi.string().trim(),
  unit: Joi.string().trim().allow(''),
  referenceRange: Joi.string().trim().allow(''),
  rate: Joi.number().min(0),
  alertable: Joi.boolean(),
  isActive: Joi.boolean(),
}).min(1);

const queryTestSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(100),
  search: Joi.string().trim().allow('').default(''),
  category: Joi.string().trim().allow(''),
  isActive: Joi.boolean(),
});

module.exports = {
  createTestSchema,
  updateTestSchema,
  queryTestSchema,
};
