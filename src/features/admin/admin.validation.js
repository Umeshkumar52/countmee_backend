import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const loginSchema = Joi.object({
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
  fcmToken: Joi.string().allow('', null).optional()
});

export const updateDocStatusSchema = Joi.object({
  document_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Document ID cannot be empty',
      'string.pattern.base': 'Invalid Document ID format',
      'any.required': 'Document ID is required'
    }),
  document_type: Joi.string()
    .valid('aadhar', 'dl', 'bank', 'rc', 'rv')
    .required()
    .messages({
      'string.empty': 'Document type is required',
      'any.only': 'Document type must be one of: aadhar, dl, bank, rc, rv',
      'any.required': 'Document type is required'
    }),
  status: Joi.string()
    .valid('Accept', 'Reject')
    .required()
    .messages({
      'string.empty': 'Status is required',
      'any.only': 'Status must be Accept or Reject',
      'any.required': 'Status is required'
    }),
  reason: Joi.string()
    .trim()
    .when('status', {
      is: 'Reject',
      then: Joi.required(),
      otherwise: Joi.optional().allow('', null)
    })
    .messages({
      'string.empty': 'Rejection reason is required when rejecting a document',
      'any.required': 'Rejection reason is required when rejecting a document'
    })
});

export const updateActionSchema = Joi.object({
  userId: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID cannot be empty',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  document_approval: Joi.string()
    .required()
    .messages({
      'string.empty': 'Document approval status is required',
      'any.required': 'Document approval status is required'
    })
});

export const addDpSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
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
  email: Joi.string()
    .email()
    .trim()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    }),
  dob: Joi.string()
    .trim()
    .allow('', null),
  gender: Joi.string()
    .trim()
    .allow('', null),
  address: Joi.string()
    .trim()
    .allow('', null),
  vehicle_type: Joi.string()
    .trim()
    .allow('', null),
  aadhar_number: Joi.string()
    .trim()
    .allow('', null),
  rc_number: Joi.string()
    .trim()
    .allow('', null),
  dl_number: Joi.string()
    .trim()
    .allow('', null),
  bank_name: Joi.string()
    .trim()
    .allow('', null),
  bank_acc_number: Joi.string()
    .trim()
    .allow('', null),
  bank_ifsc: Joi.string()
    .trim()
    .allow('', null),
  vehicle_number: Joi.string()
    .trim()
    .allow('', null),
  reference1_name: Joi.string()
    .trim()
    .allow('', null),
  reference1_phone: Joi.string()
    .trim()
    .allow('', null),
  reference2_name: Joi.string()
    .trim()
    .allow('', null),
  reference2_phone: Joi.string()
    .trim()
    .allow('', null),
  dl_expiry_date: Joi.string()
    .allow('', null),
  sub_vehicle_type: Joi.string()
    .allow('', null),
  other_vehicle_details: Joi.string()
    .allow('', null),
  vehicle_min_capacity: Joi.any()
    .allow('', null),
  vehicle_max_capacity: Joi.any()
    .allow('', null),
  insurance_expiry_date: Joi.string()
    .allow('', null),
  emission_expiry_date: Joi.string()
    .allow('', null),
  is_new_vehicle: Joi.any()
    .allow('', null),
  vehicle_registration_date: Joi.string()
    .allow('', null),
  travel_permit_states: Joi.string()
    .allow('', null)
});

