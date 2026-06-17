/**
 * Reusable Express middleware to validate request payload against a Joi schema.
 * @param {object} schema - Joi schema object
 * @param {string} source - Request object key to validate ('body', 'query', 'params')
 */
export const validateSchema = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      error.isJoi = true;
      return next(error);
    }

    // Replace original input with stripped/typed values from Joi
    req[source] = value;
    next();
  };
};
