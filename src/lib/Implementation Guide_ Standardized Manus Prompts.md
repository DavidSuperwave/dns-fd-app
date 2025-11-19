# Implementation Guide: Standardized Manus Prompts

This guide explains how to use the new, error-proof prompts from `standardized-manus-prompts.ts` in your application.

## What Was Fixed

### Problems with the Old Prompts

1. **Inconsistent JSON Output**: The AI sometimes wrapped JSON in markdown code fences or added explanatory text
2. **Schema Drift**: The example schemas in the prompts didn't match what was actually generated
3. **Hardcoded Company Data**: The Phase 1 schema had Superwave-specific examples baked in
4. **Unclear Requirements**: The prompts were conversational instead of imperative
5. **No Type Safety**: Schemas were defined as giant string literals instead of TypeScript objects

### What's Fixed Now

✅ **Strict JSON-Only Output**: Every prompt starts with "CRITICAL OUTPUT REQUIREMENTS" that explicitly forbid any non-JSON output

✅ **Schema-First Design**: The JSON schemas are defined as TypeScript objects and passed directly into the prompts

✅ **Generic & Reusable**: All prompts work for any company, not just Superwave

✅ **Clear, Imperative Instructions**: Prompts are direct commands, not suggestions

✅ **Consistent Structure**: All 3 phases follow the exact same pattern

## How to Use the New Prompts

### Phase 1: Company Report

**When to use**: When a user submits the "Create Company" form

**Input**: Form data from your web app

**Output**: A comprehensive strategic report with 3 sections

```typescript
import { buildPhase1Prompt, Phase1PromptData, PHASE_1_SCHEMA } from './standardized-manus-prompts';

// 1. Collect form data
const formData: Phase1PromptData = {
  client_name: "Acme Corp",
  domain: "https://acme.com",
  industry: "B2B SaaS",
  offer_description: "All-in-one project management for remote teams",
  pricing: "$99/user/month",
  target_market: "Remote-first companies with 10-100 employees",
  goals: "50 demos/month, 10% conversion rate"
};

// 2. Build the prompt
const prompt = buildPhase1Prompt(formData);

// 3. Call Manus API
const task = await manusClient.createTask({
  prompt: prompt,
  attachments: [] // Optional: add any uploaded files
});

// 4. Wait for completion and parse the result
const result = await manusClient.getTask(task.id);
const phase1Report = JSON.parse(result.output);

// 5. Save to database
await db.companies.update(companyId, {
  phase_1_report: phase1Report,
  phase_1_status: 'completed'
});
```

**Expected Output Structure**:
```json
{
  "client_offer_brief": {
    "title": "Client & Offer Brief",
    "company_name": "Acme Corp",
    "company_url": "https://acme.com",
    "tagline": "...",
    "summary": "...",
    "offer": {
      "name": "...",
      "description": "...",
      "pricing_model": "...",
      "target_audience": "..."
    }
  },
  "market_competitive_analysis": { ... },
  "core_value_proposition": { ... }
}
```

### Phase 2: ICP Report (3 ICPs)

**When to use**: After Phase 1 is complete and the user wants to generate ICPs

**Input**: The Phase 1 report JSON

**Output**: Exactly 3 ICPs, each with at least 2 sub-niches

```typescript
import { buildPhase2Prompt, Phase2PromptData, PHASE_2_SCHEMA } from './standardized-manus-prompts';

// 1. Get the Phase 1 report from your database
const company = await db.companies.findById(companyId);
const phase1Report = company.phase_1_report;

// 2. Build the Phase 2 prompt
const promptData: Phase2PromptData = {
  phase1Report: phase1Report
};
const prompt = buildPhase2Prompt(promptData);

// 3. Call Manus API
const task = await manusClient.createTask({
  prompt: prompt
});

// 4. Wait for completion and parse the result
const result = await manusClient.getTask(task.id);
const phase2Report = JSON.parse(result.output);

// 5. Save to database
await db.companies.update(companyId, {
  phase_2_report: phase2Report,
  phase_2_status: 'completed'
});
```

