// This script can be run to create the user_profiles table in Supabase
// Execute this script once to set up your database structure

import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key (not anon key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2FxbWtxcXlrZnB0Y3p3cXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxMjQ0NiwiZXhwIjoyMDYwOTg4NDQ2fQ._b4muH3igc6CwPxTp7uPM54FWSCZkK1maSSbF7dAlQM';

// Service key is now hardcoded for convenience, but in production you should use environment variables
console.log('Using Supabase service key');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserProfilesTable() {
  console.log('Creating user_profiles table if it doesn\'t exist...');
  
  // Create the user_profiles table
  const { error } = await supabase.rpc('create_user_profiles_table', {});
  
  if (error) {
    console.error('Error creating user_profiles table:', error);
    
    // Try direct SQL approach if RPC fails
    const { error: sqlError } = await supabase.from('user_profiles').select('id').limit(1);
    
    if (sqlError && sqlError.code === '42P01') { // Table doesn't exist error
      console.log('Table doesn\'t exist, creating it directly with SQL...');
      
      // Execute raw SQL to create the table
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS user_profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            name TEXT,
            role TEXT CHECK (role IN ('admin', 'user', 'guest')),
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            domains TEXT[] DEFAULT '{}'::TEXT[],
            totp_enabled BOOLEAN DEFAULT FALSE
          );
          
          -- Create policies to allow secure access
          CREATE POLICY "Allow users to read their own profile"
            ON user_profiles FOR SELECT
            USING (auth.uid() = id);
            
          CREATE POLICY "Allow admins to read all profiles"
            ON user_profiles FOR SELECT
            USING (
              EXISTS (
                SELECT 1 FROM auth.users
                WHERE auth.users.id = auth.uid()
                AND (
                  auth.users.email = 'management@superwave.ai' OR
                  auth.users.raw_user_meta_data->>'role' = 'admin'
                )
              )
            );
            
          -- Create trigger to handle user deletion
          CREATE OR REPLACE FUNCTION handle_deleted_user()
          RETURNS TRIGGER AS $$
          BEGIN
            DELETE FROM user_profiles WHERE id = OLD.id;
            RETURN OLD;
          END;
          $$ LANGUAGE plpgsql;
          
          DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
          CREATE TRIGGER on_auth_user_deleted
            AFTER DELETE ON auth.users
            FOR EACH ROW EXECUTE FUNCTION handle_deleted_user();
        `
      });
      
      if (createError) {
        console.error('Error creating table with SQL:', createError);
      } else {
        console.log('User profiles table created successfully');
      }
    } else if (sqlError) {
      console.error('Error checking if table exists:', sqlError);
    } else {
      console.log('User profiles table already exists');
    }
  } else {
    console.log('User profiles table creation successful via RPC');
  }
}

async function syncExistingUsers() {
  console.log('Syncing existing users to user_profiles table...');
  
  // Get all users from auth.users
  const { data: users, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  for (const user of users.users) {
    // Check if user already has a profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (!profile) {
      // Create profile for user
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          role: user.email === 'management@superwave.ai' ? 'admin' : 
                (user.user_metadata?.role || 'user'),
          active: !user.user_metadata?.is_banned,
          created_at: user.created_at,
          domains: user.user_metadata?.domains || [],
          totp_enabled: Boolean(user.user_metadata?.totp_secret)
        });
        
      if (insertError) {
        console.error(`Error creating profile for user ${user.email}:`, insertError);
      } else {
        console.log(`Created profile for ${user.email}`);
      }
    } else {
      console.log(`Profile already exists for ${user.email}`);
    }
  }
  
  console.log('User synchronization complete');
}

async function main() {
  try {
    await createUserProfilesTable();
    await syncExistingUsers();
    console.log('Setup complete!');
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

main();