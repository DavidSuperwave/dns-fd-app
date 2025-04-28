import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';


export async function POST(request: NextRequest) {
  let domain_id: string | null = null; // Use let and initialize
  let user_email: string | null = null; // Use let and initialize

  try {
    // Parse the request body safely
    const body = await request.json();
    domain_id = body.domain_id; // Assign here
    user_email = body.user_email; // Assign here

    console.log('Domain assignment API received request:', { domain_id, user_email });

    if (!domain_id || !user_email) {
      console.error('Missing required fields:', { domain_id, user_email });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: domain_id and user_email are required.' }, // More specific error
        { status: 400 }
      );
    }

    console.log('Attempting to create domain assignment:', { domain_id, user_email });

    // --- Database Operations ---
    try {
      // Log the type of domain_id received
      console.log(`Type of domain_id received: ${typeof domain_id}, Value: ${domain_id}`);

      // Verify user_email exists in user_profiles
      if (!supabaseAdmin) {
        console.error('Supabase client is not initialized.');
        return NextResponse.json(
          { success: false, error: 'Internal server error: Supabase client is not initialized.' },
          { status: 500 }
        );
      }

      const { data: userProfile, error: userCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', user_email)
        .maybeSingle();

      if (userCheckError) {
        console.error(`Error checking user profile for email ${user_email}:`, userCheckError);
        return NextResponse.json(
          { success: false, error: `Database error checking user: ${userCheckError.message}` },
          { status: 500 }
        );
      }

      if (!userProfile) {
        console.error(`User profile not found for email: ${user_email}`);
        return NextResponse.json(
          { success: false, error: `User with email ${user_email} not found.` },
          { status: 404 } // Not Found - User doesn't exist
        );
      }
      console.log(`User profile found for ${user_email}: ID ${userProfile.id}`);

      // 1. Delete existing assignments for this domain_id
      const { error: deleteError } = await supabaseAdmin
        .from('domain_assignments')
        .delete()
        .eq('domain_id', domain_id); // Use the potentially updated domain_id

      if (deleteError) {
        // Log warning but don't necessarily fail, maybe no prior assignment existed
        console.warn(`Warning when deleting existing assignments for domain_id ${domain_id}:`, deleteError.message);
      } else {
        console.log(`Successfully deleted any existing assignments for domain_id ${domain_id}`);
      }

      // 2. Create the new assignment
      const { data, error: insertError } = await supabaseAdmin
        .from('domain_assignments')
        .insert({
          domain_id: domain_id, // Use the potentially updated domain_id
          user_email: user_email,
          created_by: user_email // Assuming the creator is the assignee initially
        })
        .select(); // Select the inserted row to confirm

      if (insertError) {
        const errorMessage = `Database insert error: ${insertError.message || 'Unknown insert error'}`;
        console.error(`Error inserting domain assignment for domain_id ${domain_id}:`, insertError);
        // Ensure a non-empty string error message is returned
        return NextResponse.json(
          { success: false, error: String(errorMessage) }, // Explicitly cast to string
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        const noDataError = `Insert operation returned no data for domain_id ${domain_id}. Assignment might have failed silently.`;
        console.error(noDataError);
        return NextResponse.json(
          { success: false, error: String(noDataError) }, // Explicitly cast to string
          { status: 500 }
        );
      }

      console.log(`Domain assignment created successfully for domain_id ${domain_id}:`, data);
      return NextResponse.json({
        success: true,
        data,
        message: 'Domain assignment created successfully'
      });

    } catch (dbError: unknown) {
      // Catch errors specifically from the database operations block
      const dbErrorMessage = `Database operation failed: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`;
      console.error(`Database error during assignment process for domain_id ${domain_id}:`, dbError);
      return NextResponse.json(
        { success: false, error: String(dbErrorMessage) }, // Explicitly cast to string
        { status: 500 }
      );
    }
    // --- End Database Operations ---

  } catch (error: unknown) {
    // Catch errors from request parsing or other unexpected issues
    const serverErrorMessage = `Server error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`;
    console.error('Unexpected error in domain assignment API:', { error: serverErrorMessage, domain_id, user_email }); // Use safe serverErrorMessage
    return NextResponse.json(
      { success: false, error: String(serverErrorMessage) }, // Explicitly cast to string
      { status: 500 }
    );
  }
}