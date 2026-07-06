/**
 * Request logging middleware
 */

import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration,
      user_agent: req.get('user-agent'),
    }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
