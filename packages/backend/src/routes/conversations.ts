/**
 * Conversation routes - ChatGPT/Claude-like conversation management
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ConversationService } from '../services/conversation';

export const conversationRouter = Router();
const conversationService = new ConversationService();

/** List all conversations for the current user */
conversationRouter.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { page = '1', limit = '20', search } = req.query;

  const result = await conversationService.listConversations({
    userId: authReq.user!.id,
    workspaceId: authReq.user!.workspace_id,
    page: parseInt(page as string, 10),
    limit: parseInt(limit as string, 10),
    search: search as string | undefined,
  });

  res.json(result);
});

/** Get a single conversation with messages */
conversationRouter.get('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const conversation = await conversationService.getConversation(
    req.params.id,
    authReq.user!.id
  );

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json(conversation);
});

/** Create a new conversation */
conversationRouter.post('/', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { title, pipeline_context } = req.body;

  const conversation = await conversationService.createConversation({
    userId: authReq.user!.id,
    workspaceId: authReq.user!.workspace_id,
    title: title || 'New Pipeline',
    pipelineContext: pipeline_context,
  });

  res.status(201).json(conversation);
});

/** Update conversation (rename, pin, archive) */
conversationRouter.patch('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { title, pinned, starred, status, tags } = req.body;

  const conversation = await conversationService.updateConversation(
    req.params.id,
    authReq.user!.id,
    { title, pinned, starred, status, tags }
  );

  res.json(conversation);
});

/** Delete a conversation */
conversationRouter.delete('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  await conversationService.deleteConversation(
    req.params.id,
    authReq.user!.id
  );
  res.status(204).send();
});

/** Fork a conversation (branch from a specific message) */
conversationRouter.post('/:id/fork', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { from_message_id } = req.body;

  const forked = await conversationService.forkConversation(
    req.params.id,
    authReq.user!.id,
    from_message_id
  );

  res.status(201).json(forked);
});
