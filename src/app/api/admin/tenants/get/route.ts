import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // This route uses the admin client to bypass RLS securely
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // This is the same query logic we previously put in the RPC function
    const { data, error } = await supabase
      .from('tenants')
      .select('*, user_profiles(email)');

    if (error) {
      // Check for the specific relationship error
      if (error.code === 'PGRST200') {
        return NextResponse.json({ 
          error: "Database relationship between tenants and user_profiles not found. Please ensure the foreign key is correctly set up." 
        }, { status: 500 });
      }
      throw error;
    }

    // Rename the nested 'user_profiles' to a simpler 'owner_email' for the client
    const formattedData = data.map(tenant => ({
      id: tenant.id,
      admin_email: tenant.admin_email,
      max_domains: tenant.max_domains,
      owner_email: tenant.user_profiles?.email || null
    }));

    return NextResponse.json(formattedData);

  } catch (error: any) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}