// app/api/inboxing/deploy/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { validateCsvForDeployment } from '@/lib/csv-validator';

interface Tenant {
  id: string;
  admin_email: string;
}

export async function POST(request: Request) {
  try {
    const { domainId, parameters, csvContent } = await request.json();

    if (!domainId || !parameters) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    let validatedDomain = parameters.domain_name;
    let finalCsvContent = csvContent;

    // 1. Server-Side CSV Validation (if applicable)
    if (csvContent && typeof csvContent === 'string') {
      const validationResult = await validateCsvForDeployment(csvContent);
      if (validationResult.hasErrors) {
        const errorSummary = validationResult.errors.join(' ');
        return NextResponse.json({ error: `CSV validation failed: ${errorSummary}` }, { status: 400 });
      }
      finalCsvContent = validationResult.cleanedContent;
      validatedDomain = validationResult.domain || parameters.domain_name;
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 2. Find User
    const { data: assignmentData } = await supabase.from('domain_assignments').select('user_email').eq('domain_id', domainId).single();
    if (!assignmentData) return NextResponse.json({ error: 'This domain is not assigned to any user.' }, { status: 404 });
    
    const { data: userData } = await supabase.from('user_profiles').select('id').eq('email', assignmentData.user_email).single();
    if (!userData) return NextResponse.json({ error: `User with email ${assignmentData.user_email} not found.` }, { status: 404 });

    // 3. Fetch ALL available tenants for the user
    const { data: availableTenants, error: tenantError } = await supabase
      .rpc('get_available_tenant_for_user', { p_user_id: userData.id });

    if (tenantError || !availableTenants || availableTenants.length === 0) {
      return NextResponse.json({ error: 'This user has no available tenant slots in the database.' }, { status: 400 });
    }

    // 4. Loop through tenants and attempt deployment
    let successfulJobData = null;
    let successfulTenant = null;

    for (const tenant of availableTenants as Tenant[]) {
      console.log(`Attempting deployment to tenant: ${tenant.admin_email}`);
      let jobResponse;
      
      const finalParameters = { ...parameters, domain_name: validatedDomain, admin_email: tenant.admin_email,
        cloudflare_email: process.env.CLOUDFLARE_AUTH_EMAIL,
        cloudflare_account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
        cloudflare_api_key: process.env.CLOUDFLARE_GLOBAL_API_KEY,
       };

      if (finalCsvContent) {
        const formData = new FormData();
        formData.append('job_type', 'DOMAIN_SETUP');
        formData.append('csv_upload_mode', 'true');
        Object.entries(finalParameters).forEach(([key, value]) => formData.append(key, String(value)));
        
        const csvBlob = new Blob([finalCsvContent], { type: 'text/csv' });
        formData.append('csv_file', csvBlob, `${validatedDomain}.csv`);
        
        jobResponse = await fetch('https://app.inboxing.com/api/v1/jobs', { method: 'POST', headers: { 'X-API-Key': process.env.INBOXING_API_KEY! }, body: formData });
      } else {
        const inboxingPayload = { job_type: "DOMAIN_SETUP", parameters: finalParameters };
        jobResponse = await fetch('https://app.inboxing.com/api/v1/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.INBOXING_API_KEY! }, body: JSON.stringify(inboxingPayload) });
      }

      const responseData = await jobResponse.json();

      if (jobResponse.ok) {
        successfulJobData = responseData;
        successfulTenant = tenant;
        console.log(`Successfully created job on tenant: ${tenant.admin_email}`);
        break; 
      } else if (jobResponse.status === 429) {
        console.warn(`Tenant ${tenant.admin_email} is full according to Inboxing API. Trying next...`);
        continue;
      } else {
        console.error('Non-recoverable error from Inboxing API:', responseData);
        return NextResponse.json({ error: responseData.error || 'Failed to create job.' }, { status: jobResponse.status });
      }
    }

    if (!successfulJobData || !successfulTenant) {
      return NextResponse.json({ error: 'All available tenants for this user were full. Please add a new tenant.' }, { status: 400 });
    }
    
    // --- 5. Auto-confirm and update database ---
    const jobId = successfulJobData.data.job_id;

    // Fetch the status before confirming
    const statusResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/status`, {
        headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
    });

    if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const confirmableStatus = "WAITING_FOR_CONFIRMATION"; 

        if (statusData.data?.status === confirmableStatus) {
            console.log(`Job ${jobId} is in a confirmable state. Proceeding with confirmation...`);
            const confirmResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/confirm`, {
                method: 'POST',
                headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
            });
            if (confirmResponse.ok) {
                console.log(`Job ${jobId} successfully auto-confirmed.`);
            } else {
                console.warn(`Job ${jobId} created, but auto-confirmation failed.`);
            }
        } else {
            console.log(`Job ${jobId} not in confirmable state (Status: ${statusData.data?.status}). Skipping auto-confirmation.`);
        }
    } else {
        console.warn(`Job ${jobId} created, but could not fetch its status.`);
    }

    // Finally, update your database
    await supabase
      .from('domains')
      .update({
        inboxing_job_id: jobId,
        deployment_status: 'Deploying',
        tenant_id: successfulTenant.id,
      })
      .eq('id', domainId);

    return NextResponse.json({ message: 'Deployment job started successfully.', jobId: jobId }, { status: 201 });

  } catch (error: any) {
    console.error('An unexpected error occurred in deploy API:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}