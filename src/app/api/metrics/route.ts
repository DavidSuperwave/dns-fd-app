import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- Metric 1: Count domains that need to be deployed (Unchanged) ---
    const { count: domainsToDeployCount, error: deployCountError } = await supabase
      .from('domains')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .is('deployment_status', null);

    if (deployCountError) throw deployCountError;

    // --- Metric 2: Count total domains assigned to each user (Corrected Logic) ---

    // Step A: Get all assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('domain_assignments')
      .select('user_email');

    if (assignmentsError) throw assignmentsError;

    // Step B: Get all user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('email, name');

    if (profilesError) throw profilesError;

    // Step C: Create a map for easy lookup
    const emailToNameMap = new Map(profiles.map(p => [p.email, p.name]));

    // Step D: Process the data in JavaScript to get the final counts
    const userCountsMap = new Map<string, { name: string | null; count: number }>();
    if (assignments) {
      for (const assignment of assignments) {
        const email = assignment.user_email;
        const name = emailToNameMap.get(email) || email; // Get name from map, fallback to email
        const current = userCountsMap.get(email) || { name, count: 0 };
        current.count++;
        userCountsMap.set(email, current);
      }
    }
    
    const userMetrics = Array.from(userCountsMap.entries()).map(([email, data]) => ({
        email,
        name: data.name,
        domain_count: data.count,
    }));
    const metrics = {
      domains_to_deploy: domainsToDeployCount ?? 0,
      domains_per_user: userMetrics,
    };

    return NextResponse.json(metrics);

  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}