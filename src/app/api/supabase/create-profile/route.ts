import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxMjQ0NiwiZXhwIjoyMDYwOTg4NDQ2fQ._b4muH3igc6CwPxTp7uPM54FWSCZkK1maSSbF7dAlQM';

// Initialize Supabase client with admin privileges
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // Extract user data from request
    const { userId, email, name, role } = await request.json();
    
    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'User ID and email are required' },
        { status: 400 }
      );
    }
    
    console.log('[API] Creating user profile for', { userId, email, role });
    
    // First check if the table exists
    const { error: tableCheckError } = await adminSupabase
      .from('user_profiles')
      .select('id')
      .limit(1);
      
    // Create the table if it doesn't exist
    if (tableCheckError && tableCheckError.code === '42P01') {
      console.log('[API] user_profiles table does not exist, creating it');
      
      // Define SQL to create the table
      const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.user_profiles (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        role TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      `;
      
      // Execute SQL directly using service role
      const { error: createError } = await adminSupabase.rpc('exec_sql', {
        sql: createTableSQL
      });
      
      if (createError) {
        console.error('[API] Failed to create user_profiles table:', createError);
        // Continue anyway, the table might exist but with different structure
      }
    }
    
    // Try both methods of creating the profile
    
    // First check if user is already confirmed in auth
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.getUserById(userId);
    
    if (authError) {
      console.error('[API] Error fetching auth user:', authError);
      throw authError;
    }

    // Determine initial status based on email confirmation
    const isConfirmed = authUser.user?.email_confirmed_at || authUser.user?.last_sign_in_at;
    
    // 1. Direct insert with proper status
    const { error: insertError } = await adminSupabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        name: name || email.split('@')[0],
        role: role || 'user',
        status: isConfirmed ? 'active' : 'pending',
        active: true,
        created_at: new Date().toISOString(),
        confirmed_at: isConfirmed ? authUser.user.email_confirmed_at : null
      });
      
    if (insertError) {
      console.error('[API] Error inserting user profile:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: insertError.message,
          details: {
            code: insertError.code,
            hint: insertError.hint,
            details: insertError.details
          }
        },
        { status: 500 }
      );
    }
    
    // If we get here, the direct insert worked
    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      method: 'insert'
    });
    
  } catch (error) {
    console.error('[API] Error creating user profile:', error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      ...error
    } : error;
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create user profile',
        details: errorDetails
      },
      { status: 500 }
    );
  }
}