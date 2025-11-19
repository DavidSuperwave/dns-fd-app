// standardized-manus-prompts.ts

/**
 * This file contains the standardized, error-proof prompts and schemas for the 3 core phases of your workflow.
 * 
 * KEY FIXES:
 * 1.  **Strict JSON Schema in Prompt**: The JSON schema is now passed directly into every prompt, forcing the AI to follow the exact structure.
 * 2.  **Imperative Instructions**: Prompts are direct and command-based, not conversational, which reduces variability.
 * 3.  **Critical Output Requirements**: A clear, non-negotiable block at the top of each prompt ensures ONLY valid JSON is returned.
 * 4.  **Generic & Reusable**: All prompts and schemas are company-agnostic and work for any input.
 * 5.  **Clean Code**: Schemas are defined as TypeScript objects for type safety and maintainability, not as giant, unreadable strings.
 */

// =====================================================================================
// PHASE 1: COMPANY REPORT
// =====================================================================================

/**
 * The definitive, standardized JSON schema for the Phase 1 Company Report.
 * Your web app should be built to parse this exact structure.
 */
export const PHASE_1_SCHEMA = {
  client_offer_brief: {
    title: "Client & Offer Brief",
    company_name: "string",
    company_url: "string",
    tagline: "string",
    summary: "string",
    offer: {
      name: "string",
      description: "string",
      pricing_model: "string",
      target_audience: "string",
    },
  },
  market_competitive_analysis: {
    title: "Market & Competitive Analysis",
    market_overview: {
      primary_niche: "string",
      market_size_usd: "string",
      market_growth_cagr: "string",
      market_trends: ["string"],
    },
    competitive_landscape: {
      summary: "string",
      direct_competitors: [
        {
          name: "string",
          positioning: "string",
          url: "string",
        },
      ],
      indirect_competitors: [
        {
          name: "string",
          description: "string",
        },
      ],
    },
  },
  core_value_proposition: {
    title: "Core Value Proposition",
    summary: "string",
    target_buyer_persona: {
      primary_title: "string",
      secondary_titles: ["string"],
      pains: ["string"],
      gains: ["string"],
    },
    messaging_pillars: [
      {
        pillar_name: "string",
        description: "string",
        value_prop: "string",
      },
    ],
    key_differentiators: ["string"],
  },
};

/**
 * Input data structure for the Phase 1 prompt builder.
 * This should match the fields from your web form.
 */
export interface Phase1PromptData {
  client_name: string;
  domain: string;
  industry: string;
  offer_description: string;
  pricing: string;
  target_market: string;
  goals: string;
}

/**
 * Builds the standardized, error-proof prompt for Phase 1.
 */
export function buildPhase1Prompt(data: Phase1PromptData): string {
  return `
**CRITICAL OUTPUT REQUIREMENTS:**
1.  You MUST return ONLY a valid JSON object that strictly follows the provided schema.
2.  Do NOT include markdown code fences (\`\`\`json), any explanatory text, or any other characters before or after the JSON object.
3.  The entire output must be a single, parseable JSON object.

**TASK: Generate a Detailed Phase 1 Strategic Report**

**OBJECTIVE:**
Analyze the client information below, visit their domain, conduct external research, and generate a comprehensive strategic report by populating the JSON schema.

**CLIENT INTAKE DATA:**
*   **Client Name:** ${data.client_name}
*   **Domain:** ${data.domain}
*   **Industry:** ${data.industry}
*   **Offer/Service:** ${data.offer_description}
*   **Pricing:** ${data.pricing}
*   **Target Market:** ${data.target_market}
*   **Goals:** ${data.goals}

**INSTRUCTIONS:**
1.  **Analyze Inputs:** Use the Client Intake Data as the primary source of truth.
2.  **Visit Domain:** Navigate to the provided domain (${data.domain}) to analyze the company\'s live positioning and messaging.
3.  **Conduct Research:** Perform external research to identify market size, growth, trends, and direct/indirect competitors.
4.  **Generate Report:** Synthesize all information to populate the fields in the JSON schema below.

**JSON OUTPUT SCHEMA:**
${JSON.stringify(PHASE_1_SCHEMA, null, 2)}
`;
}


