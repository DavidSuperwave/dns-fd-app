// Simple script to test task creation in Supabase
// Using Next.js environment variables - make sure to run with 'npm run test-task'

// Import the path module to resolve paths
const path = require('path');

// Import the createClient function from the existing supabase-client
// This is a workaround since we can't directly access the .env.local file
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL. Make sure to run script with correct environment.');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Make sure to run script with correct environment.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test task data
const testTask = {
  user_id: 'test-user-id',
  user_account: 'Test Account',
  user_email: 'test@example.com',
  task_type: 'DNS Configuration',
  description: 'Test task created via script',
  priority: 'Medium',
  status: 'Open',
  assigned_to: 'Support Team',
  tags: ['test', 'automated']
};

// Function to create a task
async function createTask() {
  console.log('Creating test task...');
  
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert(testTask)
      .select();
    
    if (error) {
      console.error('Error creating task:', error);
      return;
    }
    
    console.log('Task created successfully:', data);
  } catch (err) {
    console.error('Exception during task creation:', err);
  }
}

// Function to list all tasks
async function listTasks() {
  console.log('Listing all tasks...');
  
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error listing tasks:', error);
      return;
    }
    
    console.log('Tasks:', data);
  } catch (err) {
    console.error('Exception during task listing:', err);
  }
}

// Run the tests
async function runTests() {
  await createTask();
  await listTasks();
}

runTests();
