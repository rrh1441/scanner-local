# 🚨 URGENT: Fix Frontend Authentication Issue

## The Problem
Your Vercel frontend can't authenticate to your GCP backend because:
- GCP backend requires authentication 
- Vercel doesn't have Google Cloud credentials
- The proxy route fails with "Could not load default credentials"

## Quick Fix (Option 1): Make GCP Backend Public
**Run these commands to allow public access:**

```bash
# Allow public access to your GCP API
gcloud run services add-iam-policy-binding scanner-api \
    --region=us-central1 \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --project=precise-victory-467219-s4

# Verify it worked
curl https://scanner-api-242181373909.us-central1.run.app/health
```

**Expected response after fix:**
```json
{
  "status": "healthy",
  "pubsub": "connected",
  "firestore": "connected", 
  "timestamp": "2024-..."
}
```

## Alternative Fix (Option 2): Add Service Account to Vercel
If you prefer to keep the backend private:

1. **Create service account key**:
   ```bash
   gcloud iam service-accounts keys create vercel-key.json \
       --iam-account=scanner-worker-sa@precise-victory-467219-s4.iam.gserviceaccount.com \
       --project=precise-victory-467219-s4
   ```

2. **Add to Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `GOOGLE_APPLICATION_CREDENTIALS_JSON` = `[paste entire JSON file contents]`

3. **Update proxy route** to use the credentials from environment variable

## Why This Happened
- CORS is working fine (backend accepts *.vercel.app domains)
- The issue is **authentication**, not CORS
- Your backend has CORS headers but still requires Google Auth
- Vercel can't authenticate without credentials

## Test After Fix
Once you run Option 1, your frontend should work immediately:
1. ✅ Health check will show green "System Operational"
2. ✅ Scan creation will work
3. ✅ No more authentication errors

**Option 1 is faster and simpler** - just run the gcloud commands above! 🚀