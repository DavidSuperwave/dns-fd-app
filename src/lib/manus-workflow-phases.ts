/**
 * Manus AI Workflow Phases
 * Defines the multi-phase workflow that happens in a single continuous task
 */

import {
  buildPhase1Prompt as buildPhase1PromptStandard,
  buildPhase2Prompt as buildPhase2PromptStandard,
  buildPhase3Prompt as buildPhase3PromptStandard,
  Phase1PromptData,
  Phase2PromptData,
  Phase3PromptData,
  PHASE_1_SCHEMA,
  PHASE_2_SCHEMA,
  PHASE_3_SCHEMA
} from './standardized-manus-prompts';

export type WorkflowPhase =
  | 'phase_1_company_report'
  | 'phase_2_icp_report'
  | 'phase_3_campaigns'
  | 'phase_4_optimization'
  | 'phase_5_final_optimization'
  | 'completed';

export interface WorkflowPhaseConfig {
  phase: WorkflowPhase;
  name: string;
  description: string;
  promptBuilder: (data: any) => string;
  nextPhase: WorkflowPhase | null;
}

const CORE_REFERENCE_DOCUMENTS = [
  'Complete_System_Workflow.doc',
  'PremiumPositioningStrategyEscapingtheCheapInboxesRace.doc',
];

// Re-export schemas for use in other parts of the app if needed
export { PHASE_1_SCHEMA, PHASE_2_SCHEMA, PHASE_3_SCHEMA };

/**
 * Phase 1: Client & Company Report Brief
 * Maps form fields to Manus AI parameters
 */
function buildPhase1Prompt(data: {
  clientName: string;
  domain: string;
  industry: string;
  offerService: string;
  pricing: string;
  targetMarket: string;
  goals: string;
  fileNames?: string[];
}): string {
  // Map legacy field names to standardized data structure
  const promptData: Phase1PromptData = {
    client_name: data.clientName,
    domain: data.domain,
    industry: data.industry,
    offer_description: data.offerService,
    pricing: data.pricing,
    target_market: data.targetMarket,
    goals: data.goals
  };

  return buildPhase1PromptStandard(promptData);
}

/**
 * Phase 2: ICP Report (uses Phase 1 Company Report)
 */
function buildPhase2Prompt(data: {
  companyReport: any; // The output from Phase 1
  numberOfICPs?: number; // Optional: how many ICPs to generate (Ignored in standardized prompt which enforces 3)
  icpCriteria?: string; // Optional: specific criteria for ICP selection (Ignored in standardized prompt)
}): string {

  const promptData: Phase2PromptData = {
    phase1Report: data.companyReport
  };

  return buildPhase2PromptStandard(promptData);
}

/**
 * Phase 3: Campaign Creation (uses Phase 1 & 2 reports)
 */
function buildPhase3Prompt(data: {
  companyReport: any;
  icpReport: any;
  targetSubNicheId?: string; // Optional: specific sub-niche to target
  numberOfAngles?: number; // Optional: how many angles to generate (Ignored in standardized prompt which enforces 3)
  angleCriteria?: string; // Optional: specific criteria for angles (Ignored in standardized prompt)
  selectedIcpIds?: string[]; // Optional: selected ICP IDs to focus on
}): string {

  // Default to the first sub-niche if not specified, or handle error
  // The standardized prompt requires a specific targetSubNicheId
  let targetSubNicheId = data.targetSubNicheId || 'sub_001a';

  // If selectedIcpIds is provided, we might need to filter or select a sub-niche from those
  // For now, we pass the data as is, assuming the caller provides a valid sub-niche ID

  const promptData: Phase3PromptData = {
    phase1Report: data.companyReport,
    phase2Report: data.icpReport,
    targetSubNicheId: targetSubNicheId
  };

  return buildPhase3PromptStandard(promptData);
}

/**
 * Phase 4: Optimization (uses campaign data from Vibe Plus)
 */