export const editDpSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
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
  email: Joi.string()
    .email()
    .trim()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    }),
  dob: Joi.string()
    .trim()
    .allow('', null),
  gender: Joi.string()
    .trim()
    .allow('', null),
  address: Joi.string()
    .trim()
    .allow('', null),
  vehicle_type: Joi.string()
    .trim()
    .allow('', null),
  aadhar_number: Joi.string()
    .trim()
    .allow('', null),
  rc_number: Joi.string()
    .trim()
    .allow('', null),
  dl_number: Joi.string()
    .trim()
    .allow('', null),
  bank_name: Joi.string()
    .trim()
    .allow('', null),
  bank_acc_number: Joi.string()
    .trim()
    .allow('', null),
  bank_ifsc: Joi.string()
    .trim()
    .allow('', null),
  vehicle_number: Joi.string()
    .trim()
    .allow('', null),
  reference1_name: Joi.string()
    .trim()
    .allow('', null),
  reference1_phone: Joi.string()
    .trim()
    .allow('', null),
  reference2_name: Joi.string()
    .trim()
    .allow('', null),
  reference2_phone: Joi.string()
    .trim()
    .allow('', null),
  dl_expiry_date: Joi.string()
    .allow('', null),
  sub_vehicle_type: Joi.string()
    .allow('', null),
  other_vehicle_details: Joi.string()
    .allow('', null),
  vehicle_min_capacity: Joi.any()
    .allow('', null),
  vehicle_max_capacity: Joi.any()
    .allow('', null),
  insurance_expiry_date: Joi.string()
    .allow('', null),
  emission_expiry_date: Joi.string()
    .allow('', null),
  is_new_vehicle: Joi.any()
    .allow('', null),
  vehicle_registration_date: Joi.string()
    .allow('', null),
  travel_permit_states: Joi.string()
    .allow('', null)
});

export const editCustomerSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .trim()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    }),
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
  address: Joi.string()
    .trim()
    .allow('', null)
});

export const addPdcSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .trim()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    }),
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
  address: Joi.string()
    .trim()
    .allow('', null),
  city: Joi.string()
    .trim()
    .allow('', null),
  state: Joi.string()
    .trim()
    .allow('', null),
  district: Joi.string()
    .trim()
    .allow('', null),
  pincode: Joi.string()
    .trim()
    .allow('', null),
  aadhar: Joi.string()
    .trim()
    .allow('', null),
  gst: Joi.string()
    .trim()
    .allow('', null),
  pan: Joi.string()
    .trim()
    .allow('', null),
  bank_name: Joi.string()
    .trim()
    .allow('', null),
  bank_ifsc: Joi.string()
    .trim()
    .allow('', null),
  bank_acc_no: Joi.string()
    .trim()
    .allow('', null),
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
    })
});

export const editPdcSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Name cannot be empty',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .trim()
    .allow('', null)
    .messages({
      'string.email': 'Enter a valid Email Address'
    }),
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
  address: Joi.string()
    .trim()
    .allow('', null),
  aadhar: Joi.string()
    .trim()
    .allow('', null),
  gst: Joi.string()
    .trim()
    .allow('', null),
  pan: Joi.string()
    .trim()
    .allow('', null),
  bank_name: Joi.string()
    .trim()
    .allow('', null),
  bank_ifsc: Joi.string()
    .trim()
    .allow('', null),
  bank_acc_no: Joi.string()
    .trim()
    .allow('', null),
  shop_name: Joi.string()
    .trim()
    .allow('', null)
});

export const assignDeliveryboySchema = Joi.object({
  order_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Order ID is required',
      'string.pattern.base': 'Invalid Order ID format',
      'any.required': 'Order ID is required'
    }),
  dp_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'DP ID is required',
      'string.pattern.base': 'Invalid DP ID format',
      'any.required': 'DP ID is required'
    })
});

export const minBroadcastSchema = Joi.object({
  role: Joi.string().required().messages({
    'string.base': 'Role must be a string',
    'any.required': 'Role is required'
  }),
  distance: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.base': 'Distance must be a valid number',
      'number.min': 'Distance cannot be negative',
      'any.required': 'Distance is required'
    })
});

export const reportDataSchema = Joi.object({
  report_type: Joi.string()
    .valid('order', 'user', 'feedback')
    .required()
    .messages({
      'string.empty': 'Report type is required',
      'any.only': 'Report type must be order, user or feedback',
      'any.required': 'Report type is required'
    }),
  start_date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'Start date must be a valid ISO date',
      'any.required': 'Start date is required'
    }),
  end_date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'End date must be a valid ISO date',
      'any.required': 'End date is required'
    })
});

