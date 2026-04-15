const { BadRequestError } = require('../errors');

/**
 * Returns a middleware that validates req.body against a Joi schema.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      throw new BadRequestError('Validation failed', details);
    }

    req.body = value;
    next();
  };
}

module.exports = validate;
