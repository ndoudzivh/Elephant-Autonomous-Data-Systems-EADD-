/**
 * EADD File Upload Routes
 * 
 * Allows users to upload data files (CSV, JSON, Parquet, SQL, YAML)
 * for schema discovery, profiling, and pipeline generation.
 * 
 * Use cases:
 * - Upload a CSV → auto-discover schema → generate pipeline
 * - Upload a SQL DDL → parse tables → generate quality checks
 * - Upload a pipeline YAML → validate and compile to target platform
 * - Upload sample data → profile and suggest transformations
 * 
 * Endpoints:
 * - POST /files/upload         — Upload a file
 * - GET  /files                — List uploaded files
 * - GET  /files/:id            — Get file metadata + discovered schema
 * - POST /files/:id/profile    — Run data profiling on uploaded file
 * - POST /files/:id/generate   — Generate pipeline from file schema
 * - DELETE /files/:id          — Delete uploaded file
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const fileUploadRouter = Router();

// ============================================================
// TYPES
// ============================================================

interface UploadedFile {
  id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  format: FileFormat;
  uploadedAt: string;
  status: 'uploaded' | 'profiling' | 'profiled' | 'error';
  /** Base64 content (dev) or S3 key (prod) */
  storageKey: string;
  /** Discovered schema from the file */
  schema?: DiscoveredFileSchema;
  /** Data profile results */
  profile?: DataProfile;
}


type FileFormat = 'csv' | 'json' | 'parquet' | 'sql' | 'yaml' | 'avro' | 'excel' | 'unknown';

interface DiscoveredFileSchema {
  columns: SchemaColumn[];
  rowCount?: number;
  sampleRows?: Record<string, unknown>[];
}

interface SchemaColumn {
  name: string;
  inferredType: string;
  nullable: boolean;
  distinctCount?: number;
  nullCount?: number;
  sampleValues?: string[];
}

interface DataProfile {
  totalRows: number;
  totalColumns: number;
  completeness: number;  // 0-100%
  columns: ColumnProfile[];
  recommendations: string[];
}

interface ColumnProfile {
  name: string;
  type: string;
  nullPercent: number;
  uniquePercent: number;
  min?: string;
  max?: string;
  mean?: number;
  topValues?: Array<{ value: string; count: number }>;
}

// In-memory store (production: DynamoDB + S3)
const uploadedFiles: Map<string, UploadedFile> = new Map();

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types
const ALLOWED_FORMATS: FileFormat[] = ['csv', 'json', 'parquet', 'sql', 'yaml', 'avro', 'excel'];


// ============================================================
// ENDPOINTS
// ============================================================

/**
 * POST /files/upload
 * Upload a data file for schema discovery and profiling.
 * Accepts multipart/form-data or base64 JSON body.
 */
fileUploadRouter.post('/upload', async (req: Request, res: Response) => {
  const { filename, content_base64, mime_type } = req.body;

  if (!filename || !content_base64) {
    res.status(400).json({
      error: 'filename and content_base64 are required',
      example: {
        filename: 'customers.csv',
        content_base64: 'aWQsIG5hbWUsIGVtYWls...',
        mime_type: 'text/csv',
      },
      supported_formats: ALLOWED_FORMATS,
      max_size_mb: MAX_FILE_SIZE / (1024 * 1024),
    });
    return;
  }

  // Determine format from extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const format = detectFormat(ext, mime_type);

  if (format === 'unknown') {
    res.status(400).json({
      error: `Unsupported file format: .${ext}`,
      supported: ALLOWED_FORMATS,
    });
    return;
  }

  // Decode and check size
  const buffer = Buffer.from(content_base64, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    res.status(413).json({
      error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
    });
    return;
  }

  const fileId = uuidv4();
  const file: UploadedFile = {
    id: fileId,
    userId: (req as any).user?.id || 'anonymous',
    originalName: filename,
    mimeType: mime_type || 'application/octet-stream',
    sizeBytes: buffer.length,
    format,
    uploadedAt: new Date().toISOString(),
    status: 'uploaded',
    storageKey: `uploads/${fileId}/${filename}`,
  };

  // Auto-discover schema for CSV/JSON
  if (format === 'csv' || format === 'json') {
    const content = buffer.toString('utf-8');
    file.schema = discoverSchema(content, format);
    file.status = 'profiled';
  }

  uploadedFiles.set(fileId, file);

  res.status(201).json({
    status: 'uploaded',
    file: {
      id: file.id,
      name: file.originalName,
      format: file.format,
      size: `${(file.sizeBytes / 1024).toFixed(1)}KB`,
      schema: file.schema,
    },
    next_steps: [
      `GET /files/${fileId} — View discovered schema`,
      `POST /files/${fileId}/profile — Run full data profiling`,
      `POST /files/${fileId}/generate — Generate pipeline from this file`,
    ],
    message: `✅ File "${filename}" uploaded. ${file.schema ? `Discovered ${file.schema.columns.length} columns.` : 'Ready for profiling.'}`,
  });
});


