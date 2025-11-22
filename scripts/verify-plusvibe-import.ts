
import { config } from 'dotenv';
import path from 'path';

// Load env vars from .env file immediately
config({ path: path.resolve(process.cwd(), '.env') });

async function verifyImport() {
    console.log('Starting VibePlus Campaign Import/Extraction Verification...');
    console.log('----------------------------------------------------------');

    const {
        fetchActiveCampaigns,
        fetchCampaignById,
        fetchCampaignLeads,
        fetchCampaignEmails,
        fetchCampaignEmailAccounts,
        fetchInboxReplies,
        fetchCampaignSummaryMetrics,
        PlusVibeAPIError
    } = await import('../src/lib/plusvibe');

    try {
        // 1. List Active Campaigns
        console.log('\n1. Listing active campaigns to select a target...');
        const campaigns = await fetchActiveCampaigns(10);

        if (campaigns.length === 0) {
            console.log('❌ No active campaigns found.');
            return;
        }

        console.log(`✅ Found ${campaigns.length} campaigns.`);
        const targetCampaign = campaigns[0];
        console.log(`   Targeting Campaign: "${targetCampaign.name}" (${targetCampaign.id})`);

        // 2. Fetch Campaign Details
        console.log('\n2. Fetching campaign metadata...');
        const details = await fetchCampaignById(targetCampaign.id);
        console.log(`✅ Name: ${details?.name}, Status: ${details?.status}`);

        // 3. Fetch Analytics
        console.log('\n3. Fetching Analytics...');
        const analytics = await fetchCampaignSummaryMetrics(targetCampaign.id);
        console.log(`✅ Emails Sent: ${analytics.emailsSentToday}, Replies: ${analytics.totalReplies}`);

        // 4. Fetch Email Accounts (NEW)
        console.log('\n4. Fetching Email Accounts...');
        const emailAccounts = await fetchCampaignEmailAccounts(targetCampaign.id);
        console.log(`✅ Email Accounts retrieved: ${emailAccounts.length}`);
        if (emailAccounts.length > 0) {
            console.log('   Email Accounts:');
            emailAccounts.forEach((account, idx) => {
                console.log(`   [${idx + 1}] ${account.email || account.from_email || 'Unknown'} - ${account.name || account.from_name || 'No name'}`);
                console.log(`       Status: ${account.status || 'Unknown'}, Provider: ${account.provider || account.email_provider || 'Unknown'}`);
            });
        }

        // 5. Fetch Leads
        console.log('\n5. Fetching Leads...');
        const leads = await fetchCampaignLeads(targetCampaign.id);
        console.log(`✅ Leads retrieved: ${leads.length}`);
        if (leads.length > 0) {
            console.log('   First 3 leads:');
            leads.slice(0, 3).forEach((lead, idx) => {
                console.log(`   [${idx + 1}] ${lead.email} - ${lead.name || lead.first_name || 'No name'}`);
            });
        } else {
            console.log('   ⚠️ No leads returned (might need different endpoint or params)');
        }

        // 6. Fetch Email Sequences/Templates
        console.log('\n6. Fetching Email Sequences...');
        const emails = await fetchCampaignEmails(targetCampaign.id);
        console.log(`✅ Templates: ${emails.length}`);
        if (emails.length > 3) {
            console.log(`   First 3: ${emails.slice(0, 3).map(e => e.subject?.substring(0, 30)).join(', ')}...`);
        }

        // 7. Fetch Replies
        console.log('\n7. Fetching Replies...');
        const replies = await fetchInboxReplies({ campaignId: targetCampaign.id, limit: 50 });
        console.log(`✅ Replies retrieved: ${replies.length} (Analytics reported ${analytics.totalReplies})`);

        if (replies.length > 0) {
            console.log('\n   === REPLY DETAILS ===');
            replies.forEach((reply, idx) => {
                console.log(`\n   [${idx + 1}] ${reply.subject}`);
                console.log(`   From: ${reply.sender.email || 'Unknown'} (${reply.sender.name || 'No name'})`);
                console.log(`   Preview: ${reply.preview.substring(0, 80) || '(empty)'}...`);
                console.log(`   Received: ${reply.receivedAt || 'Unknown'}`);
                console.log(`   Status: ${reply.unread ? 'Unread' : 'Read'}`);
            });
        }

        console.log('\n----------------------------------------------------------');
        console.log('✅ Extraction Verification Complete.');

    } catch (error) {
        console.error('\n❌ Verification FAILED');
        if (error instanceof PlusVibeAPIError) {
            console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            console.error(`Data:`, JSON.stringify(error.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

verifyImport().catch(console.error);
