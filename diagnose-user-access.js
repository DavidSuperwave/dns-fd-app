// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase credentials from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the service role key

// User email to diagnose
const USER_EMAIL = 'test@example.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase URL or Service Role Key in environment variables.');
  console.error('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Create Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log(`🔍 Diagnosing access for user: ${USER_EMAIL}`);

async function diagnoseUserAccess() {
  try {
    // 1. Check user role in user_profiles
    console.log(`\n1. Checking role in 'user_profiles' table...`);
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, id') // Select role and id for reference
      .eq('email', USER_EMAIL)
      .single(); // Expecting only one profile

    if (profileError) {
      if (profileError.code === 'PGRST116') { // Code for 'No rows found'
         console.error(`❌ Error: No profile found for user ${USER_EMAIL} in 'user_profiles'.`);
      } else {
        console.error(`❌ Error fetching profile for ${USER_EMAIL}:`, profileError.message);
      }
      // Continue to check assignments even if profile is missing/errored
    } else if (profileData) {
      console.log(`✅ Role found: ${profileData.role}`);
      console.log(`   User Profile ID: ${profileData.id}`);
      if (profileData.role === 'admin') {
        console.warn(`⚠️ User has 'admin' role. This likely explains why they see all domains.`);
      }
    } else {
       console.log(`🟡 No profile data returned for ${USER_EMAIL}, though no explicit error occurred.`);
    }

    // 2. Check domain assignments in domain_assignments
    console.log(`\n2. Checking assignments in 'domain_assignments' table...`);
    const { data: assignmentData, error: assignmentError } = await supabaseAdmin
      .from('domain_assignments')
      .select('domain_id') // Select only the domain ID
      .eq('user_email', USER_EMAIL);

    if (assignmentError) {
      console.error(`❌ Error fetching assignments for ${USER_EMAIL}:`, assignmentError.message);
      return; // Stop if we can't get assignments
    }

    if (assignmentData && assignmentData.length > 0) {
      console.log(`✅ Found ${assignmentData.length} domain assignments:`);
      // Log first few assignments for brevity if there are many
      assignmentData.slice(0, 10).forEach(assignment => {
        console.log(`   - Domain ID: ${assignment.domain_id}`);
      });
      if (assignmentData.length > 10) {
        console.log(`   ... and ${assignmentData.length - 10} more.`);
      }

      // Compare with total domains (optional, but informative)
      const { count: totalDomainsCount, error: totalDomainsError } = await supabaseAdmin
        .from('domains')
        .select('*', { count: 'exact', head: true }); // Only get the count

      if (!totalDomainsError && totalDomainsCount !== null) {
         console.log(`   (Total domains in 'domains' table: ${totalDomainsCount})`);
         if (assignmentData.length === totalDomainsCount && totalDomainsCount > 0) {
             console.warn(`⚠️ User is assigned to ALL (${totalDomainsCount}) domains. This could also explain why they see all domains.`);
         }
      }

    } else {
      console.log(`✅ No domain assignments found for ${USER_EMAIL}.`);
    }

    console.log(`\n🏁 Diagnosis complete.`);

  } catch (error) {
    console.error('\n❌ An unexpected error occurred during diagnosis:', error);
    process.exitCode = 1;
  }
}

// Run the diagnosis
diagnoseUserAccess();