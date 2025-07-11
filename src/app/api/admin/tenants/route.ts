import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import formidable from 'formidable';
import fs from 'fs/promises';
import { parse } from 'csv-parse/sync';

// This helper function remains the same.
async function parseForm(req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
    return new Promise((resolve, reject) => {
        const form = formidable({});
        form.parse(req as any, (err, fields, files) => {
            if (err) {
                reject(err);
            }
            resolve({ fields, files });
        });
    });
}


export async function POST(request: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const contentType = request.headers.get('content-type') || '';

  let recordsToProcess: any[] = [];

  try {
    if (contentType.includes('application/json')) {
      const body = await request.json();
      recordsToProcess.push(body);
    } else if (contentType.includes('multipart/form-data')) {
      // --- MODIFIED: The parsing logic is now wrapped to handle the type mismatch ---
      const { files } = await parseForm(request);
      const file = files.tenantsCsv?.[0]; // The key 'tenantsCsv' must match the frontend

      if (!file) {
        return NextResponse.json({ error: 'No CSV file was uploaded.' }, { status: 400 });
      }
      const csvContent = await fs.readFile(file.filepath, 'utf8');
      recordsToProcess = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }

    if (recordsToProcess.length === 0) {
        return NextResponse.json({ error: 'No data found to process.' }, { status: 400 });
    }

    const tenantsToUpsert = [];
    const userEmails = new Set<string>();

    for (const record of recordsToProcess) {
        const ownerEmail = record.owner_email;
        const adminEmail = record.admin_email;
        const maxDomains = parseInt(record.max_domains, 10);

        if (!ownerEmail || !adminEmail || isNaN(maxDomains)) {
            console.warn('Skipping invalid record:', record);
            continue;
        }
        userEmails.add(ownerEmail);
        tenantsToUpsert.push({
            owner_email: ownerEmail,
            admin_email: adminEmail,
            max_domains: maxDomains,
        });
    }

    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('email', Array.from(userEmails));

    if (userError) throw userError;

    const userEmailToIdMap = new Map(users!.map(u => [u.email, u.id]));

    const finalTenantData = tenantsToUpsert.map(tenant => ({
        admin_email: tenant.admin_email,
        max_domains: tenant.max_domains,
        owner_id: userEmailToIdMap.get(tenant.owner_email)
    })).filter(tenant => tenant.owner_id);

    const { error } = await supabase
      .from('tenants')
      .upsert(finalTenantData, { onConflict: 'admin_email' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: `Database operation failed: ${error.message}` }, { status: 500 });
    }

    const skippedCount = recordsToProcess.length - finalTenantData.length;
    return NextResponse.json({ message: `Successfully processed ${finalTenantData.length} tenants. ${skippedCount > 0 ? `${skippedCount} records were skipped due to missing owners.` : ''}` });

  } catch (error: any) {
    console.error('Error processing tenants:', error);
    return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
  }
}