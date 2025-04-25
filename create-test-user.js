// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Supabase credentials from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use the service role key

// Test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase URL or Service Role Key in environment variables.');
  console.error('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

console.log('Attempting to create test user:', TEST_EMAIL);

// Function to create a user directly using Supabase Auth Admin API
async function createTestUser() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY, // Use service key for admin actions
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` // Use service key for admin actions
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true, // Automatically confirm the email
        user_metadata: { role: 'user' } // Assign a default role if needed
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Check if the user already exists
      if (data.msg && data.msg.toLowerCase().includes('already registered')) {
        console.log(`🟡 Test user ${TEST_EMAIL} already exists.`);
        return; // Exit gracefully if user exists
      }
      // Log other errors
      console.error('❌ Error response from Supabase:', data);
      throw new Error(data.msg || `Failed to create user. Status: ${response.status}`);
    }

    console.log(`✅ Test user created successfully: ${TEST_EMAIL}`);
    // console.log('User data:', data); // Optionally log the full response
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exitCode = 1; // Indicate failure
  }
}

// Run the creation function
createTestUser();