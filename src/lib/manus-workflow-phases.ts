/**
 * Manus AI Workflow Phases
 * Defines the multi-phase workflow that happens in a single continuous task
 */

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

const PHASE_1_REPORT_JSON_SCHEMA = `{
  "client_offer_brief": {
    "title": "Client & Offer Brief",
    "company_name": "Inframail (rebranding to Superwave for premium offer)",
    "tagline": "The Outbound Infrastructure Behind Predictable Pipeline",
    "summary": "Inframail is a B2B SaaS platform providing cold email infrastructure. The new premium positioning shifts the focus from selling 'cheap inboxes' to delivering a 'Revenue Infrastructure' solution for serious B2B sales teams, backed by performance guarantees and expert guidance.",
    "current_offer": {
      "name": "Inframail Standard",
      "description": "Provides unlimited email inboxes at a flat monthly rate, built on Microsoft's cloud platform with automated setup.",
      "pricing_model": "Flat-rate monthly subscription ($99-$249/month).",
      "target_audience": "Primarily marketing and lead generation agencies."
    },
    "premium_offer": {
      "name": "Superwave Revenue Infrastructure",
      "description": "A fully managed outbound infrastructure solution designed to guarantee deliverability, ensure brand safety, and provide predictable pipeline for upper-market B2B sales teams.",
      "pricing_model": "Premium, non-public pricing discussed during consultation, justified by value and ROI, not competitor prices.",
      "target_audience": "VPs of Sales, CROs, and sales leaders at growth-stage B2B companies (20-200 sales reps) who view outbound as a strategic revenue driver."
    }
  },
  "market_competitive_analysis": {
    "title": "Market & Competitive Analysis",
    "market_overview": {
      "primary_niche": "Marketing and Lead Generation Agencies",
      "secondary_niche": "In-house B2B sales teams at growth-stage tech companies (new premium target).",
      "market_size_usd": "$11.23 billion in 2025",
      "market_growth_cagr": "11.33%",
      "market_projection_usd": "$29.51 billion by 2034"
    },
    "competitive_landscape": {
      "summary": "The current market is a 'race to the bottom' with competitors competing on price. The premium strategy is designed to exit this race by creating a new category of service.",
      "commoditized_competitors": [
        {
          "name": "Mailforge",
          "positioning": "Price and feature-based competition."
        },
        {
          "name": "Infraforge",
          "positioning": "Price and feature-based competition."
        },
        {
          "name": "Mailscale",
          "positioning": "Price and feature-based competition."
        },
        {
          "name": "Maildoso",
          "positioning": "Price and feature-based competition."
        },
        {
          "name": "Mission Inbox",
          "positioning": "Price and feature-based competition."
        }
      ],
      "cost_advantage_over_incumbents": "80-90% cost advantage over traditional providers like Google Workspace and Microsoft 365, though this is de-emphasized in the premium positioning."
    }
  },
  "core_value_proposition": {
    "title": "Core Value Proposition (Premium Positioning)",
    "summary": "The core value proposition shifts from cost savings to revenue generation and risk reduction. We are no longer selling a tool, but a strategic partnership that delivers tangible business outcomes.",
    "target_buyer_persona": {
      "title": "VP of Sales / Chief Revenue Officer",
      "pains": [
        "Missing revenue targets due to unpredictable sales pipeline.",
        "Fear of brand damage or domain blacklisting from poorly managed outbound campaigns.",
        "Inability to scale outbound efforts as the sales team grows.",
        "Lack of in-house expertise in email deliverability.",
        "Difficulty proving the ROI of sales infrastructure investments."
      ],
      "gains": [
        "Predictable and reliable pipeline generation.",
        "Brand reputation safety and security.",
        "Scalable infrastructure that supports team growth.",
        "Access to proactive, expert strategic guidance.",
        "Clear visibility into the revenue impact of their outbound engine."
      ]
    },
    "three_pillars": [
      {
        "pillar_name": "Guaranteed Performance (The SLA)",
        "description": "An SLA-backed guarantee of deliverability (e.g., 95%+ inbox placement) with financial penalties. This de-risks the investment and demonstrates confidence.",
        "value_prop": "Predictable Pipeline"
      },
      {
        "pillar_name": "White-Glove Strategic Guidance (The Dedicated Expert)",
        "description": "Every client receives a dedicated deliverability expert for proactive monitoring and strategic advice, turning the service into a high-value partnership.",
        "value_prop": "Strategic Guidance & Peace of Mind"
      },
      {
        "pillar_name": "Executive Visibility (The Revenue Dashboard)",
        "description": "Dashboards and reports that connect infrastructure performance directly to sales outcomes like meetings booked and pipeline influenced, proving ROI.",
        "value_prop": "Revenue Attribution & Visibility"
      }
    ],
    "key_differentiators": [
      "We sell outcomes (pipeline), not commodities (inboxes).",
      "Our partnership model includes expert guidance, not just a self-service tool.",
      "We offer a performance guarantee, showing we have skin in the game.",
      "Our positioning filters for serious, upper-market clients, ensuring a higher quality of service and community."
    ]
  }
}`;

