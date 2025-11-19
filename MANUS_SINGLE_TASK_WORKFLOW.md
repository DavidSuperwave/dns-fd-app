# Manus AI Single Continuous Task Workflow

This document explains the multi-phase workflow that happens in a **single continuous Manus task**, maintaining context across all phases.

## 🔄 Workflow Overview

Instead of creating separate tasks for each phase, we use **one task** and continue the conversation using the `taskId` parameter. This maintains all context from previous phases.

## 📋 Phase Flow

```
Phase 1: Company Report
  ↓ (uses taskId to continue)
Phase 2: ICP Report (uses Phase 1 output)
  ↓ (uses taskId to continue)
Phase 3: Campaign Creation (uses Phase 1 & 2 outputs)
  ↓ (uses taskId to continue)
Phase 4: Optimization (uses Phase 1-3 + Vibe Plus data)
  ↓ (uses taskId to continue)
Phase 5: Final Optimization (uses all previous phases)
  ↓
Completed → Project Auto-Created
```

## 🎯 Phase Details

### Phase 1: Company Report Brief
- **Input:** Form data (client name, industry, offer/service, pricing, target market, goals) + uploaded files
- **Output:** Comprehensive company profile and market analysis
- **Stored in:** `company_report.phase_data.phase_1_company_report`

### Phase 2: ICP Report
- **Input:** Phase 1 Company Report
- **Output:** Ideal Customer Profile (ICP) analysis
- **Stored in:** `company_report.phase_data.phase_2_icp_report`

### Phase 3: Campaign Creation
- **Input:** Phase 1 Company Report + Phase 2 ICP Report
- **Output:** Targeted campaign strategies
- **Stored in:** `company_report.phase_data.phase_3_campaigns`

### Phase 4: Campaign Optimization
- **Input:** Phase 1-3 outputs + Campaign performance data from Vibe Plus
- **Output:** Optimization recommendations
- **Stored in:** `company_report.phase_data.phase_4_optimization`

### Phase 5: Final Optimization
- **Input:** All previous phases + Phase 4 optimization results
- **Output:** Final strategic recommendations
- **Stored in:** `company_report.phase_data.phase_5_final_optimization`

## 🔧 Implementation

### Task Creation (Phase 1)
```typescript
// Create initial task with Phase 1 prompt
const task = await createManusTask(phase1Prompt, fileIds, {
  agentProfile: 'manus-1.5',
  taskMode: 'agent',
});
// Store task_id in company_profiles.manus_workflow_id
```

### Continuing Task (Phase 2-5)
```typescript
// Continue same task with next phase prompt
await continueManusTask(taskId, nextPhasePrompt);
// Manus maintains all context from previous phases
```

### Automatic Phase Advancement
The webhook handler automatically advances phases when a phase completes:

1. **Webhook receives** `status: 'completed'` for a phase
2. **Stores result** in `phase_data[currentPhase]`
3. **Builds next phase prompt** using all previous phase data
4. **Continues task** with `continueManusTask(taskId, nextPhasePrompt)`
5. **Updates database** with new phase

## 📊 Database Structure

The `company_report` JSONB field stores:

```json
{
  "current_phase": "phase_2_icp_report",
  "phases_completed": ["phase_1_company_report"],
  "phase_data": {
    "phase_1_company_report": { /* Phase 1 output */ },
    "phase_2_icp_report": { /* Phase 2 output */ },
    // ... etc
  },
  "final_report": { /* Only when all phases complete */ }
}
```

## 🔄 Status Mapping

Workflow phases map to database `workflow_status`:

- `phase_1_company_report` → `generating`
- `phase_2_icp_report` → `creating_report`
- `phase_3_campaigns` → `validating_report`
- `phase_4_optimization` → `finding_competitors`
- `phase_5_final_optimization` → `finding_competitors`
- `completed` → `completed` (triggers project creation)

## 🚀 API Endpoints

### Create Company Profile (Starts Phase 1)
```
POST /api/company-profiles
```
Creates company profile and starts Phase 1 in a new Manus task.

### Advance Phase (Manual)
```
POST /api/company-profiles/[id]/advance-phase
Body: { phaseData: { /* current phase output */ } }
```
Manually advance to next phase (usually handled automatically by webhook).

### Webhook Handler (Auto-advance)
```
POST /api/manus/webhook
```
Receives Manus completion events and automatically advances phases.

## 🎯 Benefits of Single Task Approach

1. **Context Preservation:** All previous phases available to Manus
2. **No Re-uploading:** Files uploaded once in Phase 1, available throughout
3. **Seamless Flow:** Natural conversation progression
4. **Better Results:** Each phase builds on previous insights
5. **Simpler Management:** One task_id to track

## 🔍 Monitoring

Check current phase:
```sql
SELECT 
  id,
  client_name,
  workflow_status,
  company_report->>'current_phase' as current_phase,
  company_report->'phases_completed' as phases_completed
FROM company_profiles
WHERE id = 'your-profile-id';
```

## 📝 Next Steps

1. ✅ Single task creation implemented
2. ✅ Phase continuation with `taskId` implemented
3. ✅ Automatic phase advancement in webhook
4. ⏳ Vibe Plus integration for Phase 4 campaign data
5. ⏳ Error handling and retry logic
6. ⏳ Manual phase advancement UI (if needed)

