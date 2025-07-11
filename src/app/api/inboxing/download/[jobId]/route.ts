import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const jobId = (await params).jobId;

  try {
    const downloadResponse = await fetch(`https://app.inboxing.com/api/v1/jobs/${jobId}/download_csv`, {
      headers: { 'X-API-Key': process.env.INBOXING_API_KEY! },
    });

    if (!downloadResponse.ok) {
        return NextResponse.json({ error: 'Failed to download file.' }, { status: downloadResponse.status });
    }
    
    // Stream the file back to the client
    const blob = await downloadResponse.blob();
    const headers = new Headers();
    headers.set('Content-Type', 'text/csv');
    headers.set('Content-Disposition', `attachment; filename="job_${jobId}_results.csv"`);

    return new NextResponse(blob, { status: 200, statusText: 'OK', headers });

  } catch (error) {
    console.error(`Error downloading file for job ${jobId}:`, error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}