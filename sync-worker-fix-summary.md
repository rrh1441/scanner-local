# Sync Worker Fix Summary

## Issue
The sync worker is failing to write findings to Supabase with two main errors:

1. **"cannot insert a non-DEFAULT value into column 'type'"**
   - The Supabase `findings` table has a 'type' column that appears to be auto-generated or has special permissions
   - The sync worker was trying to insert data into this column, which is not allowed

2. **"column 'attack_type_code' does not exist"**
   - The Fly PostgreSQL database has an `attack_type_code` column in the findings table
   - The Supabase database does not have this column
   - This causes the scan totals calculation to fail

## Root Cause
Schema mismatch between Fly PostgreSQL and Supabase databases. The databases have diverged in their schema:
- Supabase has a 'type' column with special restrictions
- Fly has an 'attack_type_code' column that Supabase doesn't have

## Fix Applied

### 1. Fixed Findings Sync
- Modified the sync worker to NOT include the 'type' column when upserting findings to Supabase
- Added comment in code: `// IMPORTANT: Do not include 'type' column - it's auto-generated in Supabase`
- Added debug logging to show sample data when errors occur

### 2. Added Artifacts Sync
- Added a new `syncArtifactsTable()` function to sync artifacts as well as findings
- This ensures all scanner output is synced to Supabase

### 3. Fixed Scan Totals Sync
- Added column existence check before trying to query `attack_type_code`
- If the column doesn't exist, skip the totals calculation gracefully
- Added check for whether `scan_totals_automated` table exists in Supabase

### 4. Enhanced Error Handling
- Added more detailed error logging
- Added sample data logging when upsert fails
- Made the sync more resilient to schema differences

## Changes Made to `/apps/sync-worker/sync.ts`:

1. Line 225: Added comment to not include 'type' column
2. Lines 261-294: Added `syncArtifactsTable()` function
3. Lines 283-296: Added column existence check for `attack_type_code`
4. Lines 253-262: Added table existence check for `scan_totals_automated`
5. Line 451: Added artifacts sync to the sync cycle
6. Lines 234-237: Added debug logging for failed upserts

## Next Steps

### Option 1: Schema Alignment (Recommended)
Run these queries in Supabase to align the schema:
```sql
-- Add missing columns to findings table
ALTER TABLE findings 
ADD COLUMN IF NOT EXISTS attack_type_code text,
ADD COLUMN IF NOT EXISTS eal_ml numeric,
ADD COLUMN IF NOT EXISTS scan_id text;

-- Check what's special about the 'type' column
SELECT * FROM information_schema.columns 
WHERE table_name = 'findings' AND column_name = 'type';
```

### Option 2: Continue with Current Fix
The sync worker will now:
- Skip the 'type' column when syncing findings
- Skip totals calculation if attack_type_code doesn't exist
- Continue syncing what it can successfully

## Verification
After deploying, check the logs for:
- "New findings synced: X" messages
- "New artifacts synced: X" messages
- No more "cannot insert a non-DEFAULT value into column 'type'" errors
- Graceful handling of missing columns