// =====================================================================================
// PHASE 2: ICP REPORT
// =====================================================================================

/**
 * The definitive, standardized JSON schema for the Phase 2 ICP Report.
 * It supports multiple ICPs, each with multiple sub-niches.
 */
export const PHASE_2_SCHEMA = {
  icp_reports: [
    {
      icp_id: "string",
      icp_name: "string",
      icp_summary: "string",
      firmographics: {
        industries: ["string"],
        company_size_employees: ["number", "number"],
        annual_revenue_usd_millions: ["number", "number"],
        geography: ["string"],
      },
      sub_niches: [
        {
          sub_niche_id: "string",
          sub_niche_name: "string",
          sub_niche_summary: "string",
          buyer_persona: {
            primary_title: "string",
            secondary_titles: ["string"],
            responsibilities: ["string"],
            goals_kpis: ["string"],
          },
          key_buying_signals: ["string"],
          pain_points_and_challenges: ["string"],
          value_proposition_mapping: {
            pillar_1: "string",
            pillar_2: "string",
            pillar_3: "string",
          },
          targeting_criteria_database: {
            platform: "string",
            filters: ["string"],
          },
        },
      ],
    },
  ],
};

/**
 * Input data structure for the Phase 2 prompt builder.
 */
export interface Phase2PromptData {
  phase1Report: object; // The full JSON object from the completed Phase 1 task
}

/**
 * Builds the standardized, error-proof prompt for Phase 2.
 * This prompt is hardcoded to generate exactly 3 ICPs for consistency.
 */
export function buildPhase2Prompt(data: Phase2PromptData): string {
  return `
**CRITICAL OUTPUT REQUIREMENTS:**
1.  You MUST return ONLY a valid JSON object that strictly follows the provided schema.
2.  Do NOT include markdown code fences (\`\`\`json), any explanatory text, or any other characters before or after the JSON object.
3.  The entire output must be a single, parseable JSON object.
4.  You MUST generate exactly 3 distinct ICP reports in the 'icp_reports' array.
5.  Each ICP MUST have at least 2 sub-niches.

**TASK: Generate a Detailed Phase 2 Multi-ICP Report**

**OBJECTIVE:**
Based on the Phase 1 Strategic Report provided below, generate exactly 3 distinct Ideal Customer Profiles (ICPs) that are a perfect fit for the client's offer. For each ICP, identify at least 2 specific sub-niches.

**CONTEXT FROM PHASE 1 REPORT:**
${JSON.stringify(data.phase1Report, null, 2)}

**INSTRUCTIONS:**
1.  **Analyze Phase 1 Report:** Use the provided report to deeply understand the client's offer, value proposition, and target market.
2.  **Generate 3 ICPs:** Identify and profile 3 distinct ICPs. These should be the most promising customer segments based on the Phase 1 analysis.
3.  **Generate Sub-Niches:** For each of the 3 ICPs, identify and profile at least 2 specific, actionable sub-niches.
4.  **Populate Schema:** Fill out all fields in the JSON Output Schema with detailed, research-backed information for each ICP and sub-niche.

**JSON OUTPUT SCHEMA:**
${JSON.stringify(PHASE_2_SCHEMA, null, 2)}
`;
}


// =====================================================================================
// PHASE 3: EMAIL COPY GENERATION
// =====================================================================================

/**
 * The definitive, standardized JSON schema for the Phase 3 Email Copy Report.
 * It supports multiple campaign blueprints based on different angles.
 */
