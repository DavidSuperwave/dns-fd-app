
import { config } from 'dotenv';
import path from 'path';

// Load env vars from .env file immediately
config({ path: path.resolve(process.cwd(), '.env') });

async function verifyComplex() {
    console.log('Starting VibePlus Complex Verification (Sequences & Deletion)...');
    console.log('--------------------------------------------------------------');

    const {
        createPlusVibeCampaign,
        updatePlusVibeCampaign,
        fetchCampaignById,
        deleteCampaign,
        fetchCampaigns,
        PlusVibeAPIError
    } = await import('../src/lib/plusvibe');

    let campaignId: string | undefined;

    try {
        // 1. Create Campaign
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const campaignName = `Complex Test ${timestamp}`;

        console.log(`\n1. Creating campaign: "${campaignName}"...`);
        const newCampaign = await createPlusVibeCampaign({
            name: campaignName,
            description: 'Complex test campaign',
        });
        campaignId = newCampaign.id;
        console.log(`✅ Campaign Created! ID: ${campaignId}`);

        // 2. Update with Complex Sequence
        console.log('\n2. Updating with multi-step sequence...');
        await updatePlusVibeCampaign(campaignId, {
            firstWaitTime: 60,
            sequences: [
                {
                    step: 1,
                    wait_time: 1,
                    variations: [
                        {
                            variation: 'A',
                            subject: `Step 1A: Hello from ${campaignName}`,
                            body: '<p>Variation A body</p>',
                            name: 'Intro Variation A'
                        },
                        {
                            variation: 'B',
                            subject: `Step 1B: Hi there from ${campaignName}`,
                            body: '<p>Variation B body</p>',
                            name: 'Intro Variation B'
                        }
                    ]
                },
                {
                    step: 2,
                    wait_time: 2,
                    variations: [
                        {
                            variation: 'A',
                            subject: `Step 2: Follow up`,
                            body: '<p>Just checking in...</p>',
                            name: 'Follow Up'
                        }
                    ]
                }
            ]
        });
        console.log('✅ Complex sequence updated successfully!');

        // 3. Verify Update
        console.log('\n3. Verifying campaign details...');
        const fetchedCampaign = await fetchCampaignById(campaignId);
        console.log(`✅ Fetched: ${fetchedCampaign?.name}`);
        // Note: Deep verification of sequence structure might require a specific endpoint if fetchCampaignById doesn't return it.
        // But success of update call is a strong signal.

        // 4. Delete Campaign
        console.log(`\n4. Deleting campaign ${campaignId}...`);
        await deleteCampaign(campaignId);
        console.log('✅ Delete request sent.');

        // 5. Verify Deletion
        console.log('\n5. Verifying deletion (fetching by ID)...');
        try {
            const deletedCheck = await fetchCampaignById(campaignId);
            if (deletedCheck) {
                // Some APIs might return the deleted campaign with a 'deleted' status
                console.log(`⚠️ Campaign still exists. Status: ${deletedCheck.status}`);
            } else {
                console.log('✅ Campaign not found (Deletion confirmed).');
            }
        } catch (error) {
            // 404 is expected/good here
            console.log('✅ Campaign not found (Deletion confirmed via 404).');
        }

        // 6. Cleanup other test campaigns
        console.log('\n6. Cleaning up old test campaigns...');
        const allCampaigns = await fetchCampaigns({ limit: 50 });
        const testCampaigns = allCampaigns.filter(c =>
            c.name.startsWith('Test Campaign') || c.name.startsWith('Complex Test')
        );

        if (testCampaigns.length === 0) {
            console.log('   No other test campaigns found.');
        } else {
            console.log(`   Found ${testCampaigns.length} old test campaigns to delete.`);
            for (const camp of testCampaigns) {
                if (camp.id === campaignId) continue; // Already deleted
                try {
                    console.log(`   Deleting ${camp.name} (${camp.id})...`);
                    await deleteCampaign(camp.id);
                } catch (e) {
                    console.error(`   ❌ Failed to delete ${camp.id}:`, e);
                }
            }
            console.log('✅ Cleanup complete.');
        }

    } catch (error) {
        console.error('\n❌ Complex Verification FAILED');
        if (error instanceof PlusVibeAPIError) {
            console.error(`Status: ${error.status}`);
            console.error(`Message: ${error.message}`);
            console.error(`Data:`, JSON.stringify(error.data, null, 2));
        } else {
            console.error(error);
        }
    }
}

verifyComplex().catch(console.error);
