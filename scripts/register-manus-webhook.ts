import dotenv from 'dotenv';
import path from 'path';
import { registerManusWebhook } from '../src/lib/manus-ai-client';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    const webhookUrl = process.argv[2];

    if (!webhookUrl) {
        console.error('Usage: npx ts-node scripts/register-manus-webhook.ts <WEBHOOK_URL>');
        console.error('Example: npx ts-node scripts/register-manus-webhook.ts https://my-app.vercel.app/api/manus/webhook');
        process.exit(1);
    }

    console.log(`Registering webhook URL: ${webhookUrl}`);

    try {
        await registerManusWebhook(webhookUrl);
        console.log('Successfully registered webhook!');
    } catch (error) {
        console.error('Failed to register webhook:', error);
        process.exit(1);
    }
}

main();
