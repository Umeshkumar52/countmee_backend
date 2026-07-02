import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const dpDetailsSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  gender: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Gender cannot be empty',
      'any.required': 'Gender is required'
    }),
  address: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Address cannot be empty',
      'any.required': 'Address is required'
    })
});

export const dpBankDetailsSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  bank_name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Bank Name cannot be empty',
      'any.required': 'Bank Name is required'
    }),
  bank_acc_number: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Bank Account Number cannot be empty',
      'any.required': 'Bank Account Number is required'
    }),
  bank_ifsc: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'IFSC Code cannot be empty',
      'any.required': 'IFSC Code is required'
    })
});

export const dpReferenceSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  reference1_name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'First Reference Name cannot be empty',
      'any.required': 'First Reference Name is required'
    }),
  reference1_phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'First Reference Phone cannot be empty',
      'any.required': 'First Reference Phone is required'
    }),
  reference2_name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Second Reference Name cannot be empty',
      'any.required': 'Second Reference Name is required'
    }),
  reference2_phone: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Second Reference Phone cannot be empty',
      'any.required': 'Second Reference Phone is required'
    })
});

export const dpDocumentStatusSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    })
});

export const pickupOtpSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
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

export const pickupOrderImagesSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    })
});

export const broadcastFindDpSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  radius: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Radius must be a number',
      'number.min': 'Radius must be at least 1'
    }),
  location: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Location cannot be empty',
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
  broadcast_id: Joi.string()
    .regex(objectIdRegex)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid Broadcast ID format'
    })
});

export const showNearbyPdcSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  location: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Location cannot be empty',
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
  max_distance: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Maximum distance must be a number',
      'number.min': 'Maximum distance cannot be negative'
    })
});

export const deliverPdcSchema = Joi.object({
  pdcAuthId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'PDC Auth ID cannot be empty',
      'string.pattern.base': 'Invalid PDC Auth ID format',
      'any.required': 'PDC Auth ID is required'
    }),
  orderId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  dpAuthId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'DP Auth ID cannot be empty',
      'string.pattern.base': 'Invalid DP Auth ID format',
      'any.required': 'DP Auth ID is required'
    })
});

export const pdcDeliveryOtpSchema = Joi.object({
  otp: Joi.string()
    .length(4)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'OTP cannot be empty',
      'string.length': 'OTP must be exactly 4 digits',
      'string.pattern.base': 'OTP must contain only digits',
      'any.required': 'OTP is required'
    }),
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    })
});

export const dpOnlineToggleSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  online: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Online status must be a boolean',
      'any.required': 'Online status is required'
    }),
  location: Joi.string()
    .trim()
    .allow('', null)
    .messages({
      'string.base': 'Location must be a string'
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
    })
});

export const rateUserSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  from_dp: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Rating author DP ID cannot be empty',
      'string.pattern.base': 'Invalid Rating author DP ID format',
      'any.required': 'Rating author DP ID is required'
    }),
  to_user: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Rating recipient User ID cannot be empty',
      'string.pattern.base': 'Invalid Rating recipient User ID format',
      'any.required': 'Rating recipient User ID is required'
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
    .messages({
      'string.base': 'Message must be a string'
    })
});

export const cancelAssignmentSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  cancel_reason: Joi.string()
    .trim()
    .optional()
    .messages({
      'string.base': 'Cancel reason must be a string'
    })
});

export const orderAcceptSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  status: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Status must be a boolean',
      'any.required': 'Status is required'
    }),
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    })
});

export const dropOrderToCustomerSchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  drop_otp: Joi.string()
    .length(4)
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'Drop OTP cannot be empty',
      'string.length': 'Drop OTP must be exactly 4 digits',
      'string.pattern.base': 'Drop OTP must contain only digits',
      'any.required': 'Drop OTP is required'
    })
});

export const resendOtpSchema = Joi.object({
  orderId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID cannot be empty',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  latitude: Joi.number().required().messages({
    'number.base': 'Latitude must be a valid number',
    'any.required': 'Latitude is required'
  }),
  longitude: Joi.number().required().messages({
    'number.base': 'Longitude must be a valid number',
    'any.required': 'Longitude is required'
  })
});
