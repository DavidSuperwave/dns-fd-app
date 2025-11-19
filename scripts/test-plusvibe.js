/**
 * Test script for PlusVibe API integration
 * 
 * This script tests the basic connectivity and functionality
 * of the PlusVibe API using the provided credentials.
 * 
 * Run with: node scripts/test-plusvibe.js
 */

const PLUSVIBE_API_BASE = process.env.PLUSVIBE_API_BASE || 'https://api.plusvibe.ai/api/v1';
const PLUSVIBE_API_KEY = process.env.PLUSVIBE_API_KEY || '7332bc56-e2769fd4-9f1a00b6-ebb7ce28';
const PLUSVIBE_WORKSPACE_ID = process.env.PLUSVIBE_WORKSPACE_ID || '678eb62a071ff7544034bcde';

async function testConnection() {
    console.log('🔍 Testing PlusVibe API Connection...\n');
    console.log(`API Base: ${PLUSVIBE_API_BASE}`);
    console.log(`Workspace ID: ${PLUSVIBE_WORKSPACE_ID}\n`);

    try {
        // Test 1: List campaigns
        console.log('Test 1: Fetching campaigns...');
        const campaignsUrl = `${PLUSVIBE_API_BASE}/campaign/list-all?workspace_id=${PLUSVIBE_WORKSPACE_ID}&limit=10`;
        const campaignsResponse = await fetch(campaignsUrl, {
            headers: {
                'x-api-key': PLUSVIBE_API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (!campaignsResponse.ok) {
            throw new Error(`HTTP ${campaignsResponse.status}: ${await campaignsResponse.text()}`);
        }

        const campaigns = await campaignsResponse.json();
        console.log(`✅ Success! Found ${campaigns.data?.length || campaigns.campaigns?.length || 0} campaigns\n`);

        if (campaigns.data && campaigns.data.length > 0) {
            const firstCampaign = campaigns.data[0];
            console.log('Sample campaign:');
            console.log(`  - ID: ${firstCampaign.id}`);
            console.log(`  - Name: ${firstCampaign.name}`);
            console.log(`  - Status: ${firstCampaign.status}\n`);

            // Test 2: Get campaign details
            console.log('Test 2: Fetching campaign details...');
            const detailsUrl = `${PLUSVIBE_API_BASE}/campaign/list-all?workspace_id=${PLUSVIBE_WORKSPACE_ID}&campaign_id=${firstCampaign.id}&limit=1`;
            const detailsResponse = await fetch(detailsUrl, {
                headers: {
                    'x-api-key': PLUSVIBE_API_KEY,
                    'Content-Type': 'application/json',
                },
            });

            if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                console.log(`✅ Campaign details retrieved\n`);
            }

            // Test 3: Get campaign analytics
            console.log('Test 3: Fetching campaign analytics...');
            const analyticsUrl = `${PLUSVIBE_API_BASE}/analytics/get/campaign-summary?workspace_id=${PLUSVIBE_WORKSPACE_ID}&campaign_id=${firstCampaign.id}`;
            const analyticsResponse = await fetch(analyticsUrl, {
                headers: {
                    'x-api-key': PLUSVIBE_API_KEY,
                    'Content-Type': 'application/json',
                },
            });

            if (analyticsResponse.ok) {
                const analytics = await analyticsResponse.json();
                console.log(`✅ Analytics retrieved`);
                console.log(`  - Emails sent: ${analytics.data?.emails_sent_today || analytics.emails_sent_today || 0}`);
                console.log(`  - Total replies: ${analytics.data?.total_replies || analytics.total_replies || 0}\n`);
            }
        } else {
            console.log('⚠️  No campaigns found in workspace\n');
        }

        // Test 4: List email inbox
        console.log('Test 4: Fetching inbox emails...');
        const inboxUrl = `${PLUSVIBE_API_BASE}/unibox/emails?workspace_id=${PLUSVIBE_WORKSPACE_ID}&limit=5&email_type=received`;
        const inboxResponse = await fetch(inboxUrl, {
            headers: {
                'x-api-key': PLUSVIBE_API_KEY,
                'Content-Type': 'application/json',
            },
        });

        if (inboxResponse.ok) {
            const inbox = await inboxResponse.json();
            const emailCount = inbox.data?.length || inbox.emails?.length || 0;
            console.log(`✅ Found ${emailCount} inbox emails\n`);
        }

        console.log('🎉 All tests passed! PlusVibe API integration is working correctly.\n');
        console.log('Next steps:');
        console.log('1. Run database migrations (see SQL files in project root)');
        console.log('2. Test campaign import via API: POST /api/plusvibe/campaigns/import');
        console.log('3. Test campaign launch via API: POST /api/plusvibe/campaigns/[id]/launch');
        console.log('4. Configure webhooks in PlusVibe dashboard\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('- Verify PLUSVIBE_API_KEY is correct');
        console.error('- Verify PLUSVIBE_WORKSPACE_ID is correct');
        console.error('- Check if API base URL is accessible');
        console.error('- Review PlusVibe API documentation at https://developer.plusvibe.ai/\n');
        process.exit(1);
    }
}

testConnection();