// Phase 2: Multi-ICP Report JSON Schema
const PHASE_2_ICP_JSON_SCHEMA = `{
  "icp_reports": [
    {
      "icp_id": "icp_001",
      "icp_name": "Growth-Stage B2B SaaS Companies",
      "icp_summary": "B2B SaaS companies with 50-500 employees that have established product-market fit and are now scaling their outbound sales operations. They are moving from founder-led sales to building a dedicated sales team and are highly sensitive to pipeline predictability and brand reputation.",
      "firmographics": {
        "industries": ["Computer Software", "Information Technology & Services", "Internet"],
        "company_size_employees": [50, 500],
        "annual_revenue_usd_millions": [5, 50],
        "geography": ["North America", "Western Europe"]
      },
      "sub_niches": [
        {
          "sub_niche_id": "sub_001a",
          "sub_niche_name": "Sales & Marketing Tech SaaS",
          "sub_niche_summary": "Companies building tools for sales and marketing teams (e.g., CRM, automation, analytics). They are sophisticated buyers who understand the value of a strong outbound engine and are often early adopters of new sales technologies.",
          "buyer_persona": {
            "primary_title": "VP of Sales",
            "secondary_titles": ["Head of Sales", "Director of Sales Development"],
            "responsibilities": [
              "Hitting quarterly and annual revenue targets.",
              "Scaling the sales team (hiring and training SDRs/AEs).",
              "Building a predictable and scalable sales process.",
              "Managing the sales tech stack and budget."
            ],
            "goals_kpis": [
              "Increase number of qualified meetings booked per month.",
              "Improve sales cycle velocity.",
              "Reduce customer acquisition cost (CAC).",
              "Increase sales team quota attainment."
            ]
          },
          "key_buying_signals": [
            "Recently hired a VP of Sales or Head of Sales Development.",
            "Job postings for SDRs or AEs have increased in the last 3 months.",
            "Recently raised a Series A or Series B funding round.",
            "Publicly announced aggressive growth or expansion plans.",
            "Active on LinkedIn, sharing content about sales strategy and growth."
          ],
          "pain_points_and_challenges": [
            "Outbound campaigns are inconsistent; good one month, bad the next.",
            "Fear of their main corporate domain getting blacklisted, which would halt all sales communication.",
            "Struggling to manage email infrastructure as they add more sales reps.",
            "Receiving high bounce rates and low reply rates, wasting SDR time."
          ],
          "value_proposition_mapping": {
            "guaranteed_performance_sla": "De-risks their investment in outbound by guaranteeing inbox placement, ensuring their SDRs are actually reaching prospects.",
            "white_glove_guidance": "Provides the strategic expertise they lack in-house, allowing them to focus on selling while we handle deliverability.",
            "executive_visibility_dashboard": "Translates deliverability metrics into the revenue outcomes they care about (pipeline, meetings), justifying the investment to the C-suite."
          },
          "targeting_criteria_database": {
            "platform": "Apollo.io / Clay.com",
            "filters": [
              "Industry: Computer Software",
              "Employee Count: 51-500",
              "Keywords: B2B, SaaS, Sales Enablement, Marketing Automation",
              "Job Titles: VP of Sales, Head of Sales",
              "Funding: Series A, Series B",
              "Technologies Used: Salesforce, HubSpot, Outreach"
            ]
          }
        }
      ]
    }
  ]
}`;

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
  const { clientName, domain, industry, offerService, pricing, targetMarket, goals, fileNames = [] } = data;

  // Construct a comprehensive offer description from available fields
  const offerDescription = `${offerService}
  
  Additional Context:
  - Industry: ${industry}
  - Pricing: ${pricing}
  - Target Market: ${targetMarket}
  - Goals: ${goals}`;

  return `**Task: Generate a Detailed, Dynamic Phase 1 Strategic Report**

**Objective:**
Conduct a comprehensive market and strategic analysis for the company and offer detailed below. Use the provided information and perform external research to generate a detailed report in the specified JSON format.

**Input Parameters:**

*   **Company Name:** ${clientName}
*   **Company URL:** ${domain}
*   **Offer Description:** ${offerDescription}
${fileNames.length > 0 ? `*   **Attachments:** ${fileNames.join(', ')}` : ''}

**Instructions:**

1.  **Analyze Inputs:** Review the provided company name, URL, and offer description. If any documents are attached, analyze them for deeper context.
2.  **Conduct Research:** Visit the company URL and perform web searches to understand the company's positioning, target market, and competitive landscape.
3.  **Synthesize Findings:** Based on your research, populate the three core sections of the strategic report: Client & Offer Brief, Market & Competitive Analysis, and Core Value Proposition.
4.  **Structure the Output:** Populate the JSON object according to the precise schema provided below. The final output must be **only** the complete, valid JSON object.

**CRITICAL OUTPUT REQUIREMENTS:**
- You MUST return ONLY a valid JSON object
- Do NOT include markdown code fences (\`\`\`json) or any other formatting
- Do NOT include any explanatory text before or after the JSON
- The JSON must be parseable by standard JSON parsers
- Follow the exact schema structure shown below

**JSON Output Schema:**
${PHASE_1_REPORT_JSON_SCHEMA}

**Expected Deliverables:**
Return a comprehensive Phase 1 report as a single JSON object matching the schema above, containing:
- Complete client & offer brief
- Detailed market & competitive analysis  
- Core value proposition framework

The report should be ready for immediate use in Phase 2 (ICP generation) and Phase 3 (campaign creation).`;
}

