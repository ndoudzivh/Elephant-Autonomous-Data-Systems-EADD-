/**
 * Express application setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { conversationRouter } from './routes/conversations';
import { pipelineRouter } from './routes/pipelines';
import { executionRouter } from './routes/executions';
import { agentRouter } from './routes/agent';
import { healthRouter } from './routes/health';
import { repoConnectRouter } from './routes/repo-connect';
import { fileUploadRouter } from './routes/file-upload';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { authMiddleware } from './middleware/auth';

export function createApp() {
  const app = express();

  // Security & performance middleware
  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }));
  app.use(express.json({ limit: '50mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Request logging
  app.use(requestLogger);

  // Public routes
  app.use('/api/health', healthRouter);

  // Protected routes
  app.use('/api/conversations', authMiddleware, conversationRouter);
  app.use('/api/pipelines', authMiddleware, pipelineRouter);
  app.use('/api/executions', authMiddleware, executionRouter);
  app.use('/api/agent', authMiddleware, agentRouter);
  app.use('/api/repos', authMiddleware, repoConnectRouter);
  app.use('/api/files', authMiddleware, fileUploadRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
