import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchDomains } from '../../../../lib/cloudflare-api';
// import { cookies } from 'next/headers'; // Unused import

// Configure for edge runtime
export const runtime = 'edge';
// Disable static generation to ensure fresh data on each request
export const dynamic = 'force-dynamic';

/**
 * Manual sync endpoint
 * This endpoint allows authenticated users to manually trigger a sync
 * between Cloudflare and Supabase
 */
export async function POST(request: Request) {
  const startTime = performance.now();
  
  try {
    // Get the authentication token from request header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No authorization header provided for manual sync');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - missing token' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Initialize Supabase client with direct credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verify the token using Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token for manual sync', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }
    
    // Use service role key for database operations (more permissions)
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Starting manual Cloudflare to Supabase synchronization');
    
    // Fetch all domains from Cloudflare
    const { success, domains, error } = await fetchDomains(1, 100);
    
    if (!success || !domains) {
      throw new Error(`Failed to fetch domains from Cloudflare: ${error}`);
    }
    
    // Prepare domains for insertion/update in Supabase
    const timestamp = new Date().toISOString();
    // Define a type for the Cloudflare domain structure expected from fetchDomains
    interface CloudflareDomain {
      id: string;
      name: string;
      status: string;
      paused: boolean;
      type?: string; // Optional type
      created_on: string;
      modified_on: string;
      // Add other fields if necessary
    }
    const domainsForDB = domains.map((domain: CloudflareDomain) => ({ // Use the defined type
      cloudflare_id: domain.id,
      name: domain.name,
      status: domain.status,
      paused: domain.paused,
      type: domain.type || 'unknown',
      created_on: domain.created_on,
      modified_on: domain.modified_on,
      last_synced: timestamp,
      // Optionally associate with the user who triggered the sync
      user_id: user.id
    }));
    
    // Upsert domains to Supabase
    const { error: upsertError } = await adminSupabase
      .from('domains')
      .upsert(domainsForDB, { 
        onConflict: 'cloudflare_id',
        ignoreDuplicates: false 
      });
    
    if (upsertError) {
      throw new Error(`Failed to upsert domains to Supabase: ${upsertError.message}`);
    }
    
    // Record sync duration
    const durationMs = Math.round(performance.now() - startTime);
    
    // Create a sync record
    const { error: syncRecordError } = await adminSupabase
      .from('sync_history')
      .insert({
        timestamp,
        domains_count: domains.length,
        success: true,
        duration_ms: durationMs
      });
    
    if (syncRecordError) {
      console.error('Failed to create sync record', syncRecordError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Manually synchronized ${domains.length} domains from Cloudflare to Supabase`,
      timestamp,
      duration_ms: durationMs,
      user: user.email
    });
  } catch (error) {
    // Calculate duration even for failed runs
    const durationMs = Math.round(performance.now() - startTime);
    
    // Try to record the failed sync
    try {
      // Supabase credentials from environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from('sync_history')
        .insert({
          timestamp: new Date().toISOString(),
          domains_count: 0,
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          duration_ms: durationMs
        });
    } catch (dbError) {
      console.error('Failed to record sync error in database', dbError);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration_ms: durationMs
      },
      { status: 500 }
    );
  }
}