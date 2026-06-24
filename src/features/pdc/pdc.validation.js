import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const registerPdcSchema = Joi.object({
  first_name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'First name is required',
      'any.required': 'First name is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email Address is required',
      'string.email': 'Enter a valid Email Address',
      'any.required': 'Email Address is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password confirmation is required',
      'any.required': 'Password confirmation is required'
    }),
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'any.required': 'Phone number is required'
    })
});

export const loginPdcSchema = Joi.object({
  phone: Joi.string()
    .length(10)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'string.length': 'Phone number must be exactly 10 digits',
      'string.pattern.base': 'Phone number must contain only digits',
      'any.required': 'Phone number is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
});

export const editPdcProfileSchema = Joi.object({
  name: Joi.string()
    .trim()
    .allow('', null),
  phone: Joi.string()
    .trim()
    .allow('', null),
  email: Joi.string()
    .email()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    })
});

export const pdcLocationUpdateSchema = Joi.object({
  pdcAuthId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'PDC Auth ID is required',
      'string.pattern.base': 'Invalid PDC Auth ID format',
      'any.required': 'PDC Auth ID is required'
    }),
  latitude: Joi.number()
    .required()
    .messages({
      'number.base': 'Latitude must be a valid number',
      'any.required': 'Latitude is required'
    }),
  longitude: Joi.number()
    .required()
    .messages({
      'number.base': 'Longitude must be a valid number',
      'any.required': 'Longitude is required'
    }),
  address: Joi.string()
    .trim()
    .optional(),
  location: Joi.string()
    .trim()
    .optional()
});

export const pdcRateDpSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID is required',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  from_pdc: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Rating author PDC ID is required',
      'string.pattern.base': 'Invalid Rating author PDC ID format',
      'any.required': 'Rating author PDC ID is required'
    }),
  to_dp: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Rating recipient DP ID is required',
      'string.pattern.base': 'Invalid Rating recipient DP ID format',
      'any.required': 'Rating recipient DP ID is required'
    }),
  stars: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'number.base': 'Rating stars must be a number',
      'number.min': 'Stars must be at least 1',
      'number.max': 'Stars cannot be greater than 5',
      'any.required': 'Rating stars is required'
    }),
  message: Joi.string()
    .trim()
    .allow('', null)
});
