// app/api/inboxing/deploy/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// --- Type Definitions ---
interface DomainAssignment {
  user_email: string;
}

interface User {
  id: string;
}

interface Tenant {
  id: string;
  admin_email: string;
}

// This interface defines all parameters expected from the client's dialog box.
interface DomainSetupParameters {
  domain_name: string;
  first_name: string;
  last_name: string;
  redirect_url: string;
  admin_email: string;
  user_count: number;
  password_base_word: string; // This will be passed in the parameters object.
}

export async function POST(request: Request) {
  try {
    // MODIFIED: Removed `job_type` as it is now hardcoded.
    const { domainId, parameters } = await request.json();

    // --- Basic Validation ---
    if (!domainId || !parameters || !parameters.password_base_word || typeof parameters.user_count === 'undefined') {
      return NextResponse.json({ error: 'Missing required fields: domainId or parameters.' }, { status: 400 });
    }

    const clientParams = parameters as DomainSetupParameters;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- Internal Logic for Bookkeeping (Unchanged) ---
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

    // Assert the type of 'data' to be 'Tenant'
    const tenantData = data as Tenant;
    console.log(tenantData);
    // --- Construct Final Payload ---
    const finalParameters = {
      ...clientParams, // Spread user-provided parameters
      admin_email: tenantData.admin_email,
      cloudflare_email: process.env.CLOUDFLARE_AUTH_EMAIL,
      cloudflare_account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflare_api_key: process.env.CLOUDFLARE_GLOBAL_API_KEY,
    };

    const inboxingPayload = {
      // MODIFIED: `job_type` is now hardcoded for this specific route.
      job_type: "DOMAIN_SETUP",
      parameters: finalParameters,
    };
console.log(inboxingPayload);
    // --- Call Inboxing API (Unchanged) ---
    const jobResponse = await fetch('https://app.inboxing.com/api/v1/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.INBOXING_API_KEY!,
      },
      body: JSON.stringify(inboxingPayload),
    });

    const jobData = await jobResponse.json();

    if (!jobResponse.ok) {
      console.error('Error from Inboxing API:', jobData);
      return NextResponse.json({ error: jobData.error || 'Failed to create job in Inboxing API.' }, { status: jobResponse.status });
    }

    if (!jobData.data || !jobData.data.job_id) {
      console.error('CRITICAL: Inboxing API success response did not contain a job_id.', jobData);
      return NextResponse.json({ error: 'Inboxing API response was successful but malformed.' }, { status: 500 });
    }

    // --- Update Database (Unchanged) ---
    const { error: updateError } = await supabase
      .from('domains')
      .update({
        inboxing_job_id: jobData.data.job_id,
        deployment_status: 'Deploying',
        tenant_id: tenantData?.id,
      })
      .eq('id', domainId);

    if (updateError) {
      console.error(`CRITICAL: Failed to update domain ${domainId} with job ID ${jobData.data.job_id}`, updateError);
    }

    return NextResponse.json({ message: 'Deployment job started successfully.', jobId: jobData.data.job_id }, { status: 201 });

  } catch (error) {
    console.error('An unexpected error occurred in deploy API:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}