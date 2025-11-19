import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { uploadFileToManus, createManusTask } from '@/lib/manus-ai-client';
import { WORKFLOW_PHASES, mapPhaseToWorkflowStatus, type WorkflowPhase } from '@/lib/manus-workflow-phases';

export const dynamic = 'force-dynamic';

// Create admin client for storage operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'company-profile-files';

export async function POST(request: NextRequest) {
  const resolvedCookieStore = await cookies();

  // Create Supabase client for auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return resolvedCookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn(`[API Company Profiles] Failed to set cookie '${name}'.`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            resolvedCookieStore.set({ name, value: '', ...options });
          } catch (error) {
            console.warn(`[API Company Profiles] Failed to remove cookie '${name}'.`, error);
          }
        },
      },
    }
  );

  try {
    // 1. Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Parse form data (can be JSON or FormData)
    const contentType = request.headers.get('content-type') || '';
    let formData: any = {};

    if (contentType.includes('application/json')) {
      formData = await request.json();
    } else if (contentType.includes('multipart/form-data')) {
      // Handle FormData if needed
      const formDataObj = await request.formData();
      formData = Object.fromEntries(formDataObj.entries());
    } else {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    // 3. Validate required fields
    const { clientName, domain, industry, offerService, pricing, targetMarket, goals, files } = formData;

    if (!clientName || !domain || !industry || !offerService || !pricing || !targetMarket || !goals) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }


    // 4. Create company profile record
    const { data: companyProfile, error: profileError } = await supabaseAdmin
      .from('company_profiles')
      .insert({
        user_id: user.id,
        client_name: clientName,
        domain: domain,
        industry: industry,
        offer_service: offerService,
        pricing: pricing,
        target_market: targetMarket,
        goals: goals,
        workflow_status: 'pending', // Start as pending (will be updated when Manus AI is integrated)
      })
      .select()
      .single();

    if (profileError || !companyProfile) {
      console.error('[API Company Profiles] Error creating profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create company profile', details: profileError?.message },
        { status: 500 }
      );
    }


    // 5. Handle file uploads (to both Supabase Storage and Manus AI)
    const uploadedFiles: any[] = [];
    const manusFileIds: string[] = [];
    const fileNames: string[] = [];

    if (files && Array.isArray(files) && files.length > 0) {
      // Ensure storage bucket exists (create if needed)
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.id === STORAGE_BUCKET);

      if (!bucketExists) {
        // Create bucket (this might fail if user doesn't have permission, but we'll try)
        await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });
      }

      // Upload each file to both Supabase Storage and Manus AI
      for (const file of files) {
        try {
          // File should be base64 encoded string with metadata
          // Format: { name: string, type: string, data: string (base64) }
          if (typeof file === 'object' && file.name && file.data) {
            const fileName = `${companyProfile.id}/${file.name}`;
            const fileBuffer = Buffer.from(file.data, 'base64');
            const contentType = file.type || 'application/octet-stream';

            // Upload to Supabase Storage (for our records)
            const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
              .from(STORAGE_BUCKET)
              .upload(fileName, fileBuffer, {
                contentType: contentType,
                upsert: false,
              });

            if (uploadError) {
              console.error('[API Company Profiles] Error uploading file to storage:', uploadError);
              // Continue anyway - we'll still try to upload to Manus
            }

            // Create file record in database
            const { data: fileRecord, error: fileError } = await supabaseAdmin
              .from('company_profile_files')
              .insert({
                company_profile_id: companyProfile.id,
                file_name: file.name,
                file_path: fileName,
                file_size: fileBuffer.length,
                file_type: contentType,
              })
              .select()
              .single();

            if (!fileError && fileRecord) {
              uploadedFiles.push(fileRecord);
              fileNames.push(file.name);
            }

            // Upload to Manus AI
            try {
              const manusFileId = await uploadFileToManus(fileBuffer, file.name, contentType);
              manusFileIds.push(manusFileId);
            } catch (manusError) {
              console.error('[API Company Profiles] Error uploading file to Manus:', manusError);
              // Continue - we'll still create the task, just without this file
            }
          }
        } catch (fileError) {
          console.error('[API Company Profiles] Error processing file:', fileError);
          // Continue with other files
        }
      }
    }

    // 6. Start Manus AI workflow - Phase 1: Company Report
    let manusTaskId: string | null = null;
    let manusTaskUrl: string | null = null;
    const currentPhase: WorkflowPhase = 'phase_1_company_report';

    try {
      // Build Phase 1 prompt
      const phase1Config = WORKFLOW_PHASES[currentPhase];
      const phase1Prompt = phase1Config.promptBuilder({
        clientName,
        domain,
        industry,
        offerService,
        pricing,
        targetMarket,
        goals,
        fileNames: fileNames.length > 0 ? fileNames : undefined,
      });

      // Filter out any empty file IDs
      const validFileIds = manusFileIds.filter(id => id && id.trim().length > 0);

      // Create Manus AI task (single continuous task for all phases)
      const manusTask = await createManusTask(phase1Prompt, validFileIds, {
        agentProfile: 'manus-1.5',
        taskMode: 'agent',
        hideInTaskList: false,
        createShareableLink: true,
      });

      manusTaskId = manusTask.task_id;
      manusTaskUrl = manusTask.task_url;

      // Update company profile with Manus task ID, current phase, and workflow status
      await supabaseAdmin
        .from('company_profiles')
        .update({
          manus_workflow_id: manusTaskId,
          workflow_status: mapPhaseToWorkflowStatus(currentPhase),
          // Store current phase in company_report JSONB field as metadata
          company_report: {
            current_phase: currentPhase,
            phases_completed: [],
            phase_data: {},
          },
        })
        .eq('id', companyProfile.id);

    } catch (manusError) {
      console.error('[API Company Profiles] Error starting Manus AI workflow:', manusError instanceof Error ? manusError.message : manusError);
      // Don't fail the entire request - company profile is created, just without Manus integration
      // User can retry or we can add a retry mechanism later
    }

    // 7. Create Project linked to Company Profile
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: user.id,
        name: clientName,
        status: 'active',
        company_profile_id: companyProfile.id,
        workspace_type: null, // Will be set later in the flow
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('[API Company Profiles] Error creating project:', projectError);
      // We should probably rollback or alert, but for now we'll return the profile and warn
      // Ideally we would delete the company profile here to maintain consistency
    }

    // 8. Return success response
    return NextResponse.json({
      success: true,
      companyProfile: {
        id: companyProfile.id,
        client_name: companyProfile.client_name,
        workflow_status: manusTaskId ? 'generating' : 'pending',
        manus_workflow_id: manusTaskId,
        manus_task_url: manusTaskUrl,
        created_at: companyProfile.created_at,
      },
      project: project, // Return the created project
      files: uploadedFiles,
      manusTask: manusTaskId ? {
        task_id: manusTaskId,
        task_url: manusTaskUrl,
      } : null,
      warning: !manusTaskId ? 'Manus task was not created. Check server logs for errors. Make sure MANUS_API_KEY is set in .env' : undefined,
    }, { status: 201 });

  } catch (error) {
    console.error('[API Company Profiles] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

