# What's Fixed: Standardized Manus Prompts

## The Problem

Your original prompts were causing parsing errors and inconsistent output because:

1. **The AI was adding extra text**: Sometimes it would wrap the JSON in markdown code fences (\`\`\`json) or add explanations before/after the JSON
2. **The schemas were examples, not templates**: The JSON schemas in your prompts had Superwave-specific data baked in, which confused the AI
3. **The instructions were too conversational**: Phrases like "Please provide..." and "Your task is to..." are too soft and allow the AI to interpret freely
4. **No strict validation**: There was no clear, non-negotiable requirement that the output must be ONLY JSON

## The Solution

I've created a new file: `standardized-manus-prompts.ts` with these fixes:

### 1. Critical Output Requirements Block

Every prompt now starts with this:

```
**CRITICAL OUTPUT REQUIREMENTS:**
1.  You MUST return ONLY a valid JSON object that strictly follows the provided schema.
2.  Do NOT include markdown code fences (\`\`\`json), any explanatory text, or any other characters before or after the JSON object.
3.  The entire output must be a single, parseable JSON object.
```

This is non-negotiable and forces the AI to comply.

### 2. Schema-First Design

Instead of embedding example JSON with real data, the schemas are now defined as TypeScript objects with type placeholders:

```typescript
export const PHASE_1_SCHEMA = {
  client_offer_brief: {
    title: "Client & Offer Brief",
    company_name: "string",  // ← Type placeholder, not real data
    company_url: "string",
    tagline: "string",
    ...
  },
  ...
};
```

This makes it clear that these are templates to be filled, not examples to copy.

### 3. Imperative, Direct Instructions

Old style:
> "Please provide your analysis in a structured JSON format that can be easily parsed and displayed."

New style:
> "**Structure the Output:** Populate the JSON object according to the precise schema provided below. The final output must be **only** the complete, valid JSON object."

### 4. Hardcoded Consistency

- **Phase 2 always generates exactly 3 ICPs** (not configurable)
- **Phase 3 always generates exactly 3 angles** (Pain, Gain, Risk)
- This eliminates variability and makes your web app's parsing logic simpler

### 5. Clean, Maintainable Code

The schemas are now TypeScript objects, not giant string literals. This means:
- ✅ Type safety
- ✅ Easy to update
- ✅ Can be imported and reused
- ✅ IDE autocomplete support

## What You Need to Do

### Step 1: Replace Your Old Files

Replace these files in your project:
- ❌ `manus-kickoff-prompt.ts` (delete)
- ❌ `manus-workflow-phases.ts` (delete or archive)

With this new file:
- ✅ `standardized-manus-prompts.ts` (use this)

### Step 2: Update Your API Calls

**Old way:**
```typescript
import { buildKickoffPrompt } from './manus-kickoff-prompt';

const prompt = buildKickoffPrompt({
  clientName: "Acme",
  industry: "SaaS",
  ...
});
```

**New way:**
```typescript
import { buildPhase1Prompt } from './standardized-manus-prompts';

const prompt = buildPhase1Prompt({
  client_name: "Acme",
  domain: "https://acme.com",
  industry: "SaaS",
  ...
});
```

### Step 3: Update Your Parsing Logic

Your web app should now expect these exact structures:

**Phase 1**: `PHASE_1_SCHEMA`
- `client_offer_brief`
- `market_competitive_analysis`
- `core_value_proposition`

**Phase 2**: `PHASE_2_SCHEMA`
- `icp_reports` (array of exactly 3 ICPs)
  - Each ICP has `sub_niches` (array of at least 2)

**Phase 3**: `PHASE_3_SCHEMA`
- `target_profile`
- `campaign_blueprints` (array of exactly 3 angles)
  - Each angle has a `sequence` (array of 3 steps)

## Expected Results

✅ **No more parsing errors**: The output will always be valid JSON

✅ **Consistent structure**: Every company will get the same format

✅ **Predictable counts**: Always 3 ICPs, always 3 angles

✅ **Rich data**: The prompts still generate comprehensive, detailed reports

✅ **Easy to maintain**: The code is clean and type-safe

## Testing Checklist

Test these scenarios to confirm everything works:

- [ ] Create a company profile (Phase 1) and verify the JSON parses correctly
- [ ] Generate ICPs (Phase 2) and verify you get exactly 3 ICPs
- [ ] Generate email copy (Phase 3) and verify you get exactly 3 campaign blueprints
- [ ] Try with different industries and offers to ensure it's generic
- [ ] Check that the output has NO markdown code fences or extra text

If all these pass, you're good to go!
