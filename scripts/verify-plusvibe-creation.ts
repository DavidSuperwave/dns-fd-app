
import { config } from 'dotenv';
import path from 'path';

// Load env vars from .env file immediately
config({ path: path.resolve(process.cwd(), '.env') });

async function verifyCreation() {
    console.log('Starting VibePlus Campaign Creation Verification...');
    console.log('--------------------------------------------------');

    const {
        createPlusVibeCampaign,
        updatePlusVibeCampaign,
        fetchCampaignById,
        PlusVibeAPIError
    } = await import('../src/lib/plusvibe');

    try {
        // 1. Create Campaign
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const campaignName = `Test Campaign ${timestamp}`;

        console.log(`\n1. Creating campaign: "${campaignName}"...`);
        const newCampaign = await createPlusVibeCampaign({
            name: campaignName,
            description: 'Automated test campaign created by verification script',
        });

        console.log(`✅ Campaign Created! ID: ${newCampaign.id}`);

        // 2. Add Email Sequence
        console.log('\n2. Adding email sequence (Step 1)...');
        const updatedCampaign = await updatePlusVibeCampaign(newCampaign.id, {
            firstWaitTime: 60, // 60 minutes
            sequences: [
                {
                    step: 1,
                    wait_time: 1, // Must be >= 1 day
                    variations: [
                        {
                            variation: 'A',
                            subject: `Hello from ${campaignName}`,
                            body: '<p>This is a test email body added via API.</p>',
                            name: 'Test Variation A'
                        }
                    ]
                }
            ]
        });

        console.log('✅ Sequence added successfully!');

        // 3. Verify by fetching back
        console.log('\n3. Verifying campaign details...');
        const fetchedCampaign = await fetchCampaignById(newCampaign.id);

        if (fetchedCampaign) {
            console.log('✅ Campaign fetched successfully.');
            console.log(`   Name: ${fetchedCampaign.name}`);
            console.log(`   Status: ${fetchedCampaign.status}`);
        } else {
            console.error('❌ Failed to fetch created campaign.');
        }

    } catch (error) {
        console.error('\n❌ Creation Verification FAILED');
        if (error instanceof PlusVibeAPIError) {
            console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            console.error(`Data:`, JSON.stringify(error.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

verifyCreation().catch(console.error);
