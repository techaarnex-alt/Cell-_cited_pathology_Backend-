const Joi = require('joi');

const createTestGroupSchema = Joi.object({
  code: Joi.string().trim().uppercase().required().messages({
    'any.required': 'Test group code is required',
  }),
  name: Joi.string().trim().required().messages({
    'any.required': 'Test group name is required',
  }),
  description: Joi.string().trim().allow('').default(''),
  category: Joi.string().trim().default('General'),
  testIds: Joi.array().items(Joi.string().trim()).default([]),
  testNames: Joi.array().items(Joi.string().trim()).default([]),
});

module.exports = {
  createTestGroupSchema,
};
