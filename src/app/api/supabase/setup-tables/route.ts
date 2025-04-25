import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() { // Remove unused 'request' parameter
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create scan_progress table
    const { error: createError } = await supabase.rpc('create_scan_progress_table');

    if (createError) {
      // If RPC fails, try direct SQL
      const { error: sqlError } = await supabase.from('scan_progress').select('id').limit(1);
      
      if (sqlError && sqlError.code === '42P01') {
        // Table doesn't exist, create it
        await supabase.rpc('execute_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS scan_progress (
              id SERIAL PRIMARY KEY,
              scan_id TEXT UNIQUE NOT NULL,
              status TEXT NOT NULL,
              current_page INTEGER NOT NULL DEFAULT 1,
              total_pages INTEGER,
              domains_processed INTEGER NOT NULL DEFAULT 0,
              total_domains INTEGER,
              started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              completed_at TIMESTAMP WITH TIME ZONE,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              error_message TEXT
            );

            -- Enable row level security
            ALTER TABLE scan_progress ENABLE ROW LEVEL SECURITY;

            -- Create policies
            CREATE POLICY "Enable read access for all users" 
            ON scan_progress FOR SELECT 
            USING (true);

            CREATE POLICY "Enable write access for service role" 
            ON scan_progress FOR ALL 
            USING (auth.role() = 'service_role');

            -- Create index on is_active for efficient querying of active scans
            CREATE INDEX IF NOT EXISTS idx_scan_progress_is_active ON scan_progress(is_active);
          `
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting up tables:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}