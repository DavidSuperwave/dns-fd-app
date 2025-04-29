import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client'; // Import only the admin client

export const dynamic = 'force-dynamic'; // Ensure fresh data on each request

export async function GET(request: NextRequest) {
  try {
    // 1. Verify requesting user is authenticated and is an admin via JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated: Missing or invalid Authorization header' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    if (!supabaseAdmin) {
        console.error('[API UsersWithDomains] Supabase admin client is not initialized.');
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      console.warn('[API UsersWithDomains] Authentication failed via token.', authError);
      const status = authError?.message.includes('invalid JWT') ? 401 : 500;
      return NextResponse.json({ error: `Authentication failed: ${authError?.message || 'Unknown error'}` }, { status });
    }

    // Check if the requesting user is an admin
    const isAdmin = requestingUser?.user_metadata?.role === 'admin' || requestingUser?.email === process.env.ADMIN_EMAIL;
    if (!isAdmin) {
      console.warn(`[API UsersWithDomains] Forbidden attempt by non-admin: ${requestingUser.email}`);
      return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
    }

    // 2. Fetch data separately using supabaseAdmin
    const [profilesRes, assignmentsRes, domainsRes] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('*'),
      // Use the correct column name 'user_email' found in the setup script
      supabaseAdmin.from('domain_assignments').select('user_email, domain_id'),
      supabaseAdmin.from('domains').select('id, name') // Only select needed domain fields
    ]);

    if (profilesRes.error) {
      console.error('[API UsersWithDomains] Error fetching profiles:', profilesRes.error);
      return NextResponse.json({ error: `Database error (profiles): ${profilesRes.error.message}` }, { status: 500 });
    }
    if (assignmentsRes.error) {
      console.error('[API UsersWithDomains] Error fetching assignments:', assignmentsRes.error);
      return NextResponse.json({ error: `Database error (assignments): ${assignmentsRes.error.message}` }, { status: 500 });
    }
     if (domainsRes.error) {
      console.error('[API UsersWithDomains] Error fetching domains:', domainsRes.error);
      return NextResponse.json({ error: `Database error (domains): ${domainsRes.error.message}` }, { status: 500 });
    }

    const profiles = profilesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const domains = domainsRes.data || [];

    // Create a map for quick domain lookup
    const domainMap = new Map(domains.map(d => [d.id, d.name]));

    // Create a map for user assignments using the correct 'user_email'
    const userAssignmentsMap = new Map<string, string[]>(); // Map<user_email, domain_id[]>
    assignments.forEach(a => {
      // Use the correct column name 'user_email' here
      if (!userAssignmentsMap.has(a.user_email)) {
        userAssignmentsMap.set(a.user_email, []);
      }
      userAssignmentsMap.get(a.user_email)?.push(a.domain_id);
    });

    // Join the data using profile.email to look up assignments
    const processedData = profiles.map(profile => {
      const assignedDomainIds = userAssignmentsMap.get(profile.email) || []; // Use email for lookup
      const assignedDomainNames = assignedDomainIds
        .map(domainId => domainMap.get(domainId)) // Get name from domainMap
        .filter((name): name is string => !!name); // Filter out undefined names (if domain deleted but assignment exists)

      return {
        ...profile,
        domain_names: assignedDomainNames,
      };
    });

    // 3. Return the data
    return NextResponse.json(processedData, { status: 200 });

  } catch (error) {
    console.error('[API UsersWithDomains] General Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}