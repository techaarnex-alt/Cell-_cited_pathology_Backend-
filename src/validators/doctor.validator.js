const Joi = require('joi');

const createDoctorSchema = Joi.object({
  doctorCode: Joi.string().trim().uppercase(),
  name: Joi.string().trim().required().messages({
    'any.required': 'Doctor name is required',
    'string.empty': 'Doctor name cannot be empty',
  }),
  specialty: Joi.string().trim().allow('').default(''),
  mobile: Joi.string().trim().allow('').default(''),
  address: Joi.string().trim().allow('').default(''),
  referralPercentage: Joi.number().min(0).max(100).default(0).messages({
    'number.min': 'Referral percentage cannot be negative',
    'number.max': 'Referral percentage cannot exceed 100',
  }),
});

const updateDoctorSchema = Joi.object({
  name: Joi.string().trim(),
  specialty: Joi.string().trim().allow(''),
  mobile: Joi.string().trim().allow(''),
  address: Joi.string().trim().allow(''),
  referralPercentage: Joi.number().min(0).max(100),
  isActive: Joi.boolean(),
}).min(1);

const queryDoctorSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().trim().allow('').default(''),
  isActive: Joi.boolean(),
});

module.exports = {
  createDoctorSchema,
  updateDoctorSchema,
  queryDoctorSchema,
};
