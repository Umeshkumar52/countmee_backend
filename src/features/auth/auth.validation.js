import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const registerCustomerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number cannot be empty',
      'any.required': 'Phone number is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email Address cannot be empty',
      'string.email': 'Enter a valid Email Address',
      'any.required': 'Email Address is required'
    }),
  DOB: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'DOB must be a valid date',
      'any.required': 'DOB is required'
    })
});

export const loginCustomerSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number cannot be empty',
      'any.required': 'Phone number is required'
    })
});

export const verifyOtpSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  otp: Joi.string()
    .length(4)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'OTP cannot be empty',
      'string.length': 'OTP must be exactly 4 digits',
      'string.pattern.base': 'OTP must contain only digits',
      'any.required': 'OTP is required'
    })
});

export const registerDpSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number cannot be empty',
      'any.required': 'Phone number is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email Address cannot be empty',
      'string.email': 'Enter a valid Email Address',
      'any.required': 'Email Address is required'
    }),
  DOB: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'DOB must be a valid date',
      'any.required': 'DOB is required'
    })
});

export const loginDpSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Phone number cannot be empty',
      'any.required': 'Phone number is required'
    })
});

export const portalLoginSchema = Joi.object({
  phone: Joi.string()
    .length(10)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'Phone number cannot be empty',
      'string.length': 'Phone number must be exactly 10 digits',
      'string.pattern.base': 'Phone number must contain only digits',
      'any.required': 'Phone number is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password cannot be empty',
      'any.required': 'Password is required'
    })
});

export const adminLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email Address cannot be empty',
      'string.email': 'Enter a valid Email Address',
      'any.required': 'Email Address is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password cannot be empty',
      'any.required': 'Password is required'
    })
});