export const PHASE_3_SCHEMA = {
  target_profile: {
    icp_id: "string",
    icp_name: "string",
    sub_niche_id: "string",
    sub_niche_name: "string",
    buyer_persona_title: "string",
  },
  campaign_blueprints: [
    {
      angle_id: "string",
      angle_name: "string",
      angle_summary: "string",
      sequence: [
        {
          step_number: "number",
          wait_days: "number",
          step_summary: "string",
          variations: [
            {
              variation_id: "string",
              subject: "string",
              body: "string",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Input data structure for the Phase 3 prompt builder.
 */
export interface Phase3PromptData {
  phase1Report: object; // Full JSON from Phase 1
  phase2Report: object; // Full JSON from Phase 2
  targetSubNicheId: string; // The ID of the sub-niche to generate copy for
}

/**
 * Builds the standardized, error-proof prompt for Phase 3.
 * This prompt generates 3 distinct campaign angles for a specific sub-niche.
 */
export function buildPhase3Prompt(data: Phase3PromptData): string {
  // Debug logging
  console.log('[Phase 3 Prompt] Input data:', {
    hasPhase1: !!data.phase1Report,
    hasPhase2: !!data.phase2Report,
    targetSubNicheId: data.targetSubNicheId,
    phase2Structure: data.phase2Report ? Object.keys(data.phase2Report) : 'null'
  });

  // Find the specific sub-niche data and its parent ICP
  let targetSubNiche = null;
  let parentIcp = null;

  if (data.phase2Report && (data.phase2Report as any).icp_reports) {
    for (const icp of (data.phase2Report as any).icp_reports) {
      const foundNiche = icp.sub_niches?.find(
        (niche: any) => niche.sub_niche_id === data.targetSubNicheId
      );
      if (foundNiche) {
        targetSubNiche = foundNiche;
        parentIcp = icp;
        console.log('[Phase 3 Prompt] Found target sub-niche:', {
          icp_id: icp.icp_id,
          icp_name: icp.icp_name,
          sub_niche_id: targetSubNiche.sub_niche_id,
          sub_niche_name: targetSubNiche.sub_niche_name
        });
        break;
      }
    }
  }

  if (!targetSubNiche) {
    console.warn('[Phase 3 Prompt] Could not find targetSubNicheId:', data.targetSubNicheId);
  }

  // Create enriched context including both ICP and sub-niche details
  const enrichedContext = parentIcp ? {
    icp_profile: {
      icp_id: parentIcp.icp_id,
      icp_name: parentIcp.icp_name,
      icp_summary: parentIcp.icp_summary,
      firmographics: parentIcp.firmographics
    },
    sub_niche_profile: targetSubNiche
  } : targetSubNiche;

  return `
**CRITICAL OUTPUT REQUIREMENTS:**
1.  You MUST return ONLY a valid JSON object that strictly follows the provided schema.
2.  Do NOT include markdown code fences (\`\`\`json), any explanatory text, or any other characters before or after the JSON object.
3.  The entire output must be a single, parseable JSON object.
4.  You MUST generate exactly 3 distinct campaign blueprints in the 'campaign_blueprints' array.
5.  Each blueprint MUST have a 3-step email sequence with complete, ready-to-use email copy.

**TASK: Generate Detailed Phase 3 Campaign Blueprints**

**OBJECTIVE:**
Based on the specific sub-niche profile provided below, generate 3 complete email campaign blueprints. Each blueprint must be based on a unique strategic angle (Pain, Gain, and Risk).

**CONTEXT FROM PHASE 1 REPORT:**
${JSON.stringify(data.phase1Report, null, 2)}

**TARGET SUB-NICHE PROFILE (FROM PHASE 2):**
${JSON.stringify(enrichedContext, null, 2)}

**INSTRUCTIONS:**
1.  **Analyze Profile:** Use the Target Sub-Niche Profile as the source material for all email copy. Focus on their specific pains, gains, and buyer persona.
2.  **Generate 3 Angles:** Create 3 distinct campaign blueprints based on these angles:
    *   **Angle 1: Pain-Focused:** Directly address the most significant pain points of the buyer persona.
    *   **Angle 2: Gain-Focused:** Highlight the strategic gains and desired outcomes the buyer can achieve.
    *   **Angle 3: Risk-Focused:** Emphasize the risks of inaction and how the offer provides safety and security.
3.  **Create 3-Step Sequences:** For each of the 3 angles, write a complete 3-step email sequence. The copy should be persuasive, personalized, and ready to deploy.
4.  **Populate Schema:** Fill out all fields in the JSON Output Schema with the generated angles and email copy.

**JSON OUTPUT SCHEMA:**
${JSON.stringify(PHASE_3_SCHEMA, null, 2)}
`;
}
