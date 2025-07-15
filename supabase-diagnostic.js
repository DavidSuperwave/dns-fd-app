// This script directly tests the Supabase connection and user profiles
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Using Supabase service key to run diagnostics');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('================================');
  console.log('SUPABASE DIAGNOSTIC REPORT');
  console.log('================================');
  
  try {
    // 1. Test connection by getting version info
    console.log('\n✅ Testing Supabase connection...');
    const { data: versionData, error: versionError } = await supabase.rpc('version');
    if (versionError) {
      console.error('❌ Error connecting to Supabase:', versionError.message);
    } else {
      console.log('✅ Connected to Supabase', versionData || 'Unknown version');
    }

    // 2. Get auth users info
    console.log('\n✅ Checking auth users...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Error fetching auth users:', usersError.message);
    } else {
      console.log(`✅ Found ${usersData?.users?.length || 0} users in auth system`);
      
      // Print user emails to verify we're fetching the right accounts
      if (usersData?.users?.length > 0) {
        console.log('\nAuth users:');
        usersData.users.forEach(user => {
          console.log(`- ${user.email} (ID: ${user.id.substring(0, 8)}...)`);
        });
      }
    }

    // 3. Check if user_profiles table exists
    console.log('\n✅ Checking if user_profiles table exists...');
    
    // Try to get table info from Postgres information_schema
    const { data: tableData, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'user_profiles')
      .single();
    
    if (tableError) {
      if (tableError.code === 'PGRST109') {
        console.log('✅ Could not directly check table existence due to RLS, trying to query it...');
      } else {
        console.error('❌ Error checking table existence:', tableError);
      }
      
      // Try to query the table directly to see if it exists
      const { data: profilesCheckData, error: profilesCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (profilesCheckError) {
        if (profilesCheckError.code === '42P01') {
          console.error('❌ The user_profiles table does not exist');
        } else {
          console.error('❌ Error querying user_profiles table:', profilesCheckError);
        }
      } else {
        console.log('✅ The user_profiles table exists');
      }
    } else {
      console.log('✅ The user_profiles table exists');
    }
    
    // 4. Get user profiles
    console.log('\n✅ Getting user profiles...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*');
    
    if (profilesError) {
      console.error('❌ Error fetching user profiles:', profilesError);
    } else {
      console.log(`✅ Found ${profilesData?.length || 0} user profiles`);
      
      // Print profile info to verify
      if (profilesData?.length > 0) {
        console.log('\nUser profiles:');
        profilesData.forEach(profile => {
          console.log(`- ${profile.email} (Role: ${profile.role}, Active: ${profile.active})`);
        });
      } else {
        console.log('❌ No user profiles found - this may indicate a problem!');
      }
    }
    
    // 5. Test a specific user fetch as the frontend would do
    console.log('\n✅ Simulating frontend user fetch...');
    
    // This is similar to how fetchUsers works in the client
    const { data: frontendData, error: frontendError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (frontendError) {
      console.error('❌ Error with frontend-style user fetch:', frontendError);
    } else {
      console.log(`✅ Frontend fetch returned ${frontendData?.length || 0} users`);
    }
    
    // 6. Check RLS policies on the table
    console.log('\n✅ Checking row-level security policies...');
    
    // Get RLS policy info
    const { data: policyData, error: policyError } = await supabase
      .from('pg_policies')
      .select('*')
      .ilike('tablename', 'user_profiles');
    
    if (policyError) {
      if (policyError.code === 'PGRST109') {
        console.log('ℹ️ Could not check policies due to permission restrictions');
      } else {
        console.error('❌ Error checking RLS policies:', policyError);
      }
    } else if (policyData?.length > 0) {
      console.log(`✅ Found ${policyData.length} RLS policies on user_profiles table`);
      policyData.forEach(policy => {
        console.log(`- ${policy.policyname}`);
      });
    } else {
      console.log('⚠️ No RLS policies found on user_profiles table');
    }
    
  } catch (error) {
    console.error('❌ Unhandled error in diagnostic script:', error);
  }
  
  console.log('\n================================');
  console.log('END OF DIAGNOSTIC REPORT');
  console.log('================================');
}

main();