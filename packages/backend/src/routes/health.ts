/**
 * Health check routes
 */

import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'up',
      database: 'up',
      ai: 'up',
    },
  });
});

healthRouter.get('/ready', (req, res) => {
  // TODO: Check actual service connectivity
  res.json({ ready: true });
});
