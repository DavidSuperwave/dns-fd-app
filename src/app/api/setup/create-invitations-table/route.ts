import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase-admin';

export async function POST() {
  try {
    console.log('[Setup] Creating invitations table...');
    
    // Create admin client
    const supabaseAdmin = createAdminClient();
    
    // SQL to create invitations table
    const createTableSQL = `
      -- Create invitations table for user invites
      CREATE TABLE IF NOT EXISTS public.invitations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          token TEXT NOT NULL UNIQUE,
          created_by TEXT DEFAULT 'system',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
          used_at TIMESTAMP WITH TIME ZONE
      );

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
      CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
      CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

      -- Enable Row Level Security
      ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies first
      DROP POLICY IF EXISTS "Allow admins to read invitations" ON public.invitations;
      DROP POLICY IF EXISTS "Allow admins to insert invitations" ON public.invitations;
      DROP POLICY IF EXISTS "Allow service to insert invitations" ON public.invitations;
      DROP POLICY IF EXISTS "Allow service to read invitations" ON public.invitations;
      DROP POLICY IF EXISTS "Allow service to update invitations" ON public.invitations;

      -- Allow admins to read all invitations
      CREATE POLICY "Allow admins to read invitations" ON public.invitations
          FOR SELECT TO authenticated
          USING (
              EXISTS (
                  SELECT 1 FROM auth.users
                  WHERE id = auth.uid() AND email = 'admin@superwave.io'
              ) OR
              EXISTS (
                  SELECT 1 FROM user_profiles
                  WHERE id = auth.uid() AND role = 'admin'
              )
          );

      -- Allow admins to insert invitations
      CREATE POLICY "Allow admins to insert invitations" ON public.invitations
          FOR INSERT TO authenticated
          WITH CHECK (
              EXISTS (
                  SELECT 1 FROM auth.users
                  WHERE id = auth.uid() AND email = 'admin@superwave.io'
              ) OR
              EXISTS (
                  SELECT 1 FROM user_profiles
                  WHERE id = auth.uid() AND role = 'admin'
              )
          );

      -- Allow service role to insert invitations (for API)
      CREATE POLICY "Allow service to insert invitations" ON public.invitations
          FOR INSERT TO service_role
          WITH CHECK (true);

      -- Allow service role to read invitations (for API)
      CREATE POLICY "Allow service to read invitations" ON public.invitations
          FOR SELECT TO service_role
          USING (true);

      -- Allow service role to update invitations (for API)
      CREATE POLICY "Allow service to update invitations" ON public.invitations
          FOR UPDATE TO service_role
          USING (true);
    `;

    // Execute the SQL
    const { error } = await supabaseAdmin.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });

    if (error) {
      console.error('[Setup] Error creating invitations table:', error);
      // Try direct SQL execution instead
      const { error: directError } = await supabaseAdmin
        .from('invitations')
        .select('id')
        .limit(1);
      
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, we need to create it manually
        console.log('[Setup] Table does not exist, attempting manual creation...');
        
        // For now, return a response that guides the user to create the table manually
        return NextResponse.json({
          success: false,
          error: 'invitations table does not exist',
          message: 'Please run the SQL script in create-invitations-table.sql in your Supabase SQL editor',
          sql: createTableSQL
        }, { status: 500 });
      }
      
      throw error;
    }

    console.log('[Setup] Invitations table created successfully');

    return NextResponse.json({
      success: true,
      message: 'Invitations table created successfully'
    });

  } catch (error) {
    console.error('[Setup] Error in invitations table creation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invitations table',
      details: error
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Check if table exists
    const supabaseAdmin = createAdminClient();
    
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          exists: false,
          error: 'Table does not exist'
        });
      }
      throw error;
    }

    return NextResponse.json({
      exists: true,
      message: 'Invitations table exists'
    });

  } catch (error) {
    return NextResponse.json({
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
