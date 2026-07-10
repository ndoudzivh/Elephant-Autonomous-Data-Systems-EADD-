/**
 * EADD Output Quality Engine
 * 
 * The unified quality layer that wraps ALL agent outputs.
 * Every response passes through this before reaching the user.
 * 
 * Pipeline: Agent Output → Validate → Explain → Estimate → Deploy Instructions
 * 
 * Features:
 * 1. Code Accuracy: Catches and fixes common API mistakes
 * 2. Educational Explanations: Explains WHY every decision was made
 * 3. Step-by-Step Delivery: Breaks complex builds into layers
 * 4. Cost Estimates: Every pipeline gets a cost projection
 * 5. Deployment Instructions: Clear steps to get it running
 * 
 * This is what makes EADD output PRODUCTION-QUALITY, not toy-quality.
 */

export { CodeAccuracyValidator, fixCommonTypos } from './code-accuracy-validator';
export type { ValidationResult, ValidationIssue, CodeFramework } from './code-accuracy-validator';

export { EducationalExplainer, ARCHITECTURE_EXPLANATIONS, CODE_PATTERN_EXPLANATIONS } from './educational-explainer';
export type { Explanation, ExplanationLevel, ExplanationCategory } from './educational-explainer';

export { StepByStepBuilder, LAYER_DEFINITIONS } from './step-by-step-builder';
export type { BuildPlan, BuildStep, BuildLayer } from './step-by-step-builder';

export { PipelineCostEstimator } from './cost-estimator';
export type { CostEstimate, CostBreakdown, PipelineProfile } from './cost-estimator';

export { DeploymentInstructionGenerator } from './deployment-instructions';
export type { DeploymentGuide, DeployTarget, DeployMethod } from './deployment-instructions';

import { CodeAccuracyValidator, fixCommonTypos } from './code-accuracy-validator';
import { EducationalExplainer } from './educational-explainer';
import { StepByStepBuilder } from './step-by-step-builder';
import { PipelineCostEstimator } from './cost-estimator';
import { DeploymentInstructionGenerator } from './deployment-instructions';


// ============================================================
// UNIFIED OUTPUT QUALITY PIPELINE
// ============================================================

export interface QualityConfig {
  /** Enable code accuracy validation and auto-fixing */
  validateCode: boolean;
  /** Add educational explanations */
  addExplanations: boolean;
  /** User's knowledge level */
  explanationLevel: 'beginner' | 'intermediate' | 'expert';
  /** Break output into steps (for complex builds) */
  stepByStep: boolean;
  /** Include cost estimate */
  includeCostEstimate: boolean;
  /** Include deployment instructions */
  includeDeploymentInstructions: boolean;
}

export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  validateCode: true,
  addExplanations: true,
  explanationLevel: 'intermediate',
  stepByStep: true,
  includeCostEstimate: true,
  includeDeploymentInstructions: true,
};

export interface EnhancedOutput {
  /** The original agent output (potentially with code fixes) */
  content: string;
  /** Code validation results */
  codeValidation?: {
    issuesFixed: number;
    warningsAdded: number;
    fixDetails: string[];
  };
  /** Educational explanations added */
  explanations?: string[];
  /** Build plan (if step-by-step mode) */
  buildPlan?: {
    currentLayer: number;
    totalLayers: number;
    progressBar: string;
    confirmationNeeded: boolean;
  };
  /** Cost estimate */
  costEstimate?: string;
  /** Deployment instructions */
  deploymentInstructions?: string;
}

/**
 * The main quality enhancement pipeline.
 * Every agent output passes through this before reaching the user.
 */
export class OutputQualityPipeline {
  private validator = new CodeAccuracyValidator();
  private explainer = new EducationalExplainer();
  private stepBuilder = new StepByStepBuilder();
  private costEstimator = new PipelineCostEstimator();
  private deployGenerator = new DeploymentInstructionGenerator();
  private config: QualityConfig;

  constructor(config: QualityConfig = DEFAULT_QUALITY_CONFIG) {
    this.config = config;
    this.explainer.setLevel(config.explanationLevel);
  }

  /**
   * Enhance an agent's output with quality improvements
   */
  enhance(agentOutput: string, context: {
    pipelineName?: string;
    platform?: string;
    dailyVolumeGB?: number;
    frequency?: string;
    isComplexBuild?: boolean;
  }): EnhancedOutput {
    const result: EnhancedOutput = { content: agentOutput };

    // Step 1: Validate and fix code
    if (this.config.validateCode) {
      result.content = this.validateAndFixCode(result.content, result);
    }

    // Step 2: Add educational explanations
    if (this.config.addExplanations) {
      result.content = this.addExplanations(result.content, result);
    }

    // Step 3: Add cost estimate
    if (this.config.includeCostEstimate && context.pipelineName) {
      result.costEstimate = this.generateCostSection(context);
    }

    // Step 4: Add deployment instructions
    if (this.config.includeDeploymentInstructions && context.pipelineName && context.platform) {
      result.deploymentInstructions = this.generateDeploySection(
        context.pipelineName,
        context.platform as any
      );
    }

    return result;
  }

  private validateAndFixCode(content: string, result: EnhancedOutput): string {
    // Extract code blocks and validate each
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let fixed = content;
    let totalFixed = 0;
    let totalWarnings = 0;
    const fixDetails: string[] = [];

    fixed = content.replace(codeBlockRegex, (match, lang, code) => {
      // Fix common typos first
      let validatedCode = fixCommonTypos(code);
      
      // Then run framework-specific validation
      const validation = this.validator.validate(validatedCode);
      validatedCode = validation.fixedCode;
      
      totalFixed += validation.errors.filter(e => e.autoFixed).length;
      totalWarnings += validation.warnings.length;
      fixDetails.push(...validation.appliedFixes);

      return `\`\`\`${lang || ''}\n${validatedCode}\`\`\``;
    });

    if (totalFixed > 0 || totalWarnings > 0) {
      result.codeValidation = {
        issuesFixed: totalFixed,
        warningsAdded: totalWarnings,
        fixDetails,
      };
    }

    return fixed;
  }

  private addExplanations(content: string, result: EnhancedOutput): string {
    // Add inline code explanations
    const explained = this.explainer.explainCode(content, 'pyspark');
    result.explanations = [];
    return explained;
  }

  private generateCostSection(context: {
    pipelineName?: string;
    platform?: string;
    dailyVolumeGB?: number;
    frequency?: string;
  }): string {
    const profile = {
      dailyVolumeGB: context.dailyVolumeGB || 10,
      sourceTables: 5,
      frequency: (context.frequency as any) || 'daily',
      retentionMonths: 12,
      streaming: context.frequency === 'real_time',
      transformationComplexity: 'medium' as const,
      platform: (context.platform as any) || 'aws',
      region: 'us-east-1',
    };

    const estimate = this.costEstimator.estimate(profile, context.pipelineName || 'pipeline');
    return this.costEstimator.formatEstimate(estimate);
  }

  private generateDeploySection(pipelineName: string, platform: string): string {
    const targetMap: Record<string, any> = {
      aws: 'aws', azure: 'azure', gcp: 'gcp',
      databricks: 'databricks', snowflake: 'snowflake',
    };
    const target = targetMap[platform] || 'aws';
    const guide = this.deployGenerator.generate(pipelineName, target, 'terraform');
    return this.deployGenerator.formatGuide(guide);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<QualityConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.explanationLevel) {
      this.explainer.setLevel(updates.explanationLevel);
    }
  }
}
