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


export const recommendVehicleSchema = Joi.object({
  vehicle_type: Joi.string().required().messages({
    'string.empty': 'Vehicle type is required',
    'any.required': 'Vehicle type is required'
  }),
  weight: Joi.number().required().messages({
    'number.base': 'Weight must be a number',
    'any.required': 'Weight is required'
  }),
  length: Joi.number().required().messages({
    'number.base': 'Length must be a number',
    'any.required': 'Length is required'
  }),
  width: Joi.number().required().messages({
    'number.base': 'Width must be a number',
    'any.required': 'Width is required'
  }),
  height: Joi.number().required().messages({
    'number.base': 'Height must be a number',
    'any.required': 'Height is required'
  }),
  dimension_unit: Joi.string().valid('cm', 'm', 'ft', 'inch').default('cm').messages({
    'any.only': 'Dimension unit must be one of cm, m, ft, inch'
  })
});
