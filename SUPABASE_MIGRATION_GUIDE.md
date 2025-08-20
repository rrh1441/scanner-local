# Supabase Direct Write Migration Guide

This guide explains how to migrate from the current architecture (Fly PostgreSQL + Sync Worker) to writing directly to Supabase.

## Current Architecture

```
[Scanner] -> [Fly PostgreSQL] -> [Sync Worker] -> [Supabase] -> [Frontend]
```

## New Architecture

```
[Scanner] -> [Supabase] -> [Frontend]
```

## Benefits

1. **Reduced Complexity**: Eliminates sync worker and Fly PostgreSQL
2. **Real-time Updates**: Frontend sees updates immediately
3. **Cost Savings**: No need to run separate PostgreSQL instance on Fly
4. **Simpler Deployment**: One less service to maintain

## Migration Steps

### 1. Run Supabase Migration

First, run the migration script in your Supabase SQL editor:

```sql
-- Copy contents of supabase-migration.sql
```

### 2. Set Environment Variables

Update your Fly.io secrets:

```bash
# Required for direct Supabase writes
fly secrets set SUPABASE_URL="https://cssqcaieeixukjxqpynp.supabase.co" -a dealbrief-scanner
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" -a dealbrief-scanner
```

### 3. Test Connection

Test the Supabase connection locally:

```bash
# Set env vars
export SUPABASE_URL="https://cssqcaieeixukjxqpynp.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run test
node test-supabase-connection.js
```

### 4. Update Code References

Replace imports in your worker files:

```typescript
// OLD
import { insertArtifact, insertFinding, pool } from './core/artifactStore.js';
import { enrichFindingsWithRemediation } from './util/remediationPlanner.js';

// NEW
import { insertArtifact, insertFinding, initializeScan, updateScanStatus } from './core/artifactStoreSupabase.js';
import { enrichFindingsWithRemediation } from './util/remediationPlannerSupabase.js';
```

### 5. Update Worker.ts

The main changes needed in worker.ts:

1. Import the new Supabase store
2. Replace `updateScanMasterStatus` calls with `updateScanStatus`
3. Ensure scan is initialized with `initializeScan` at job start

### 6. Deploy Changes

```bash
# Deploy the updated worker
fly deploy --app dealbrief-scanner
```

### 7. Stop Sync Worker

Once verified working:

```bash
# Stop the sync worker
fly apps destroy dealbrief-sync-worker
```

## Rollback Plan

If issues arise:

1. Revert code changes
2. Redeploy original version
3. Restart sync worker

The Supabase tables will remain compatible with the old sync approach.

## Verification

After migration, verify:

1. New scans appear in Supabase immediately
2. Findings are written directly to Supabase
3. Remediation enrichment works
4. Frontend still displays data correctly

## Notes

- The `pool.query` calls for direct SQL won't work with Supabase - use the provided functions
- Supabase has automatic timestamps, so `created_at` is handled automatically
- Row Level Security (RLS) is enabled but policies allow service role full access