function buildPhase4Prompt(data: {
  companyReport: any;
  icpReport: any;
  campaigns: any;
  campaignData: any; // Performance data from Vibe Plus
}): string {
  return `## PHASE 4: CAMPAIGN OPTIMIZATION

Based on actual campaign performance data, optimize the campaigns.

### CONTEXT FROM PREVIOUS PHASES

**Company Report (Phase 1):**
${JSON.stringify(data.companyReport, null, 2)}

**ICP Report (Phase 2):**
${JSON.stringify(data.icpReport, null, 2)}

**Campaigns (Phase 3):**
${JSON.stringify(data.campaigns, null, 2)}

**Campaign Performance Data (from Vibe Plus):**
${JSON.stringify(data.campaignData, null, 2)}

### YOUR TASK - PHASE 4

Analyze the campaign performance data and provide optimization recommendations:

1. **Performance Analysis**
   - What's working well
   - What's underperforming
   - Key insights from the data

2. **Optimization Recommendations**
   - Messaging improvements
   - Targeting refinements
   - Timing and cadence adjustments
   - A/B test suggestions

3. **Scaling Opportunities**
   - Campaigns to scale up
   - New campaign ideas based on performance
   - Channel expansion opportunities

4. **Next Steps**
   - Immediate actions to take
   - Short-term optimizations
   - Long-term strategy adjustments

### OUTPUT FORMAT

Provide your optimization recommendations in structured JSON format.`;
}

/**
 * Phase 5: Final Optimization (advanced optimization)
 */
function buildPhase5Prompt(data: {
  companyReport: any;
  icpReport: any;
  campaigns: any;
  campaignData: any;
  optimizationResults: any; // Results from Phase 4
}): string {
  return `## PHASE 5: FINAL OPTIMIZATION & STRATEGY REFINEMENT

Based on optimization results from Phase 4, provide final strategic recommendations.

### CONTEXT FROM ALL PHASES

**Company Report (Phase 1):**
${JSON.stringify(data.companyReport, null, 2)}

**ICP Report (Phase 2):**
${JSON.stringify(data.icpReport, null, 2)}

**Campaigns (Phase 3):**
${JSON.stringify(data.campaigns, null, 2)}

**Campaign Performance Data:**
${JSON.stringify(data.campaignData, null, 2)}

**Optimization Results (Phase 4):**
${JSON.stringify(data.optimizationResults, null, 2)}

### YOUR TASK - PHASE 5

Provide final strategic recommendations:

1. **Final Campaign Strategy**
   - Refined campaign approach
   - Best-performing elements to double down on
   - Elements to eliminate or modify

2. **Long-term Growth Strategy**
   - Scaling recommendations
   - New market opportunities
   - Strategic pivots if needed

3. **Complete Workflow Summary**
   - Summary of all phases
   - Key learnings
   - Actionable next steps

### OUTPUT FORMAT

Provide your final recommendations in structured JSON format. This completes the Superwave workflow.`;
}

/**
 * Workflow phase configurations
 */
export const WORKFLOW_PHASES: Record<WorkflowPhase, WorkflowPhaseConfig> = {
  phase_1_company_report: {
    phase: 'phase_1_company_report',
    name: 'Company Report',
    description: 'Creating comprehensive company profile and market analysis',
    promptBuilder: buildPhase1Prompt,
    nextPhase: 'phase_2_icp_report',
  },
  phase_2_icp_report: {
    phase: 'phase_2_icp_report',
    name: 'ICP Report',
    description: 'Creating Ideal Customer Profile based on company report',
    promptBuilder: buildPhase2Prompt,
    nextPhase: 'phase_3_campaigns',
  },
  phase_3_campaigns: {
    phase: 'phase_3_campaigns',
    name: 'Campaign Creation',
    description: 'Creating targeted campaigns based on company and ICP reports',
    promptBuilder: buildPhase3Prompt,
    nextPhase: 'phase_4_optimization',
  },
  phase_4_optimization: {
    phase: 'phase_4_optimization',
    name: 'Campaign Optimization',
    description: 'Optimizing campaigns based on performance data',
    promptBuilder: buildPhase4Prompt,
    nextPhase: 'phase_5_final_optimization',
  },
  phase_5_final_optimization: {
    phase: 'phase_5_final_optimization',
    name: 'Final Optimization',
    description: 'Final strategic recommendations and workflow completion',
    promptBuilder: buildPhase5Prompt,
    nextPhase: 'completed',
  },
  completed: {
    phase: 'completed',
    name: 'Completed',
    description: 'Workflow completed',
    promptBuilder: () => '',
    nextPhase: null,
  },
};

/**
 * Map workflow phases to database workflow_status values
 */
export function mapPhaseToWorkflowStatus(phase: WorkflowPhase): string {
  const mapping: Record<WorkflowPhase, string> = {
    phase_1_company_report: 'generating',
    phase_2_icp_report: 'creating_report',
    phase_3_campaigns: 'validating_report',
    phase_4_optimization: 'finding_competitors',
    phase_5_final_optimization: 'finding_competitors', // Reuse status
    completed: 'completed',
  };
  return mapping[phase] || 'pending';
}

