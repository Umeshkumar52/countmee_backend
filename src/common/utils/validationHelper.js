import { ApiError } from './ApiError.js';

/**
 * Validates arbitrary data objects against a Joi validation schema.
 * Automatically casts types and strips unvalidated attributes.
 *
 * @param {object} schema - Joi schema object
 * @param {object} data - Payload data to validate (e.g. req.body, req.query)
 * @returns {object} Sanitized, validated, and type-cast request payload
 * @throws {ApiError} 400 Validation Error if payload fails constraints
 */
export const validate = (schema, data) => {
  // Guard clause against developer configuration errors
  if (!schema || typeof schema.validate !== 'function') {
    throw new ApiError(500, 'Internal Developer Error: Invalid schema passed to validation helper.');
  }

  const { error, value } = schema.validate(data || {}, {
    abortEarly: false,     // Collect all errors instead of stopping at first failure
    allowUnknown: true,   // Allow extra fields without throwing errors
    stripUnknown: true    // Remove non-schema fields to prevent DB injection
  });

  if (error) {
    const errorDetails = {};
    error.details.forEach(item => {
      const key = item.context.key;
      if (!errorDetails[key]) {
        errorDetails[key] = [];
      }
      errorDetails[key].push(item.message);
    });

    // Throw standard Joi validation bad request
    throw new ApiError(400, 'Validation error', errorDetails);
  }

  return value;
};
