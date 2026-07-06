/**
 * Execution routes - run, approve, monitor pipelines
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ExecutionService } from '../services/execution';

export const executionRouter = Router();
const executionService = new ExecutionService();

/** List executions for a pipeline */
executionRouter.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { pipeline_id, status, environment } = req.query;

  const result = await executionService.listExecutions({
    workspaceId: authReq.user!.workspace_id,
    pipelineId: pipeline_id as string,
    status: status as string,
    environment: environment as string,
  });

  res.json(result);
});

/** Get execution details */
executionRouter.get('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const execution = await executionService.getExecution(
    req.params.id,
    authReq.user!.workspace_id
  );

  if (!execution) {
    res.status(404).json({ error: 'Execution not found' });
    return;
  }

  res.json(execution);
});

/** Trigger a sandbox execution (no approval needed) */
executionRouter.post('/sandbox', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { pipeline_id, sample_data } = req.body;

  const execution = await executionService.executeSandbox({
    pipelineId: pipeline_id,
    userId: authReq.user!.id,
    workspaceId: authReq.user!.workspace_id,
    sampleData: sample_data,
  });

  res.status(201).json(execution);
});

/** Request production execution (triggers approval flow) */
executionRouter.post('/production', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { pipeline_id, environment, reason } = req.body;

  const execution = await executionService.requestProductionExecution({
    pipelineId: pipeline_id,
    userId: authReq.user!.id,
    workspaceId: authReq.user!.workspace_id,
    environment: environment || 'production',
    reason,
  });

  res.status(201).json(execution);
});

/** Approve a pending execution */
executionRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { comment } = req.body;

  const execution = await executionService.approveExecution(
    req.params.id,
    authReq.user!.id,
    comment
  );

  res.json(execution);
});

/** Reject a pending execution */
executionRouter.post('/:id/reject', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { reason } = req.body;

  const execution = await executionService.rejectExecution(
    req.params.id,
    authReq.user!.id,
    reason
  );

  res.json(execution);
});

/** Cancel a running execution */
executionRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  await executionService.cancelExecution(
    req.params.id,
    authReq.user!.id
  );

  res.json({ status: 'cancelled' });
});

/** Get execution timeline events (for real-time UI) */
executionRouter.get('/:id/timeline', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const timeline = await executionService.getTimeline(
    req.params.id,
    authReq.user!.workspace_id
  );

  res.json(timeline);
});
