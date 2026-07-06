/**
 * Global error handler middleware
 */

import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error({
    err,
    method: req.method,
    path: req.path,
    statusCode,
  }, 'Request error');

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode === 500
        ? 'An internal error occurred'
        : err.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err.details,
      }),
    },
  });
}