const deliverChargeItemSchema = Joi.object({
  vehicle_type: Joi.string()
    .required()
    .messages({
      'string.empty': 'Vehicle type is required',
      'any.required': 'Vehicle type is required'
    }),
  base_distance: Joi.number()
    .required()
    .messages({
      'number.base': 'Base distance must be a number',
      'any.required': 'Base distance is required'
    }),
  base_price: Joi.number()
    .required()
    .messages({
      'number.base': 'Base price must be a number',
      'any.required': 'Base price is required'
    }),
  per_km_price: Joi.number()
    .required()
    .messages({
      'number.base': 'Per-km price must be a number',
      'any.required': 'Per-km price is required'
    }),
  waiting_charge: Joi.number().min(0).allow('', null).optional(),
  dp_commission: Joi.number()
    .required()
    .messages({
      'number.base': 'DP commission must be a number',
      'any.required': 'DP commission is required'
    }),
  pdc_commission: Joi.number()
    .required()
    .messages({
      'number.base': 'PDC commission must be a number',
      'any.required': 'PDC commission is required'
    }),
  max_weight: Joi.number().optional().default(0),
  max_height: Joi.number().optional().default(0),
  max_width: Joi.number().optional().default(0),
  max_length: Joi.number().optional().default(0),
  dimension_unit: Joi.string().valid('cm', 'm', 'ft', 'inch').optional().default('cm')
});

export const deliverChargeSchema = Joi.alternatives().try(
  deliverChargeItemSchema,
  Joi.array().items(deliverChargeItemSchema).min(1)
);



export const verifyCredentialsSchema = Joi.object({
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
    })
});

export const sendOtpSchema = Joi.object({
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
  action_type: Joi.string()
    .required()
    .messages({
      'string.empty': 'Action type is required',
      'any.required': 'Action type is required'
    }),
  amount: Joi.number()
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'any.required': 'Amount is required'
    }),
  credentialsToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Credentials token is required',
      'any.required': 'Credentials token is required'
    })
});

export const verifyOtpSchema = Joi.object({
  otp: Joi.string()
    .pattern(/^\d+$/)
    .required()
    .messages({
      'string.empty': 'OTP is required',
      'string.pattern.base': 'OTP must contain only digits',
      'any.required': 'OTP is required'
    }),
  otpToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'OTP token is required',
      'any.required': 'OTP token is required'
    })
});

export const creditIndividualSchema = Joi.object({
  wallet_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'Wallet ID is required',
      'string.pattern.base': 'Invalid Wallet ID format',
      'any.required': 'Wallet ID is required'
    }),
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  description: Joi.string()
    .trim()
    .allow('', null),
  verificationToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
});

export const creditCustomerSchema = Joi.object({
  user_id: Joi.string()
    .regex(objectIdRegex)
    .required()
    .messages({
      'string.empty': 'User ID is required',
      'string.pattern.base': 'Invalid User ID format',
      'any.required': 'User ID is required'
    }),
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  description: Joi.string()
    .trim()
    .allow('', null),
  verificationToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
});

export const creditMassSchema = Joi.object({
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  description: Joi.string()
    .trim()
    .allow('', null),
  verificationToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
});

export const joiningBonusSchema = Joi.object({
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
  verificationToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
});

export const addVehicleSubcategorySchema = Joi.object({
  vehicle_type: Joi.string()
    .valid('By Hand', 'Two Wheeler', 'Three Wheeler', 'Four Wheeler')
    .required()
    .messages({
      'string.empty': 'Vehicle type cannot be empty',
      'any.only': 'Vehicle type must be one of: By Hand, Two Wheeler, Three Wheeler, Four Wheeler',
      'any.required': 'Vehicle type is required'
    }),
  sub_vehicle_type: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'Sub vehicle type cannot be empty',
      'any.required': 'Sub vehicle type is required'
    }),
  is_active: Joi.boolean()
    .optional()
});

export const editVehicleSubcategorySchema = Joi.object({
  vehicle_type: Joi.string()
    .valid('By Hand', 'Two Wheeler', 'Three Wheeler', 'Four Wheeler')
    .optional()
    .messages({
      'any.only': 'Vehicle type must be one of: By Hand, Two Wheeler, Three Wheeler, Four Wheeler'
    }),
  sub_vehicle_type: Joi.string()
    .trim()
    .optional(),
  is_active: Joi.boolean()
    .optional()
});

