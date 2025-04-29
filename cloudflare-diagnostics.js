/**
 * Cloudflare API Diagnostics Script
 * 
 * This script tests connectivity to the Cloudflare API using the provided credentials.
 * It will attempt to fetch zones (domains) and report success or failure.
 */

// Cloudflare authentication credentials
const CLOUDFLARE_EMAIL = 'dns@superwave.ai';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// Cloudflare API base URL
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';

// Helper function to get authentication headers
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN.trim()}`
  };
}

// Function to test the API connection
async function testCloudflareApi() {
  console.log('\n=== CLOUDFLARE API DIAGNOSTICS ===');
  console.log('Testing connection to Cloudflare API...');
  console.log(`Email: ${CLOUDFLARE_EMAIL}`);
  console.log(`API Token: ${CLOUDFLARE_API_TOKEN.substring(0, 5)}...${CLOUDFLARE_API_TOKEN.substring(CLOUDFLARE_API_TOKEN.length - 5)}`);
  console.log(`Account ID: ${CLOUDFLARE_ACCOUNT_ID}\n`);

  try {
    console.log('1. Attempting to fetch zones (domains)...');
    
    const zonesResponse = await fetch(
      `${CLOUDFLARE_API_URL}/zones?page=1&per_page=10`,
      { headers: getAuthHeaders() }
    );
    
    console.log(`Response Status: ${zonesResponse.status} ${zonesResponse.statusText}`);
    
    if (!zonesResponse.ok) {
      console.error('❌ API request failed with status:', zonesResponse.status);
      try {
        const errorData = await zonesResponse.json();
        console.error('Error details:', JSON.stringify(errorData, null, 2));
        
        if (errorData.errors && errorData.errors.length > 0) {
          const error = errorData.errors[0];
          console.error(`Error code: ${error.code}, Message: ${error.message}`);
          
          if (error.code === 1000) {
            console.log('\n🔍 DIAGNOSIS: Authentication failed. Your API token may be invalid or expired.');
          } else if (error.code === 9103) {
            console.log('\n🔍 DIAGNOSIS: The account ID may be incorrect or the API token lacks proper permissions.');
          }
        }
      } catch (e) {
        console.error('Could not parse error response');
      }
      return;
    }

    const data = await zonesResponse.json();
    
    if (!data.success) {
      console.error('❌ API reported failure:', data.errors);
      return;
    }

    console.log('✅ Successfully connected to Cloudflare API!');
    console.log(`Found ${data.result.length} zones (out of ${data.result_info.total_count} total)`);
    
    if (data.result.length > 0) {
      console.log('\nSample domain information:');
      const sample = data.result[0];
      console.log(`- Name: ${sample.name}`);
      console.log(`- Status: ${sample.status}${sample.paused ? ' (paused)' : ''}`);
      console.log(`- Created: ${new Date(sample.created_on).toLocaleString()}`);
    }
    
    console.log('\n2. Attempting to fetch DNS records for first zone...');
    
    if (data.result.length > 0) {
      const firstZoneId = data.result[0].id;
      const dnsResponse = await fetch(
        `${CLOUDFLARE_API_URL}/zones/${firstZoneId}/dns_records?page=1&per_page=10`,
        { headers: getAuthHeaders() }
      );
      
      console.log(`Response Status: ${dnsResponse.status} ${dnsResponse.statusText}`);
      
      if (!dnsResponse.ok) {
        console.error('❌ DNS records request failed');
        return;
      }
      
      const dnsData = await dnsResponse.json();
      
      if (!dnsData.success) {
        console.error('❌ API reported failure for DNS records:', dnsData.errors);
        return;
      }
      
      console.log('✅ Successfully fetched DNS records!');
      console.log(`Found ${dnsData.result.length} DNS records`);
      
      if (dnsData.result.length > 0) {
        console.log('\nSample DNS record:');
        const sample = dnsData.result[0];
        console.log(`- Type: ${sample.type}`);
        console.log(`- Name: ${sample.name}`);
        console.log(`- Content: ${sample.content}`);
      }
    } else {
      console.log('No zones available to test DNS records');
    }
    
    console.log('\n=== DIAGNOSTICS COMPLETE ===');
    console.log('✅ API connection is working properly!');
    
  } catch (error) {
    console.error('❌ Error testing Cloudflare API:', error);
    console.log('\n🔍 DIAGNOSIS: There might be a network connectivity issue or the API endpoint is unreachable.');
  }
}

// Run the test
testCloudflareApi();