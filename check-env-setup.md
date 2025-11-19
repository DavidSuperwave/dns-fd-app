# Quick Environment Setup Check

## Important: Next.js Environment Variables

Next.js uses `.env.local` for local development, NOT `.env`

### 1. Check File Location

Your `.env.local` file should be in the **project root** (same folder as `package.json`):

```
dns-fd-app/
  ├── .env.local          ← Should be here
  ├── package.json
  ├── next.config.ts
  └── src/
```

### 2. Check File Format

Your `.env.local` should look like this:

```bash
# No quotes, no spaces around =
MANUS_API_KEY=your_actual_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Common mistakes:**
- ❌ `MANUS_API_KEY = "key"` (spaces, quotes)
- ❌ `MANUS_API_KEY="key"` (quotes)
- ✅ `MANUS_API_KEY=key` (correct)

### 3. Restart Server

**CRITICAL:** After adding/changing `.env.local`:
1. **Stop** the Next.js server (Ctrl+C)
2. **Start** it again: `npm run dev`
3. Environment variables are only loaded on server start!

### 4. Verify It's Loaded

Add this temporary log to check (then remove it):

```typescript
// In src/app/api/company-profiles/route.ts
console.log('[DEBUG] MANUS_API_KEY exists:', !!process.env.MANUS_API_KEY);
console.log('[DEBUG] MANUS_API_KEY length:', process.env.MANUS_API_KEY?.length || 0);
```

