
import { config } from 'dotenv';
import path from 'path';

// Load env vars from .env file immediately
config({ path: path.resolve(process.cwd(), '.env') });

async function verifyAnalytics() {
    console.log('Starting VibePlus Analytics Verification...');
    console.log('-------------------------------------------');

    const {
        fetchActiveCampaigns,
        fetchCampaignSummaryMetrics,
        fetchInboxReplies,
        PlusVibeAPIError
    } = await import('../src/lib/plusvibe');

    try {
        // 1. Find an active campaign
        console.log('\n1. Finding active campaigns...');
        const campaigns = await fetchActiveCampaigns(5);

        if (campaigns.length === 0) {
            console.log('⚠️ No active campaigns found. Cannot verify analytics/replies.');
            return;
        }

        console.log(`✅ Found ${campaigns.length} active campaigns.`);
        const targetCampaign = campaigns[0];
        console.log(`   Selected Campaign: ${targetCampaign.name} (${targetCampaign.id})`);

        // 2. Get Summary Metrics
        console.log(`\n2. Fetching metrics for campaign ${targetCampaign.id}...`);
        const metrics = await fetchCampaignSummaryMetrics(targetCampaign.id);
        console.log('✅ Metrics retrieved:');
        console.log(JSON.stringify(metrics, null, 2));

        // 3. Get Replies
        console.log(`\n3. Fetching replies for campaign ${targetCampaign.id}...`);
        const replies = await fetchInboxReplies({
            campaignId: targetCampaign.id,
            limit: 5
        });

        console.log(`✅ Retrieved ${replies.length} replies.`);
        if (replies.length > 0) {
            console.log('   Sample Reply:');
            console.log(`   - From: ${replies[0].sender.email}`);
            console.log(`   - Subject: ${replies[0].subject}`);
            console.log(`   - Preview: ${replies[0].preview}`);
        } else {
            console.log('   (No replies found for this campaign yet)');
        }

    } catch (error) {
        console.error('\n❌ Analytics Verification FAILED');
        if (error instanceof PlusVibeAPIError) {
            console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            console.error(`Data:`, JSON.stringify(error.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

verifyAnalytics().catch(console.error);
