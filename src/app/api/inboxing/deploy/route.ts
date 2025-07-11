// app/api/inboxing/deploy/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateCsvForDeployment } from '@/lib/csv-validator';
// --- Type Definitions (Unchanged) ---
interface Tenant {
  id: string;
  admin_email: string;
}

export async function POST(request: Request) {
  try {
    // 1. Unified Input Parsing
    // The route now always expects a JSON body, which may optionally contain csvContent.
    const { domainId, parameters, csvContent } = await request.json();

    // --- Basic Validation ---
    if (!domainId || !parameters) {
      return NextResponse.json({ error: 'Missing required fields: domainId or parameters.' }, { status: 400 });
    }
    if (csvContent && typeof csvContent === 'string') {
      const validationResult = await validateCsvForDeployment(csvContent);

      if (validationResult.hasErrors) {
        const errorSummary = validationResult.errors.join(' ');
        const repeatedEmailsSummary = validationResult.repeatedEmails.map(e => `${e[0]} (${e[1]})`).join(', ');
        let fullError = `CSV validation failed: ${errorSummary}`;
        if (repeatedEmailsSummary) {
          fullError += ` Repeated emails found: ${repeatedEmailsSummary}`;
        }
        return NextResponse.json({ error: fullError }, { status: 400 });
      }

      // *** IMPORTANT: Use the cleaned content for the outbound request ***
      parameters.csvContent = validationResult.cleanedContent;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- Internal Logic for finding user and tenant (Unchanged) ---
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('domain_assignments')
      .select('user_email')
      .eq('domain_id', domainId)
      .single();
    if (assignmentError || !assignmentData) {
      return NextResponse.json({ error: 'This domain is not assigned to any user.' }, { status: 404 });
    }

    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', assignmentData.user_email)
      .single();
    if (userError || !userData) {
      return NextResponse.json({ error: `User with email ${assignmentData.user_email} not found.` }, { status: 404 });
    }

    const { data, error: tenantError } = await supabase
      .rpc('get_available_tenant_for_user', { p_user_id: userData.id })
      .single();
    if (tenantError || !data) {
      console.error('Error finding available tenant for user:', userData.id, tenantError);
      return NextResponse.json({ error: 'This user has no available tenant slots.' }, { status: 400 });
    }
    const tenantData = data as Tenant;

    // --- 2. Conditional Outbound Request to Inboxing API ---
    let jobResponse;

    if (csvContent && typeof csvContent === 'string') {
      // --- CSV Mode: Create and send FormData ---
      const inboxingFormData = new FormData();
      
      // Append fields from Inboxing API docs for CSV upload
      inboxingFormData.append('job_type', 'DOMAIN_SETUP');
      inboxingFormData.append('csv_upload_mode', 'true');
      inboxingFormData.append('domain_name', parameters.domain_name);
      inboxingFormData.append('redirect_url', parameters.redirect_url);
      inboxingFormData.append('user_count', '99');
      inboxingFormData.append('password_base_word', parameters.password_base_word);
      inboxingFormData.append('admin_email', tenantData.admin_email);
      // Append Cloudflare keys if they exist
      if(process.env.CLOUDFLARE_AUTH_EMAIL) inboxingFormData.append('cloudflare_email', process.env.CLOUDFLARE_AUTH_EMAIL);
      if(process.env.CLOUDFLARE_ACCOUNT_ID) inboxingFormData.append('cloudflare_account_id', process.env.CLOUDFLARE_ACCOUNT_ID);
      if(process.env.CLOUDFLARE_GLOBAL_API_KEY) inboxingFormData.append('cloudflare_api_key', process.env.CLOUDFLARE_GLOBAL_API_KEY);

      // Create a Blob from the CSV string sent by the client
      const csvBlob = new Blob([csvContent], { type: 'text/csv' });
      inboxingFormData.append('csv_file', csvBlob, 'upload.csv');

      jobResponse = await fetch('https://app.inboxing.com/api/v1/jobs', {
        method: 'POST',
        headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
        body: inboxingFormData,
      });

    } else {
      // --- JSON Mode: Send JSON payload (original logic) ---
      const finalParameters = {
        ...parameters,
        admin_email: tenantData.admin_email,
        cloudflare_email: process.env.CLOUDFLARE_AUTH_EMAIL,
        cloudflare_account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflare_api_key: process.env.CLOUDFLARE_GLOBAL_API_KEY,
      };
      const inboxingPayload = { job_type: "DOMAIN_SETUP", parameters: finalParameters };
      
      jobResponse = await fetch('https://app.inboxing.com/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.INBOXING_API_KEY! },
        body: JSON.stringify(inboxingPayload),
      });
    }

    // --- 3. Process Response, Check Status, Auto-Confirm, and Update DB ---
    const jobData = await jobResponse.json();

    if (!jobResponse.ok) {
      console.error('Error from Inboxing API:', jobData);
      return NextResponse.json({ error: jobData.error || 'Failed to create job in Inboxing API.' }, { status: jobResponse.status });
    }

    if (!jobData.data || !jobData.data.job_id) {
      console.error('CRITICAL: Inboxing API success response did not contain a job_id.', jobData);
      return NextResponse.json({ error: 'Inboxing API response was successful but malformed.' }, { status: 500 });
    }
    
    const jobId = jobData.data.job_id;

    // --- NEW: Fetch the status before confirming ---
    console.log(`Job ${jobId} created. Fetching status before confirming...`);
    const statusResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/status`, {
        headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
    });

    if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const confirmableStatus = "WAITING_FOR_CONFIRMATION"; 

        if (statusData.data?.status === confirmableStatus) {
            console.log(`Job ${jobId} is in a confirmable state. Proceeding with confirmation...`);
            
            // Now, send the confirmation call
            const confirmResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/confirm`, {
                method: 'POST',
                headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
            });

            if (confirmResponse.ok) {
                console.log(`Job ${jobId} successfully auto-confirmed.`);
            } else {
                const confirmError = await confirmResponse.json();
                console.warn(`Job ${jobId} was created, but automatic confirmation failed:`, confirmError.error);
            }
        } else {
            console.log(`Job ${jobId} is not in a confirmable state (current status: ${statusData.data?.status}). Skipping auto-confirmation.`);
        }
    } else {
        console.warn(`Job ${jobId} created, but could not fetch its status. Aborting auto-confirmation.`);
    }
    // --- END of new logic ---

    // Update your database (This part is unchanged)
    await supabase
      .from('domains')
      .update({
        inboxing_job_id: jobId,
        deployment_status: 'Deploying',
        tenant_id: tenantData?.id,
      })
      .eq('id', domainId);

    return NextResponse.json({ message: 'Deployment job started and confirmed successfully.', jobId: jobId }, { status: 201 });
  } catch (error) {
    console.error('An unexpected error occurred in deploy API:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}