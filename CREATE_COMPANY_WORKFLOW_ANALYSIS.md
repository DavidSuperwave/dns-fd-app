# Create Company Workflow - Current State & Fix Plan

**Date:** 2025-01-17  
**Status:** Analysis Complete - Ready to Build

---

## 📋 Current State Analysis

### ✅ What Exists

1. **Frontend Form** (`src/app/create-company/page.tsx`)
   - ✅ Collects all required fields:
     - Client Name
     - Industry (dropdown)
     - Offer/Service
     - Pricing
     - Target Market
     - Goals
     - File uploads (UI only)
   - ✅ Loading states component integration
   - ❌ **NO API CALL** - Form submission does nothing

2. **Loading States Component** (`src/components/company/company-loading-states.tsx`)
   - ✅ Shows 4 loading states: "Generating", "Creating report", "Validating report", "Finding competitors"
   - ✅ Cycles through states every 3 seconds
   - ✅ Shows completion state with project card
   - ❌ **NO BACKEND INTEGRATION** - Just UI simulation

3. **Database Tables** (✅ Complete)
   - `company_profiles` - Stores company data
   - `company_profile_files` - Stores uploaded files
   - `projects` - Auto-created when workflow completes (via trigger)

4. **Database Trigger** (✅ Complete)
   - Auto-creates `project` when `company_profiles.workflow_status = 'completed'`

---

## ❌ What's Missing

### 1. API Route for Creating Company Profile
**File:** `src/app/api/company-profiles/route.ts` (doesn't exist)

**Needs to:**
- Accept form data (client_name, industry, offer_service, pricing, target_market, goals)
- Handle file uploads (store in Supabase Storage)
- Create `company_profiles` record with `workflow_status = 'pending'`
- Create `company_profile_files` records
- Return company profile ID

### 2. File Upload Handling
**Current:** Files are collected in frontend but never sent to backend

**Needs:**
- Upload files to Supabase Storage
- Store file metadata in `company_profile_files` table
- Return file paths/URLs

### 3. Manus AI Workflow Integration
**Current:** No integration exists

**Needs:**
- API client for Manus AI
- Start workflow when company profile is created
- Update `workflow_status` as workflow progresses
- Store `manus_workflow_id` in database
- Store generated report in `company_report` JSONB field

### 4. Workflow Status Updates
**Current:** No mechanism to update workflow status

**Needs:**
- API route to update workflow status
- Webhook or polling mechanism to check Manus AI workflow status
- Update database as workflow progresses through states

### 5. Frontend Integration
**Current:** Form doesn't call any API

**Needs:**
- Call API on form submission
- Handle file uploads
- Poll for workflow completion
- Redirect to projects page when complete

---

## 🔄 Current Flow (What Happens Now)

```
1. User fills out form
2. User clicks "Create Company Profile"
3. handleSubmit() sets isSubmitting = true
4. Loading states component shows (just UI, no backend)
5. Loading states cycle through (simulated)
6. Eventually shows "complete" state (fake)
7. Nothing is saved to database
8. No project is created
```

---

## ✅ Intended Flow (What Should Happen)

```
1. User fills out form
2. User clicks "Create Company Profile"
3. Frontend calls POST /api/company-profiles
   - Sends form data
   - Uploads files to Supabase Storage
4. Backend creates company_profiles record
   - workflow_status = 'pending'
   - Stores all form data
5. Backend uploads files
   - Stores in Supabase Storage
   - Creates company_profile_files records
6. Backend starts Manus AI workflow
   - Calls Manus AI API
   - Stores manus_workflow_id
   - Updates workflow_status = 'generating'
7. Frontend polls for status updates
   - Calls GET /api/company-profiles/[id]/status
   - Updates workflow_status as it progresses
8. When workflow_status = 'completed'
   - Database trigger auto-creates project
   - Frontend redirects to projects page
```

---

## 🛠️ What Needs to Be Built

### Priority 1: Core Functionality
1. **API Route: POST /api/company-profiles**
   - Create company profile
   - Handle file uploads
   - Return profile ID

2. **API Route: GET /api/company-profiles/[id]**
   - Get company profile with status
   - For polling workflow status

3. **Frontend Integration**
   - Call API on form submit
   - Handle file uploads
   - Poll for status updates
   - Redirect on completion

### Priority 2: Manus AI Integration
4. **Manus AI Client** (`src/lib/manus-ai-client.ts`)
   - Start workflow
   - Check workflow status
   - Get workflow results

5. **Workflow Status Updates**
   - API route to update status
   - Webhook handler (if Manus supports it)
   - Or polling mechanism

### Priority 3: File Storage
6. **Supabase Storage Setup**
   - Create storage bucket for company files
   - Upload files
   - Generate public URLs

---

## 📝 Implementation Plan

### Step 1: Create API Route (No Manus AI yet)
- Create `src/app/api/company-profiles/route.ts`
- Accept form data
- Create company_profiles record
- Handle file uploads (basic - store metadata)
- Return profile ID

### Step 2: Update Frontend
- Connect form to API
- Handle file uploads
- Show real loading states
- Basic status polling

### Step 3: Add Manus AI Integration
- Create Manus AI client
- Start workflow on company creation
- Update workflow status
- Store results

### Step 4: Complete Workflow
- Poll for completion
- Auto-redirect when done
- Show project card

---

## 🔍 Files to Create/Modify

### New Files:
1. `src/app/api/company-profiles/route.ts` - Create company profile
2. `src/app/api/company-profiles/[id]/route.ts` - Get/Update company profile
3. `src/app/api/company-profiles/[id]/status/route.ts` - Get workflow status
4. `src/lib/manus-ai-client.ts` - Manus AI API client (later)

### Files to Modify:
1. `src/app/create-company/page.tsx` - Connect to API
2. `src/components/company/company-loading-states.tsx` - Use real status

---

## 🎯 Next Steps

1. **Start with Step 1:** Create basic API route (no Manus AI)
2. **Test:** Create company profile, verify database entry
3. **Add file uploads:** Integrate Supabase Storage
4. **Connect frontend:** Make form actually work
5. **Add Manus AI:** Integrate workflow later

**Recommendation:** Build the basic flow first (create profile, save to DB), then add Manus AI integration as a separate step.

