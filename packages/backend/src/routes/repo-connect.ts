/**
 * EADD Repository Connection Routes
 * 
 * Allows users to connect GitHub/GitLab repositories to EADD
 * for automated pipeline analysis, schema discovery, and CI/CD integration.
 * 
 * Endpoints:
 * - POST /repos/connect     — Connect a repository (GitHub/GitLab)
 * - GET  /repos             — List connected repositories
 * - GET  /repos/:id         — Get repo details + discovered schemas
 * - POST /repos/:id/scan    — Trigger schema/pipeline scan
 * - DELETE /repos/:id       — Disconnect a repository
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const repoConnectRouter = Router();

// ============================================================
// TYPES
// ============================================================

interface ConnectedRepo {
  id: string;
  userId: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  connectedAt: string;
  lastScanAt?: string;
  status: 'connected' | 'scanning' | 'error';
  discoveredPipelines: DiscoveredPipeline[];
  discoveredSchemas: DiscoveredSchema[];
}

interface DiscoveredPipeline {
  path: string;
  type: 'airflow_dag' | 'dbt_project' | 'spark_job' | 'glue_job' | 'sql_script';
  name: string;
}

interface DiscoveredSchema {
  path: string;
  format: 'sql_ddl' | 'json_schema' | 'avro' | 'protobuf' | 'yaml';
  tables: string[];
}


// In-memory store (production: DynamoDB)
const connectedRepos: Map<string, ConnectedRepo> = new Map();

// ============================================================
// ENDPOINTS
// ============================================================

/**
 * POST /repos/connect
 * Connect a GitHub/GitLab repository to EADD
 */
repoConnectRouter.post('/connect', async (req: Request, res: Response) => {
  const { provider, owner, name, access_token, branch } = req.body;

  if (!provider || !owner || !name) {
    res.status(400).json({
      error: 'provider, owner, and name are required',
      example: {
        provider: 'github',
        owner: 'ndoudzivh',
        name: 'my-data-repo',
        branch: 'main',
      },
    });
    return;
  }

  // Validate provider
  if (!['github', 'gitlab', 'bitbucket'].includes(provider)) {
    res.status(400).json({
      error: 'provider must be one of: github, gitlab, bitbucket',
    });
    return;
  }

  const repoId = uuidv4();
  const fullName = `${owner}/${name}`;
  const cloneUrl = provider === 'github'
    ? `https://github.com/${fullName}.git`
    : provider === 'gitlab'
    ? `https://gitlab.com/${fullName}.git`
    : `https://bitbucket.org/${fullName}.git`;

  const repo: ConnectedRepo = {
    id: repoId,
    userId: (req as any).user?.id || 'anonymous',
    provider,
    owner,
    name,
    fullName,
    defaultBranch: branch || 'main',
    cloneUrl,
    connectedAt: new Date().toISOString(),
    status: 'connected',
    discoveredPipelines: [],
    discoveredSchemas: [],
  };

  connectedRepos.set(repoId, repo);

  res.status(201).json({
    status: 'connected',
    repo,
    message: `✅ Repository ${fullName} connected successfully. Run POST /repos/${repoId}/scan to discover pipelines and schemas.`,
  });
});


/**
 * GET /repos
 * List all connected repositories for the current user
 */
repoConnectRouter.get('/', (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  const userRepos = Array.from(connectedRepos.values())
    .filter(r => r.userId === userId);

  res.json({
    repos: userRepos,
    count: userRepos.length,
  });
});

/**
 * GET /repos/:id
 * Get details of a specific connected repository
 */
repoConnectRouter.get('/:id', (req: Request, res: Response) => {
  const repo = connectedRepos.get(req.params.id);
  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  res.json({ repo });
});

/**
 * POST /repos/:id/scan
 * Trigger a scan of the repository to discover pipelines, schemas, etc.
 */
repoConnectRouter.post('/:id/scan', async (req: Request, res: Response) => {
  const repo = connectedRepos.get(req.params.id);
  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }

  repo.status = 'scanning';

  // Simulate scanning (in production: clone repo, analyze files)
  // This would use git clone + file pattern matching
  const scanResults = await simulateRepoScan(repo);

  repo.discoveredPipelines = scanResults.pipelines;
  repo.discoveredSchemas = scanResults.schemas;
  repo.lastScanAt = new Date().toISOString();
  repo.status = 'connected';

  res.json({
    status: 'scan_complete',
    discovered: {
      pipelines: scanResults.pipelines.length,
      schemas: scanResults.schemas.length,
      details: scanResults,
    },
    message: `✅ Found ${scanResults.pipelines.length} pipelines and ${scanResults.schemas.length} schema definitions.`,
  });
});

/**
 * DELETE /repos/:id
 * Disconnect a repository
 */
repoConnectRouter.delete('/:id', (req: Request, res: Response) => {
  const existed = connectedRepos.delete(req.params.id);
  if (!existed) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  res.json({ status: 'disconnected', message: 'Repository removed from EADD.' });
});


// ============================================================
// SCAN SIMULATION (production: actual git clone + file analysis)
// ============================================================

async function simulateRepoScan(repo: ConnectedRepo): Promise<{
  pipelines: DiscoveredPipeline[];
  schemas: DiscoveredSchema[];
}> {
  // In production, this would:
  // 1. Clone the repo (shallow, specific branch)
  // 2. Walk the file tree looking for known patterns
  // 3. Parse discovered files for metadata

  // File pattern detection rules:
  const pipelinePatterns = [
    { glob: '**/dags/**/*.py', type: 'airflow_dag' as const },
    { glob: '**/dbt_project.yml', type: 'dbt_project' as const },
    { glob: '**/*_spark*.py', type: 'spark_job' as const },
    { glob: '**/*_glue*.py', type: 'glue_job' as const },
    { glob: '**/sql/**/*.sql', type: 'sql_script' as const },
  ];

  const schemaPatterns = [
    { glob: '**/*.ddl', format: 'sql_ddl' as const },
    { glob: '**/schema*.json', format: 'json_schema' as const },
    { glob: '**/*.avsc', format: 'avro' as const },
    { glob: '**/*.proto', format: 'protobuf' as const },
  ];

  // Simulated results
  return {
    pipelines: [
      { path: 'dags/ingest_customers.py', type: 'airflow_dag', name: 'ingest_customers' },
      { path: 'dbt/models/staging/stg_orders.sql', type: 'dbt_project', name: 'stg_orders' },
    ],
    schemas: [
      { path: 'schemas/customers.json', format: 'json_schema', tables: ['customers'] },
      { path: 'sql/ddl/create_tables.sql', format: 'sql_ddl', tables: ['orders', 'products'] },
    ],
  };
}
