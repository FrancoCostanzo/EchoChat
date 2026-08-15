import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Schema } from 'joi';
import { BadRequestError } from '../errors';

/**
 * Returns a middleware that validates req.body against a Joi schema.
 */
function validate(schema: Schema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
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

export = validate;
