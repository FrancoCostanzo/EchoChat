const logger = require('../config/logger');
const { AppError } = require('../errors');
const { StatusCodes } = require('http-status-codes');

function errorHandler(err, req, res, _next) {
  // Operational errors we trust
  if (err instanceof AppError) {
    logger.warn({ err, statusCode: err.statusCode, path: req.path }, err.message);
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Joi validation errors (if thrown directly)
  if (err.isJoi) {
    logger.warn({ err, path: req.path }, 'Validation error');
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'Validation failed',
      details: err.details?.map((d) => ({ field: d.path.join('.'), message: d.message })),
    });
  }

  // PG unique violation
  if (err.code === '23505') {
    logger.warn({ err, path: req.path }, 'Duplicate key violation');
    return res.status(StatusCodes.CONFLICT).json({
      status: 'error',
      message: 'Resource already exists',
    });
  }

  // PG check constraint (e.g. message type not yet migrated)
  if (err.code === '23514') {
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

module.exports = errorHandler;
