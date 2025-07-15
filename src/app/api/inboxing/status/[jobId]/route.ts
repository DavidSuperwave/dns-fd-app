import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function mapToUiStatus(inboxingStatus: string): string {
    switch (inboxingStatus) {
        case 'COMPLETED_SUCCESS':
        case 'COMPLETED_WITH_ERRORS':
            return 'Deployed';
        
        case 'COMPLETED_FAILURE':
            return 'Failed';
            
        case 'PENDING':
        case 'QUEUED':
        case 'PROCESSING':
        case 'WAITING_FOR_CONFIRMATION':
        default:
            return 'Pending';
    }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const jobId = (await params).jobId;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const statusResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/status`, {
      headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json();
      return NextResponse.json({ error: errorData.error || 'Failed to fetch job status.' }, { status: statusResponse.status });
    }

    const jobDetails = await statusResponse.json();
    const newStatus = jobDetails.data?.status;

    // Persist the latest status to our database
    if (newStatus) {
      const uiStatus = mapToUiStatus(newStatus);
      await supabase
        .from('domains')
        .update({ inboxing_job_status: newStatus, deployment_status: uiStatus })
        .eq('inboxing_job_id', jobId);
    }

    if (jobDetails.data && jobDetails.data.parameters) {
        delete jobDetails.data.parameters;
    }
    return NextResponse.json(jobDetails);
  } catch (error) {
    console.error(`Error fetching status for job ${jobId}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}