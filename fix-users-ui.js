// This script forces an update of the user_profiles data without adding new columns
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxMjQ0NiwiZXhwIjoyMDYwOTg4NDQ2fQ._b4muH3igc6CwPxTp7uPM54FWSCZkK1maSSbF7dAlQM';

console.log('Using Supabase service key to fix UI data');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  try {
    // Get all users from auth.users
    console.log('Fetching auth users...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error fetching auth users:', usersError);
      return;
    }
    
    const users = usersData?.users || [];
    console.log(`Found ${users.length} users in Auth`);
    
    // First check the table structure to confirm what columns exist
    const { data: tableInfo, error: tableError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
      
    if (tableError) {
      console.error('Error checking table structure:', tableError);
      return;
    }
    
    console.log('Table columns:', Object.keys(tableInfo[0] || {}).join(', '));
    
    // Process each user
    for (const user of users) {
      console.log(`Processing user: ${user.email}`);
      
      // Create a basic profile with only existing fields
      const profile = {
        id: user.id,
        email: user.email || 'unknown@example.com',
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: user.email === 'management@superwave.ai' ? 'admin' : 
              (user.user_metadata?.role || 'user'),
        active: true,
        created_at: new Date().toISOString() // Force a timestamp update
      };
      
      // Update user metadata
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          updated_at: new Date().toISOString()
        }
      });
      
      // Force update the profile
      const { error: upsertError } = await supabase
        .from('user_profiles')
        .upsert(profile, { 
          onConflict: 'id',
          returning: 'minimal' // Don't need to return the record
        });
      
      if (upsertError) {
        console.error(`Error updating profile for ${user.email}:`, upsertError);
      } else {
        console.log(`Successfully updated profile for ${user.email}`);
      }
    }
    
    // Double-check that profiles were updated
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (profilesError) {
      console.error('Error checking profiles after update:', profilesError);
    } else {
      console.log(`Found ${profilesData.length} profiles after update:`);
      profilesData.forEach(profile => {
        console.log(`- ${profile.email} (Role: ${profile.role}, Active: ${profile.active})`);
      });
    }
    
    console.log('User profiles update completed');
  } catch (error) {
    console.error('Error in script:', error);
  }
}

main();