/**
 * GET /files
 * List all uploaded files for the current user
 */
fileUploadRouter.get('/', (req: Request, res: Response) => {
  const userId = (req as any).user?.id || 'anonymous';
  const userFiles = Array.from(uploadedFiles.values())
    .filter(f => f.userId === userId)
    .map(f => ({
      id: f.id,
      name: f.originalName,
      format: f.format,
      size: `${(f.sizeBytes / 1024).toFixed(1)}KB`,
      status: f.status,
      uploadedAt: f.uploadedAt,
      columns: f.schema?.columns.length || 0,
    }));

  res.json({ files: userFiles, count: userFiles.length });
});

/**
 * GET /files/:id
 * Get file details including discovered schema
 */
fileUploadRouter.get('/:id', (req: Request, res: Response) => {
  const file = uploadedFiles.get(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json({
    file: {
      id: file.id,
      name: file.originalName,
      format: file.format,
      size: `${(file.sizeBytes / 1024).toFixed(1)}KB`,
      status: file.status,
      schema: file.schema,
      profile: file.profile,
    },
  });
});

/**
 * POST /files/:id/profile
 * Run data profiling on an uploaded file
 */
fileUploadRouter.post('/:id/profile', async (req: Request, res: Response) => {
  const file = uploadedFiles.get(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  file.status = 'profiling';

  // Generate profile (simulated — production uses pandas/spark)
  const profile = generateProfile(file);
  file.profile = profile;
  file.status = 'profiled';

  res.json({
    status: 'profiled',
    profile,
    message: `✅ Profiled "${file.originalName}": ${profile.totalRows} rows, ${profile.totalColumns} columns, ${profile.completeness.toFixed(1)}% complete.`,
  });
});


/**
 * POST /files/:id/generate
 * Generate a pipeline spec from the uploaded file's schema
 */
fileUploadRouter.post('/:id/generate', async (req: Request, res: Response) => {
  const file = uploadedFiles.get(req.params.id);
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const { target_platform, pipeline_name } = req.body;

  if (!file.schema) {
    res.status(400).json({
      error: 'File has no discovered schema. Run POST /files/:id/profile first.',
    });
    return;
  }

  const pipelineName = pipeline_name || file.originalName.replace(/\.[^.]+$/, '');
  const platform = target_platform || 'aws';

  // Generate a pipeline YAML from the discovered schema
  const pipelineYaml = generatePipelineFromSchema(file, pipelineName, platform);

  res.json({
    status: 'generated',
    pipeline: {
      name: pipelineName,
      platform,
      yaml: pipelineYaml,
    },
    message: `✅ Generated "${pipelineName}" pipeline targeting ${platform.toUpperCase()} from ${file.originalName}.`,
    next_steps: [
      'Review the generated YAML',
      'Send to /agent/chat to compile to platform code',
      'Or modify and deploy directly',
    ],
  });
});

/**
 * DELETE /files/:id
 * Delete an uploaded file
 */
fileUploadRouter.delete('/:id', (req: Request, res: Response) => {
  const existed = uploadedFiles.delete(req.params.id);
  if (!existed) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json({ status: 'deleted', message: 'File removed.' });
});


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function detectFormat(ext: string, mimeType?: string): FileFormat {
  const extMap: Record<string, FileFormat> = {
    csv: 'csv', tsv: 'csv',
    json: 'json', jsonl: 'json', ndjson: 'json',
    parquet: 'parquet', pq: 'parquet',
    sql: 'sql', ddl: 'sql',
    yaml: 'yaml', yml: 'yaml',
    avro: 'avro', avsc: 'avro',
    xlsx: 'excel', xls: 'excel',
  };
  return extMap[ext] || 'unknown';
}

function discoverSchema(content: string, format: FileFormat): DiscoveredFileSchema {
  if (format === 'csv') {
    return discoverCSVSchema(content);
  }
  if (format === 'json') {
    return discoverJSONSchema(content);
  }
  return { columns: [] };
}

function discoverCSVSchema(content: string): DiscoveredFileSchema {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { columns: [], rowCount: 0 };

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  // Sample first 100 rows to infer types
  const sampleRows = lines.slice(1, 101);
  const columns: SchemaColumn[] = headers.map((name, idx) => {
    const values = sampleRows.map(row => {
      const cells = row.split(',');
      return cells[idx]?.trim().replace(/^["']|["']$/g, '') || '';
    });

    return {
      name,
      inferredType: inferType(values),
      nullable: values.some(v => !v || v.toLowerCase() === 'null' || v === 'na'),
      distinctCount: new Set(values).size,
      nullCount: values.filter(v => !v || v.toLowerCase() === 'null').length,
      sampleValues: values.slice(0, 5),
    };
  });

  return {
    columns,
    rowCount: lines.length - 1,
    sampleRows: sampleRows.slice(0, 3).map(row => {
      const cells = row.split(',');
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => { obj[h] = cells[i]?.trim(); });
      return obj;
    }),
  };
}

function discoverJSONSchema(content: string): DiscoveredFileSchema {
  try {
    let data: any[];
    
    // Handle JSON array or JSONL
    if (content.trim().startsWith('[')) {
      data = JSON.parse(content);
    } else {
      data = content.split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l));
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { columns: [], rowCount: 0 };
    }

    // Discover columns from first 100 rows
    const sample = data.slice(0, 100);
    const allKeys = new Set<string>();
    sample.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

    const columns: SchemaColumn[] = Array.from(allKeys).map(name => {
      const values = sample.map(row => String(row[name] ?? ''));
      return {
        name,
        inferredType: inferType(values),
        nullable: sample.some(row => row[name] == null),
        distinctCount: new Set(values).size,
        sampleValues: values.slice(0, 5),
      };
    });

    return {
      columns,
      rowCount: data.length,
      sampleRows: data.slice(0, 3),
    };
  } catch {
    return { columns: [], rowCount: 0 };
  }
}


function inferType(values: string[]): string {
  const nonNull = values.filter(v => v && v.toLowerCase() !== 'null' && v !== 'na');
  if (nonNull.length === 0) return 'string';

  // Check integer
  if (nonNull.every(v => /^-?\d+$/.test(v))) return 'integer';
  // Check decimal
  if (nonNull.every(v => /^-?\d+\.\d+$/.test(v))) return 'decimal';
  // Check boolean
  if (nonNull.every(v => /^(true|false|0|1|yes|no)$/i.test(v))) return 'boolean';
  // Check date
  if (nonNull.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'timestamp';
  // Check email
  if (nonNull.every(v => /@/.test(v))) return 'string (email)';

  return 'string';
}

function generateProfile(file: UploadedFile): DataProfile {
  const schema = file.schema;
  if (!schema) {
    return {
      totalRows: 0,
      totalColumns: 0,
      completeness: 0,
      columns: [],
      recommendations: ['Upload a CSV or JSON file for auto-profiling'],
    };
  }

  const columns: ColumnProfile[] = schema.columns.map(col => ({
    name: col.name,
    type: col.inferredType,
    nullPercent: col.nullCount
      ? Math.round((col.nullCount / (schema.rowCount || 1)) * 100)
      : 0,
    uniquePercent: col.distinctCount
      ? Math.round((col.distinctCount / (schema.rowCount || 1)) * 100)
      : 0,
    topValues: col.sampleValues?.map(v => ({ value: v, count: 1 })),
  }));

  const totalNulls = columns.reduce((sum, c) => sum + c.nullPercent, 0);
  const completeness = 100 - (totalNulls / columns.length);

  const recommendations: string[] = [];
  columns.forEach(col => {
    if (col.nullPercent > 20) {
      recommendations.push(`⚠️ Column "${col.name}" has ${col.nullPercent}% nulls — consider default value or filtering`);
    }
    if (col.uniquePercent === 100) {
      recommendations.push(`🔑 Column "${col.name}" has 100% unique values — potential primary key`);
    }
    if (col.type === 'string (email)') {
      recommendations.push(`🔐 Column "${col.name}" contains emails — apply PII masking in Silver layer`);
    }
  });

  return {
    totalRows: schema.rowCount || 0,
    totalColumns: schema.columns.length,
    completeness,
    columns,
    recommendations,
  };
}

function generatePipelineFromSchema(
  file: UploadedFile,
  name: string,
  platform: string
): string {
  const cols = file.schema?.columns || [];
  const colDefs = cols.map(c => `      - name: ${c.name}\n        type: ${c.inferredType}\n        nullable: ${c.nullable}`).join('\n');

  return `# Auto-generated by EADD from: ${file.originalName}
# Generated: ${new Date().toISOString()}

name: ${name}
version: "1.0"
description: "Pipeline generated from uploaded file ${file.originalName}"

metadata:
  owner: user
  tags: [auto-generated, file-upload]
  schedule: daily

source:
  type: file
  format: ${file.format}
  location: "${file.storageKey}"
  schema:
    columns:
${colDefs}

layers:
  bronze:
    format: delta
    load_mode: append
    partition_by: _ingestion_date
    
  silver:
    format: delta
    load_mode: merge
    merge_key: ${cols[0]?.name || 'id'}
    transformations:
      - deduplicate_on: [${cols[0]?.name || 'id'}]
      - cast_types: true
      - handle_nulls: default_or_reject
      
  gold:
    format: delta
    load_mode: overwrite
    models:
      - name: ${name}_summary
        type: aggregation

quality:
  checks:
    - type: not_null
      columns: [${cols.filter(c => !c.nullable).map(c => c.name).join(', ')}]
    - type: unique
      columns: [${cols[0]?.name || 'id'}]
    - type: row_count
      min: 1

target:
  cloud: ${platform}
  region: us-east-1
`;
}
