// This script creates user profile entries for any users that don't have them
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Using Supabase service key to sync users');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create a simple function to handle the API responses
function handleError(error, message) {
  if (error) {
    console.error(`${message}:`, error);
    return true;
  }
  return false;
}

async function main() {
  try {
    // Get all users from auth.users
    console.log('Fetching users from Supabase Auth...');
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (handleError(usersError, 'Error fetching users')) {
      return;
    }
    
    const users = usersData?.users || [];
    console.log(`Found ${users.length} users in Supabase Auth`);
    
    // Try to create a simple insert for each user
    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email}`);
        
        // Create user entry in user_profiles table if it doesn't exist
        const profile = {
          id: user.id,
          email: user.email || 'unknown@example.com',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          role: user.email === 'management@superwave.ai' ? 'admin' : 
                (user.user_metadata?.role || 'user'),
          active: true
        };
        
        const { error: insertError } = await supabase
          .from('user_profiles')
          .upsert(profile);
        
        if (insertError) {
          // If the table doesn't exist, create it
          if (insertError.code === '42P01') { // Table doesn't exist error
            console.log('The user_profiles table does not exist. Creating it now...');
            
            // Use the REST API to execute SQL (since RPC is not available)
            const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                sql: `
                  CREATE TABLE IF NOT EXISTS user_profiles (
                    id UUID PRIMARY KEY,
                    email TEXT NOT NULL,
                    name TEXT,
                    role TEXT,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                  );
                `
              })
            });
            
            if (!res.ok) {
              const errorData = await res.json();
              console.error('Error creating table:', errorData);
              
              // Try the direct Supabase API approach
              console.log('Trying direct table creation via Supabase API...');
              
              const { error: createTableError } = await supabase
                .from('user_profiles')
                .insert(profile);
              
              if (createTableError) {
                console.error('Failed to create table via insert:', createTableError);
                console.log('Please run this SQL in the Supabase SQL editor:');
                console.log(`
                  CREATE TABLE IF NOT EXISTS user_profiles (
                    id UUID PRIMARY KEY,
                    email TEXT NOT NULL,
                    name TEXT,
                    role TEXT,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                  );
                `);
              } else {
                console.log('Successfully created table via insert!');
              }
            } else {
              console.log('Table created successfully via SQL!');
              
              // Try insert again
              const { error: retryError } = await supabase
                .from('user_profiles')
                .upsert(profile);
              
              if (retryError) {
                console.error(`Error creating profile for ${user.email} after table creation:`, retryError);
              } else {
                console.log(`Created profile for ${user.email}`);
              }
            }
          } else {
            console.error(`Error creating profile for ${user.email}:`, insertError);
          }
        } else {
          console.log(`Created/updated profile for ${user.email}`);
        }
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
      }
    }
    
    console.log('User synchronization complete');
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

main();