**Expected Output Structure**:
```json
{
  "icp_reports": [
    {
      "icp_id": "icp_001",
      "icp_name": "Growth-Stage B2B SaaS",
      "icp_summary": "...",
      "firmographics": { ... },
      "sub_niches": [
        {
          "sub_niche_id": "sub_001a",
          "sub_niche_name": "Sales Tech SaaS",
          "sub_niche_summary": "...",
          "buyer_persona": { ... },
          "key_buying_signals": [ ... ],
          "pain_points_and_challenges": [ ... ],
          "value_proposition_mapping": { ... },
          "targeting_criteria_database": { ... }
        },
        {
          "sub_niche_id": "sub_001b",
          "sub_niche_name": "Marketing Tech SaaS",
          ...
        }
      ]
    },
    {
      "icp_id": "icp_002",
      "icp_name": "Enterprise Manufacturing",
      ...
    },
    {
      "icp_id": "icp_003",
      "icp_name": "Professional Services Firms",
      ...
    }
  ]
}
```

### Phase 3: Email Copy Generation

**When to use**: After Phase 2 is complete and the user selects a specific sub-niche to generate campaigns for

**Input**: Phase 1 report, Phase 2 report, and the target sub-niche ID

**Output**: 3 campaign blueprints (Pain, Gain, Risk angles), each with a 3-step email sequence

```typescript
import { buildPhase3Prompt, Phase3PromptData, PHASE_3_SCHEMA } from './standardized-manus-prompts';

// 1. Get the Phase 1 and Phase 2 reports from your database
const company = await db.companies.findById(companyId);
const phase1Report = company.phase_1_report;
const phase2Report = company.phase_2_report;

// 2. User selects a sub-niche from the UI
const selectedSubNicheId = "sub_001a"; // e.g., "Sales Tech SaaS"

// 3. Build the Phase 3 prompt
const promptData: Phase3PromptData = {
  phase1Report: phase1Report,
  phase2Report: phase2Report,
  targetSubNicheId: selectedSubNicheId
};
const prompt = buildPhase3Prompt(promptData);

// 4. Call Manus API
const task = await manusClient.createTask({
  prompt: prompt
});

// 5. Wait for completion and parse the result
const result = await manusClient.getTask(task.id);
const phase3Report = JSON.parse(result.output);

// 6. Save to database
await db.campaigns.create({
  company_id: companyId,
  sub_niche_id: selectedSubNicheId,
  campaign_blueprints: phase3Report.campaign_blueprints,
  status: 'ready_to_deploy'
});
```

**Expected Output Structure**:
```json
{
  "target_profile": {
    "icp_id": "icp_001",
    "icp_name": "Growth-Stage B2B SaaS",
    "sub_niche_id": "sub_001a",
    "sub_niche_name": "Sales Tech SaaS",
    "buyer_persona_title": "VP of Sales"
  },
  "campaign_blueprints": [
    {
      "angle_id": "angle_001",
      "angle_name": "Pain-Focused: Inconsistent Pipeline",
      "angle_summary": "...",
      "sequence": [
        {
          "step_number": 1,
          "wait_days": 0,
          "step_summary": "...",
          "variations": [
            {
              "variation_id": "A",
              "subject": "{{company_name}}'s outbound pipeline",
              "body": "Hi {{first_name}},\n\nI noticed {{company_name}} is..."
            }
          ]
        },
        {
          "step_number": 2,
          "wait_days": 3,
          ...
        },
        {
          "step_number": 3,
          "wait_days": 5,
          ...
        }
      ]
    },
    {
      "angle_id": "angle_002",
      "angle_name": "Gain-Focused: Strategic Partnership",
      ...
    },
    {
      "angle_id": "angle_003",
      "angle_name": "Risk-Focused: Brand Reputation",
      ...
    }
  ]
}
```

## Error Handling

Even with the standardized prompts, you should still implement robust error handling:

```typescript
async function callManusWithRetry(prompt: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const task = await manusClient.createTask({ prompt });
      const result = await manusClient.getTask(task.id);
      
      // Attempt to parse the JSON
      const parsed = JSON.parse(result.output);
      
      // Validate that it has the expected structure
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure');
      }
      
      return parsed;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}
```

## Key Takeaways

✅ **Use the new prompts**: Replace your old prompt builders with the ones from `standardized-manus-prompts.ts`

✅ **Trust the schemas**: The TypeScript schemas (`PHASE_1_SCHEMA`, `PHASE_2_SCHEMA`, `PHASE_3_SCHEMA`) are the source of truth

✅ **Phase 2 always generates 3 ICPs**: This is hardcoded for consistency

✅ **Phase 3 always generates 3 angles**: Pain, Gain, and Risk

✅ **JSON-only output**: The prompts are designed to return ONLY valid JSON, no markdown or extra text

✅ **Generic and reusable**: These prompts work for any company, not just Superwave
