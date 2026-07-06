/**
 * Agent routes - The core chat/reasoning endpoint
 * Handles message sending with streaming responses
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AgentOrchestrator } from '../services/orchestrator';
import { StreamManager } from '../services/stream-manager';

export const agentRouter = Router();
const orchestrator = new AgentOrchestrator();

/**
 * Send a message to the agent (streaming response via SSE)
 * This is the main endpoint - similar to ChatGPT's /conversation endpoint
 */
agentRouter.post('/chat', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const {
    conversation_id,
    message,
    attachments,
    model_preferences,
  } = req.body;

  if (!message || !conversation_id) {
    res.status(400).json({
      error: 'conversation_id and message are required',
    });
    return;
  }

  // Set up Server-Sent Events for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = orchestrator.processMessage({
      conversationId: conversation_id,
      userId: authReq.user!.id,
      workspaceId: authReq.user!.workspace_id,
      message,
      attachments,
      modelPreferences: model_preferences,
    });

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // Flush the response
      if ((res as any).flush) {
        (res as any).flush();
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    // If streaming hasn't started, send error as JSON
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        code: 'STREAM_ERROR',
        message: error.message,
      })}\n\n`);
      res.end();
    }
  }
});

/** Stop/cancel a running agent response */
agentRouter.post('/stop', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { conversation_id, message_id } = req.body;

  await orchestrator.cancelGeneration(
    conversation_id,
    message_id,
    authReq.user!.id
  );

  res.json({ status: 'cancelled' });
});

/** Regenerate the last assistant response */
agentRouter.post('/regenerate', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { conversation_id, message_id } = req.body;

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = orchestrator.regenerateResponse({
    conversationId: conversation_id,
    messageId: message_id,
    userId: authReq.user!.id,
    workspaceId: authReq.user!.workspace_id,
  });

  for await (const event of stream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  res.write(`data: [DONE]\n\n`);
  res.end();
});

/** Get agent capabilities */
agentRouter.get('/capabilities', (req: Request, res: Response) => {
  res.json({
    capabilities: orchestrator.getCapabilities(),
    model: {
      provider: 'aws_bedrock',
      model_id: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-sonnet-4-20250514',
      max_tokens: 8192,
    },
  });
});

/** Provide feedback on agent response */
agentRouter.post('/feedback', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { message_id, rating, comment, categories } = req.body;

  await orchestrator.recordFeedback({
    messageId: message_id,
    userId: authReq.user!.id,
    rating,
    comment,
    categories,
  });

  res.json({ status: 'recorded' });
});
