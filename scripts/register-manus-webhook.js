const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load .env.local first, then .env
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
} else {
    require('dotenv').config();
}

const MANUS_API_KEY = process.env.MANUS_API_KEY;
const WEBHOOK_URL = process.argv[2];

if (!MANUS_API_KEY) {
    console.error('Error: MANUS_API_KEY not found in .env.local');
    process.exit(1);
}

if (!WEBHOOK_URL) {
    console.error('Usage: node scripts/register-manus-webhook.js <YOUR_VERCEL_URL>');
    console.error('Example: node scripts/register-manus-webhook.js https://my-app.vercel.app/api/manus/webhook');
    process.exit(1);
}

const data = JSON.stringify({
    webhook_url: WEBHOOK_URL,
    events: ['task.completed', 'task.failed']
});

const options = {
    hostname: 'api.manus.ai', // Replace with actual Manus API hostname if different
    path: '/v1/webhooks',     // Replace with actual endpoint
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MANUS_API_KEY}`, // Or 'API-Key' depending on Manus auth
        'Content-Length': data.length
    }
};

// Note: Adjusting based on standard Manus API patterns. 
// If the actual endpoint differs, we might need to check src/lib/manus-ai-client.ts again.
// Let's assume the user will verify the URL or I should check the client lib first.
// Actually, let's check the client lib to be sure about the endpoint.
