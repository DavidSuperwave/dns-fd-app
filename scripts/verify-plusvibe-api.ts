
import { config } from 'dotenv';
import path from 'path';

// Load env vars from .env file immediately
config({ path: path.resolve(process.cwd(), '.env') });

async function verifyPlusVibeApi() {
    console.log('Starting VibePlus API Verification...');
    console.log('----------------------------------------');

    const apiKey = process.env.PLUSVIBE_API_KEY;
    const workspaceId = process.env.PLUSVIBE_WORKSPACE_ID;

    console.log(`Environment Check:`);
    console.log(`API Key present: ${!!apiKey}`);
    console.log(`Workspace ID: ${workspaceId}`);
    console.log('----------------------------------------');

    if (!apiKey || !workspaceId) {
        console.error('CRITICAL: Missing API Key or Workspace ID in .env');
        return;
    }

    // Dynamic import to ensure env vars are loaded before module initialization
    const {
        fetchCampaigns,
        fetchCampaignSummaryMetrics,
        getOverviewSnapshot,
        PlusVibeAPIError
    } = await import('../src/lib/plusvibe');

    try {
        // 1. Test Fetch Campaigns
        console.log('\n1. Testing fetchCampaigns()...');
        const campaigns = await fetchCampaigns({ limit: 5 });
        console.log(`✅ Success! Found ${campaigns.length} campaigns.`);
        if (campaigns.length > 0) {
            console.log('Sample Campaign:', JSON.stringify(campaigns[0], null, 2));
        } else {
            console.log('No campaigns found (this might be expected if the workspace is empty).');
        }

        // 2. Test Campaign Summary (if campaigns exist)
        if (campaigns.length > 0) {
            const campaignId = campaigns[0].id;
            console.log(`\n2. Testing fetchCampaignSummaryMetrics() for campaign ${campaignId}...`);
            const metrics = await fetchCampaignSummaryMetrics(campaignId);
            console.log('✅ Success! Metrics:', JSON.stringify(metrics, null, 2));
        } else {
            console.log('\n2. Skipping campaign metrics test (no campaigns found).');
        }

        // 3. Test Overview Snapshot
        console.log('\n3. Testing getOverviewSnapshot()...');
        const snapshot = await getOverviewSnapshot();
        console.log('✅ Success! Snapshot:', JSON.stringify(snapshot.metrics, null, 2));

    } catch (error) {
        console.error('\n❌ API Verification FAILED');
        if (error instanceof PlusVibeAPIError) {
            console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            console.error(`Data:`, error.data);
        } else {
            console.error(error);
        }
    }
}

verifyPlusVibeApi().catch(console.error);