// Phase 3: Campaign Blueprints JSON Schema (sample showing structure)
const PHASE_3_CAMPAIGN_JSON_SCHEMA = \`{
  "target_profile": {
    "icp_id": "icp_001",
    "icp_name": "ICP Name",
    "sub_niche_id": "sub_001a",
    "sub_niche_name": "Sub-Niche Name",
    "buyer_persona_title": "VP of Sales"
  },
  "campaign_blueprints": [
    {
      "angle_id": "angle_001",
      "angle_name": "Pain-Focused: The Risk of Inconsistent Pipeline",
      "angle_summary": "Description of this strategic angle...",
      "sequence": [
        {
          "step_number": 1,
          "wait_days": 0,
          "step_summary": "Description of this email in the sequence...",
          "variations": [
            {
              "variation_id": "A",
              "subject": "Subject line with {{company_name}} placeholder",
              "body": "Email body with {{first_name}}, {{company_name}}, and {{sender_first_name}} placeholders..."
            }
          ]
        }
      ]
    }
  ]
}\`;

/**
 * Phase 2: ICP Report (uses Phase 1 Company Report)
 */
function buildPhase2Prompt(data: {
  companyReport: any; // The output from Phase 1
  numberOfICPs?: number; // Optional: how many ICPs to generate
  icpCriteria?: string; // Optional: specific criteria for ICP selection
}): string {
  const numberOfICPs = data.numberOfICPs || 3;
  const icpCriteria = data.icpCriteria || "Focus on B2B companies that are actively scaling their sales teams and are likely to invest in premium infrastructure.";

  return `** Task: Generate a Detailed Phase 2 Multi - ICP Report **

** Objective:**
  Based on the strategic direction provided in the attached Phase 1 report(\`phase_1_report.json\`), generate a detailed ICP report that identifies and profiles distinct customer segments for the offer described in the report.

**Context from Phase 1:**

${JSON.stringify(data.companyReport, null, 2)}

**Instructions:**

1.  **Analyze Phase 1 Report:** Ingest the attached \`phase_1_report.json\` to understand the premium offer, target market, and core value propositions.

2.  **Identify and Profile ICPs:**
    *   Generate **${numberOfICPs}** distinct Ideal Customer Profiles (ICPs) that are a perfect fit for the premium offer.
    *   For each ICP, follow the criteria: **${icpCriteria}**

3.  **Identify and Profile Sub-Niches:**
    *   Within each ICP, identify at least two (2) specific, actionable sub-niches.
    *   A sub-niche should be a more focused segment of the main ICP (e.g., if the ICP is "Growth-Stage SaaS," a sub-niche could be "Sales Tech SaaS").

4.  **Structure the Output:** Populate the JSON object according to the precise schema provided below. The root object must contain an \`icp_reports\` array, and each element in that array must be a complete ICP profile with its own nested \`sub_niches\` array.

5.  **Final Output:** The final output of this task must be **only** the complete, valid JSON object. Do not include any other text, explanations, or markdown formatting outside of the JSON structure.

**JSON Output Schema:**

${PHASE_2_ICP_JSON_SCHEMA}`;
}

