// Script to fix admin user role
// This script updates the existing management@superwave.ai user to ensure admin role is applied
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

// Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zfwaqmkqqykfptczwqwo.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ;

// Admin user email to find and fix
const ADMIN_EMAIL = 'management@superwave.ai';

async function listUsers() {
  console.log('Fetching users from Supabase...');
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.users.length} users in the system.`);
    
    // Find admin user
    const adminUser = data.users.find(user => user.email === ADMIN_EMAIL);
    if (!adminUser) {
      console.log(`❌ Admin user ${ADMIN_EMAIL} not found. Try running setup.js first.`);
      return null;
    }
    
    console.log('Found admin user:', {
      id: adminUser.id,
      email: adminUser.email,
      created_at: adminUser.created_at,
      role: adminUser.user_metadata?.role || 'none'
    });
    
    return adminUser;
  } catch (error) {
    console.error('Error fetching users:', error.message);
    return null;
  }
}

async function updateUserRole(userId) {
  console.log(`Updating user ${userId} to admin role...`);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        user_metadata: { 
          role: 'admin',
          name: 'Administrator'
        }
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `Failed to update user: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ User role updated successfully:', {
      id: data.id,
      email: data.email,
      role: data.user_metadata?.role || 'none'
    });
    
    return data;
  } catch (error) {
    console.error('Error updating user role:', error.message);
    return null;
  }
}

// Run the fix script
async function fixAdminUser() {
  console.log('Starting admin user role fix...');
  
  // First, list users to find admin
  const adminUser = await listUsers();
  if (!adminUser) {
    return;
  }
  
  // Check if the role already exists
  if (adminUser.user_metadata?.role === 'admin') {
    console.log('✅ User already has admin role. No changes needed.');
    return;
  }
  
  // Update the user role
  await updateUserRole(adminUser.id);
}

// Run the script
fixAdminUser()
  .then(() => {
    console.log('Admin user role fix completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fix admin user role failed:', err);
    process.exit(1);
  });