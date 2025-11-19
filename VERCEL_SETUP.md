# Vercel Deployment & Manus Webhook Setup

## 1. Environment Variables

Ensure the following environment variables are set in your Vercel project settings:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (critical for webhooks) |
| `MANUS_API_KEY` | Your Manus AI API key |
| `CRON_SECRET` | Secret for securing cron jobs (if applicable) |

## 2. Deploy to Vercel

Deploy your application to Vercel as usual. Note your production URL (e.g., `https://your-app.vercel.app`).

## 3. Register the Webhook

Once deployed, you need to tell Manus AI where to send updates.

1.  Open your terminal in the project root.
2.  Run the registration script with your **production URL**:

```bash
npx ts-node scripts/register-manus-webhook.ts https://your-app.vercel.app/api/manus/webhook
```

> **Note:** Replace `https://your-app.vercel.app` with your actual Vercel domain.

## 4. Verification

To verify the integration:
1.  Create a new company profile in the app.
2.  This should trigger a Manus task.
3.  Check the Vercel logs for `[Manus Webhook]` entries to see incoming updates.