/**
 * Phase 3: Campaign Creation (uses Phase 1 & 2 reports)
 */
/**
 * Phase 3: Campaign Creation (uses Phase 1 & 2 reports)
 */
function buildPhase3Prompt(data: {
  companyReport: any;
  icpReport: any;
  targetSubNicheId?: string; // Optional: specific sub-niche to target
  numberOfAngles?: number; // Optional: how many angles to generate
  angleCriteria?: string; // Optional: specific criteria for angles
  selectedIcpIds?: string[]; // Optional: selected ICP IDs to focus on
}): string {
  const targetSubNicheId = data.targetSubNicheId || 'sub_001a';
  const numberOfAngles = data.numberOfAngles || 3;
  const angleCriteria = data.angleCriteria || "Create distinct angles: one pain-focused, one gain-focused, and one risk-focused.";

  // Filter ICP report if selection is provided
  let icpContext = data.icpReport;
  if (data.selectedIcpIds && data.selectedIcpIds.length > 0 && data.icpReport?.icp_reports) {
    const filteredReports = data.icpReport.icp_reports.filter((icp: any) =>
      data.selectedIcpIds?.includes(icp.icp_id)
    );
    if (filteredReports.length > 0) {
      icpContext = { ...data.icpReport, icp_reports: filteredReports };
    }
  }

  return `** Task: Generate Detailed Phase 3 Campaign Blueprints **

** Objective:**
    Based on the specific sub - niche profile provided in the Phase 2 ICP report, generate multiple, complete email campaign blueprints.Each blueprint should be based on a unique strategic angle.

** Context from Phase 1:**

    ${JSON.stringify(data.companyReport, null, 2)}

    ** Context from Phase 2(Selected ICPs):**

    ${JSON.stringify(icpContext, null, 2)}

    ** Instructions:**

    1. ** Analyze Target Profile:** Focus on the selected ICPs and their sub - niches.Use their buyer persona, pain points, and value proposition mappings as the source material for all copy.

2. ** Generate Campaign Angles:**
   - Generate ** ${numberOfAngles}** distinct strategic angles for the email campaigns for EACH selected sub - niche.
   - For each angle, follow the criteria: ** ${angleCriteria}**
    - For each angle, write a clear \`angle_summary\` explaining the psychological approach.

3. **Create Email Sequences:**
   - For each angle, create a 3-step email sequence (\`step_number\` 1, 2, and 3).
   - Each step must include at least one subject/body \`variation\` (Variation "A"). You can include more for A/B testing (Variation "B", etc.).
   - The copy must be written from the perspective of a salesperson for the "Superwave Revenue Infrastructure" offer.
   - Use the placeholders \`{{first_name}}\`, \`{{company_name}}\`, and \`{{sender_first_name}}\` for personalization.
   - Write COMPLETE EMAIL COPY, not just outlines or suggestions.

4. **Structure the Output:** Populate the JSON object according to the precise schema provided below. The final output must be a single, valid JSON object.

**JSON Output Schema:**

${PHASE_3_CAMPAIGN_JSON_SCHEMA}

**CRITICAL OUTPUT REQUIREMENTS:**
- You MUST return ONLY a valid JSON object matching the schema above
- Do NOT wrap the JSON in markdown code blocks (\`\`\`json)
- Do NOT include any explanatory text before or after the JSON
- Generate exactly ${numberOfAngles} campaign blueprints in the campaign_blueprints array per sub-niche
- Each blueprint must have a 3-step sequence with complete email copy
- The JSON must be parseable by JSON.parse()
- Subject lines and email bodies must be COMPLETE and READY TO USE
- Ensure all required fields are populated`;
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

