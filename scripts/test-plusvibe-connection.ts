import dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE importing the library
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Dynamic import to ensure env vars are loaded
const { fetchCampaigns } = require('../src/lib/plusvibe');

async function main() {
    console.log('Testing Vibe Plus Connection (Direct Fetch)...');
    const apiKey = process.env.PLUSVIBE_API_KEY;
    const workspaceId = process.env.PLUSVIBE_WORKSPACE_ID;
    const apiBase = process.env.PLUSVIBE_API_BASE || "https://api.plusvibe.ai/api/v1";

    console.log('API Base:', apiBase);
    console.log('Workspace ID:', workspaceId);
    console.log('API Key:', apiKey ? 'Set (starts with ' + apiKey.substring(0, 4) + ')' : 'Not Set');

    if (!apiKey || !workspaceId) {
        console.error('Missing credentials');
        process.exit(1);
    }

    const url = `${apiBase}/campaign/list-all?limit=5&workspace_id=${workspaceId}`;
    console.log('Fetching URL:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'x-workspace-id': workspaceId,
                'Accept': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        const text = await response.text();
        console.log('Response Body:', text.substring(0, 500)); // Print first 500 chars

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

    } catch (error: any) {
        console.error('\n❌ Connection Failed!');
        console.error('Error:', error.message);
        if (error.cause) console.error('Cause:', error.cause);
    }
}

main();
