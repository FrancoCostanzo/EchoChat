import type { Request, Response, NextFunction } from 'express';
import type { ValidationError } from 'joi';
import logger from '../config/logger';
import { AppError } from '../errors';
import { StatusCodes } from 'http-status-codes';

/** Error de Postgres: `pg` cuelga el SQLSTATE en `code`. */
type PgError = Error & { code?: string };

function esJoi(err: unknown): err is ValidationError {
  return typeof err === 'object' && err !== null && (err as ValidationError).isJoi === true;
}

function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Operational errors we trust
  if (err instanceof AppError) {
    logger.warn({ err, statusCode: err.statusCode, path: req.path }, err.message);
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Joi validation errors (if thrown directly)
  if (esJoi(err)) {
    logger.warn({ err, path: req.path }, 'Validation error');
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'Validation failed',
      details: err.details?.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }

  const code = (err as PgError)?.code;

  // PG unique violation
  if (code === '23505') {
    logger.warn({ err, path: req.path }, 'Duplicate key violation');
    return res.status(StatusCodes.CONFLICT).json({
      status: 'error',
      message: 'Resource already exists',
    });
  }

  // PG check constraint (e.g. message type not yet migrated)
  if (code === '23514') {
    logger.warn({ err, path: req.path }, 'Check constraint violation');
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'Tipo de mensaje no soportado en la base de datos. Ejecutá la migración 005_add_message_type_code.sql',
    });
  }

  // Unknown/programming errors — don't leak internals
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    status: 'error',
    message: 'Internal server error',
  });
}

export = errorHandler;
