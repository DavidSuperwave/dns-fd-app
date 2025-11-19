// Check Manus task result structure
// This shows us what Manus actually returns

import { getManusTaskStatus } from './src/lib/manus-ai-client';

async function checkManusResult() {
    // Get the task_id from your company profile
    const taskId = process.argv[2];

    if (!taskId) {
        console.error('Usage: tsx check-manus-result.ts <task_id>');
        console.log('Find task_id in company_profiles.manus_workflow_id');
        process.exit(1);
    }

    console.log('Fetching task result for:', taskId);

    try {
        const result = await getManusTaskStatus(taskId);

        console.log('\n=== FULL RAW RESULT ===');
        console.log(JSON.stringify(result, null, 2));

        console.log('\n=== STRUCTURE ANALYSIS ===');
        console.log('Has task_id?', 'task_id' in result);
        console.log('Has status?', 'status' in result);
        console.log('Has result?', 'result' in result);
        console.log('Result type:', typeof result.result);

        if (result.result) {
            console.log('Result is array?', Array.isArray(result.result));
            console.log('Result keys:', Object.keys(result.result || {}));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkManusResult();
