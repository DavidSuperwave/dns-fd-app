// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin user credentials
const ADMIN_EMAIL = '';
const ADMIN_PASSWORD = '';

console.log('Supabase URL:', SUPABASE_URL);
console.log('Setting up admin user...');

// Function to create a user directly using Supabase Auth API
async function createUser() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'admin' }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      if (data.msg && data.msg.includes('already exists')) {
        console.log(`Admin user ${ADMIN_EMAIL} already exists.`);
        return;
      }
      throw new Error(data.msg || 'Failed to create user');
    }
    
    console.log(`✅ Admin user created successfully: ${ADMIN_EMAIL}`);
    console.log('User data:', data);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Run the setup
createUser()
  .then(() => {
    console.log('Setup completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });