// Cloudflare API Diagnostic Script
// This script tests direct communication with Cloudflare's API to diagnose issues

const https = require('https');
const fs = require('fs');

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // User provided correct account ID
let CLOUDFLARE_EMAIL;
let CLOUDFLARE_API_KEY;

// Using hardcoded credentials as specified by user
CLOUDFLARE_EMAIL = 'dns@superwave.ai';
CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN; // User provided correct API token

console.log(`Using API Token authentication for diagnostic tests`);

// Function to make a Cloudflare API request
function makeCloudflareRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
      }
    };

    // Log what we're sending
    console.log(`\nMaking ${method} request to: https://api.cloudflare.com${endpoint}`);
    console.log('Headers:', JSON.stringify({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer (set but not shown)',
    }, null, 2));

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status Code: ${res.statusCode} ${res.statusMessage}`);
        console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
        
        try {
          const parsedData = JSON.parse(data);
          console.log('Response Body:', JSON.stringify(parsedData, null, 2));
          resolve({ statusCode: res.statusCode, data: parsedData });
        } catch (e) {
          console.log('Raw Response:', data);
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request Error:', error);
      reject(error);
    });
    
    req.end();
  });
}

// Run diagnostic tests
async function runDiagnostics() {
  console.log('=== CLOUDFLARE API DIAGNOSTIC TOOL ===');
  console.log('This tool will diagnose issues with Cloudflare API communication');
  
  // Check if credentials are set
  if (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY) {
    console.log('\n❌ ERROR: Cloudflare credentials are missing');
    console.log('Please ensure you have a Cloudflare_API_Token.txt file with:');
    console.log('Email: your-email@example.com');
    console.log('Global API Key: your-api-key');
    return;
  }
  
  try {
    // Test 1: Verify account
    console.log('\n=== TEST 1: Verify Account ===');
    const accountResult = await makeCloudflareRequest(`/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`);
    
    if (accountResult.statusCode === 200 && accountResult.data.success) {
      console.log(`✅ Account verification successful: ${accountResult.data.result.name}`);
    } else {
      console.log('❌ Account verification failed');
    }
    
    // Test 2: List zones (domains)
    console.log('\n=== TEST 2: List Zones (Domains) ===');
    const zonesResult = await makeCloudflareRequest(`/client/v4/zones?page=1&per_page=100`);
    
    if (zonesResult.statusCode === 200 && zonesResult.data.success) {
      console.log(`✅ Successfully retrieved ${zonesResult.data.result.length} zones`);
      zonesResult.data.result.forEach((zone, index) => {
        console.log(`   ${index + 1}. ${zone.name} (${zone.id})`);
      });
    } else {
      console.log('❌ Failed to retrieve zones');
    }
    
    // Test 3: Check permissions
    console.log('\n=== TEST 3: Check User Permissions ===');
    const userDetailsResult = await makeCloudflareRequest('/client/v4/user');
    
    if (userDetailsResult.statusCode === 200 && userDetailsResult.data.success) {
      console.log(`✅ User API access successful: ${userDetailsResult.data.result.email}`);
    } else {
      console.log('❌ Failed to get user details');
    }
    
  } catch (error) {
    console.error('Error running diagnostics:', error);
  }
  
  console.log('\n=== DIAGNOSTIC RESULTS ===');
  console.log('If any tests failed, check the error messages and ensure:');
  console.log('1. The email is correctly formatted and matches your Cloudflare account');
  console.log('2. The Global API key is valid (not a regular API token)');
  console.log('3. The account ID is correct');
  console.log('\nIf you need to fix your app code:');
  console.log('- Check authentication headers in dns-fd-app/src/lib/cloudflare-api.ts');
  console.log('- Ensure environment variables are correctly loaded');
}

// Run the diagnostics
runDiagnostics();