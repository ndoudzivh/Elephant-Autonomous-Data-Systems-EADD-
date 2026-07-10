/**
 * EADD Response Enhancer Service
 * 
 * The unified middleware that processes ALL agent outputs through the
 * Output Quality Pipeline before they reach the user.
 * 
 * Pipeline: Raw LLM Output → Code Validation → Explanations → Cost → Deploy
 * 
 * This integrates the agents/output-quality modules into the backend.
 */

import { fixCommonTypos } from './quality/code-validator';
import { generateEducationalNotes } from './quality/educational-notes';
import { generateCostSection } from './quality/cost-section';
import { generateDeploySection } from './quality/deploy-section';
import { generateLakehouseContext } from './quality/lakehouse-layers';

export interface EnhancementConfig {
  validateCode: boolean;
  addExplanations: boolean;
  includeCostEstimate: boolean;
  includeDeploymentInstructions: boolean;
  includeLakehouseContext: boolean;
  explanationLevel: 'beginner' | 'intermediate' | 'expert';
}

export const DEFAULT_CONFIG: EnhancementConfig = {
  validateCode: true,
  addExplanations: true,
  includeCostEstimate: true,
  includeDeploymentInstructions: true,
  includeLakehouseContext: true,
  explanationLevel: 'intermediate',
};

export interface EnhancementContext {
  pipelineName?: string;
  platform?: string;
  dailyVolumeGB?: number;
  frequency?: string;
  userMessage?: string;
  isComplexBuild?: boolean;
}


/**
 * Main response enhancement function.
 * Called after the LLM generates its full response, before final delivery.
 */
export function enhanceResponse(
  rawOutput: string,
  context: EnhancementContext,
  config: EnhancementConfig = DEFAULT_CONFIG
): string {
  let enhanced = rawOutput;

  // Step 1: Fix code accuracy (typos, wrong APIs)
  if (config.validateCode) {
    enhanced = fixCommonTypos(enhanced);
  }

  // Step 2: Add educational mentor notes (inline)
  if (config.addExplanations) {
    enhanced = generateEducationalNotes(enhanced, config.explanationLevel);
  }

  // Step 3: Add Lakehouse Bronze/Silver/Gold context if pipeline-related
  if (config.includeLakehouseContext && isPipelineRelated(context)) {
    const lakehouseSection = generateLakehouseContext(context);
    if (lakehouseSection) {
      enhanced = enhanced + '\n\n' + lakehouseSection;
    }
  }

  // Step 4: Append cost estimate section
  if (config.includeCostEstimate && context.pipelineName) {
    const costSection = generateCostSection(context);
    enhanced = enhanced + '\n\n' + costSection;
  }

  // Step 5: Append deployment instructions
  if (config.includeDeploymentInstructions && context.platform) {
    const deploySection = generateDeploySection(context);
    enhanced = enhanced + '\n\n' + deploySection;
  }

  return enhanced;
}

function isPipelineRelated(context: EnhancementContext): boolean {
  const msg = (context.userMessage || '').toLowerCase();
  return !!(
    context.pipelineName ||
    msg.includes('pipeline') ||
    msg.includes('ingest') ||
    msg.includes('etl') ||
    msg.includes('transform') ||
    msg.includes('lakehouse') ||
    msg.includes('medallion') ||
    msg.includes('bronze') ||
    msg.includes('silver') ||
    msg.includes('gold')
  );
}
