/**
 * Pipeline management routes
 */

import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { PipelineService } from '../services/pipeline';

export const pipelineRouter = Router();
const pipelineService = new PipelineService();

/** List all pipelines */
pipelineRouter.get('/', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { status, cloud, page = '1', limit = '20' } = req.query;

  const result = await pipelineService.listPipelines({
    workspaceId: authReq.user!.workspace_id,
    status: status as string,
    cloud: cloud as string,
    page: parseInt(page as string, 10),
    limit: parseInt(limit as string, 10),
  });

  res.json(result);
});

/** Get pipeline details */
pipelineRouter.get('/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const pipeline = await pipelineService.getPipeline(
    req.params.id,
    authReq.user!.workspace_id
  );

  if (!pipeline) {
    res.status(404).json({ error: 'Pipeline not found' });
    return;
  }

  res.json(pipeline);
});

/** Get pipeline YAML spec */
pipelineRouter.get('/:id/spec', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const spec = await pipelineService.getPipelineSpec(
    req.params.id,
    authReq.user!.workspace_id
  );

  res.type('text/yaml').send(spec);
});

/** Validate a pipeline YAML */
pipelineRouter.post('/validate', async (req: Request, res: Response) => {
  const { yaml_content } = req.body;
  const result = pipelineService.validatePipelineYAML(yaml_content);
  res.json(result);
});

/** Get generated code for a pipeline */
pipelineRouter.get('/:id/code', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { format = 'zip' } = req.query;

  const code = await pipelineService.getGeneratedCode(
    req.params.id,
    authReq.user!.workspace_id,
    format as string
  );

  if (format === 'zip') {
    res.type('application/zip').send(code);
  } else {
    res.json(code);
  }
});

/** Get pipeline lineage/dependency graph */
pipelineRouter.get('/:id/lineage', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const lineage = await pipelineService.getPipelineLineage(
    req.params.id,
    authReq.user!.workspace_id
  );

  res.json(lineage);
});
