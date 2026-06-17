import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const editCustomerProfileSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  address: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Address cannot be empty',
      'any.required': 'Address is required'
    })
});

export const createAddressSchema = Joi.object({
  customer_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Customer ID cannot be empty',
      'string.pattern.base': 'Invalid Customer ID format',
      'any.required': 'Customer ID is required'
    }),
  location: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Location is required',
      'any.required': 'Location is required'
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
  phone_no: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'any.required': 'Phone number is required'
    })
});
