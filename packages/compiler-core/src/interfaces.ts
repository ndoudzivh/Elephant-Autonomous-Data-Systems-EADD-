/**
 * Core interfaces that all compiler backends must implement.
 * This is the plugin contract — any cloud backend that satisfies
 * this interface can be registered and used interchangeably.
 */

import type { PipelineSpec, CloudProvider } from '@eadpa/shared';

/**
 * The main interface that every compiler backend must implement.
 * This is what "multi-cloud from day one" means architecturally.
 */
export interface CompilerBackend {
  /** Unique identifier for this backend */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Which cloud provider this backend targets */
  readonly provider: CloudProvider;
  /** Version of this backend */
  readonly version: string;
  /** Backend capabilities */
  readonly capabilities: CompilerCapabilities;

  /**
   * Compile a cloud-agnostic pipeline spec into
   * platform-specific code and configuration files.
   */
  compile(spec: PipelineSpec, options?: CompilerOptions): Promise<CompilationResult>;

  /**
   * Validate that a pipeline spec is compatible with this backend.
   * Returns backend-specific validation issues.
   */
  validate(spec: PipelineSpec): Promise<CompilationError[]>;

  /**
   * Generate a cost estimate for running this pipeline on the target platform.
   */
  estimateCost(spec: PipelineSpec): Promise<CostEstimation>;

  /**
   * Generate infrastructure-as-code (Terraform/CDK/Pulumi) for
   * the resources this pipeline needs.
   */
  generateInfrastructure(spec: PipelineSpec): Promise<GeneratedFile[]>;

  /**
   * Get metadata about what this backend generates.
   */
  getMetadata(): CompilerMetadata;
}

export interface CompilerCapabilities {
  /** Supported data formats */
  formats: string[];
  /** Supported load modes */
  loadModes: string[];
  /** Supported source types */
  sourceTypes: string[];
  /** Supports incremental loading */
  incremental: boolean;
  /** Supports SCD Type 2 */
  scd2: boolean;
  /** Supports streaming ingestion */
  streaming: boolean;
  /** Supports real-time/micro-batch */
  realtime: boolean;
  /** Supported orchestration engines */
  orchestrationEngines: string[];
}

export interface CompilerOptions {
  /** Output directory for generated files */
  outputDir?: string;
  /** Whether to include comments/documentation in generated code */
  includeComments?: boolean;
  /** Whether to generate tests alongside the code */
  generateTests?: boolean;
  /** Whether to include infrastructure-as-code */
  generateInfra?: boolean;
  /** Whether to generate CI/CD pipeline config */
  generateCICD?: boolean;
  /** Code style preferences */
  codeStyle?: CodeStyleOptions;
  /** Custom template overrides */
  templates?: Record<string, string>;
}

export interface CodeStyleOptions {
  indentation: 'spaces' | 'tabs';
  indentSize: number;
  lineWidth: number;
  quoteStyle: 'single' | 'double';
}

export interface CompilationResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Generated files */
  files: GeneratedFile[];
  /** Any errors encountered */
  errors: CompilationError[];
  /** Warnings (non-blocking) */
  warnings: CompilationWarning[];
  /** Metadata about the compilation */
  metadata: CompilationMetadata;
}

export interface GeneratedFile {
  /** Relative path within the output package */
  path: string;
  /** File content */
  content: string;
  /** File type for syntax highlighting */
  language: string;
  /** Whether this file is the main entry point */
  entryPoint?: boolean;
  /** Description of what this file does */
  description?: string;
  /** Whether this file should be executable */
  executable?: boolean;
}

export interface CompilationError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Which part of the spec caused the error */
  path?: string;
  /** Severity */
  severity: 'error' | 'warning';
  /** Suggested fix */
  suggestion?: string;
}

export interface CompilationWarning {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface CompilationMetadata {
  /** Backend used for compilation */
  backend: string;
  /** Backend version */
  backendVersion: string;
  /** Time taken to compile (ms) */
  durationMs: number;
  /** Number of files generated */
  fileCount: number;
  /** Total size of generated code (bytes) */
  totalSizeBytes: number;
  /** Target services used */
  targetServices: string[];
  /** Timestamp */
  compiledAt: string;
}

export interface CostEstimation {
  /** Estimated monthly cost in USD */
  monthlyEstimate: number;
  /** Cost per run in USD */
  perRunEstimate: number;
  /** Breakdown by service */
  breakdown: CostBreakdown[];
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
  /** Assumptions made */
  assumptions: string[];
}

export interface CostBreakdown {
  service: string;
  operation: string;
  monthly_usd: number;
  per_run_usd: number;
  notes?: string;
}

export interface CompilerMetadata {
  /** Backend identifier */
  id: string;
  /** Display name */
  name: string;
  /** Cloud provider */
  provider: CloudProvider;
  /** What services/tools this backend generates code for */
  targetServices: string[];
  /** File types generated */
  outputFormats: string[];
  /** Required configuration for deployment */
  requiredConfig: string[];
  /** Documentation URL */
  documentationUrl?: string;
}
