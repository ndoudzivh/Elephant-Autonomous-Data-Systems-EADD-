/**
 * Development server entry point
 * In production, this runs as Lambda behind API Gateway
 */

import { createApp } from './app';
import { StreamManager } from './services/stream-manager';
import { WebSocketServer } from 'ws';
import http from 'http';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const PORT = parseInt(process.env.PORT || '4000', 10);

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  // WebSocket server for streaming responses
  const wss = new WebSocketServer({ server, path: '/ws' });
  const streamManager = StreamManager.getInstance();
  streamManager.attachWebSocketServer(wss);

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const sessionId = url.searchParams.get('session_id');
    logger.info({ sessionId }, 'WebSocket client connected');

    if (sessionId) {
      streamManager.registerClient(sessionId, ws);
    }

    ws.on('close', () => {
      if (sessionId) {
        streamManager.unregisterClient(sessionId);
      }
      logger.info({ sessionId }, 'WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      logger.error({ error, sessionId }, 'WebSocket error');
    });
  });

  server.listen(PORT, () => {
    logger.info(`EADPA Backend API running on http://localhost:${PORT}`);
    logger.info(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
    logger.info('Environment:', process.env.NODE_ENV || 'development');
  });
}

main().catch((error) => {
  logger.fatal(error, 'Failed to start server');
  process.exit(1);
});
