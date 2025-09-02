import { createClient } from '@/lib/supabase-client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('API: Fetching users from server-side');
    
    // Use server-side Supabase client with admin privileges
    const supabase = createClient();
    
    // Fetch users from user_profiles table
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, email')
      .order('email', { ascending: true });
    
    if (error) {
      console.error('API: Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API: Successfully fetched ${users?.length || 0} users`);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('API: Unexpected error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
