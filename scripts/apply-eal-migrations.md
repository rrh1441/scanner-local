# Steps to Apply EAL Migrations

## Method 1: Via Supabase Dashboard (Recommended)

1. **Go to SQL Editor**:
   https://supabase.com/dashboard/project/cssqcaieeixukjxqpynp/sql

2. **Run Migration 1 - Create Consolidated System**:
   - Open `/supabase/migrations/20250111_consolidated_eal_system.sql`
   - Copy entire contents
   - Paste into SQL editor
   - Click "Run"
   - You should see messages about tables being created

3. **Run Migration 2 - Apply Revised Parameters**:
   - Open `/supabase/migrations/20250111_eal_parameter_revision.sql`
   - Copy entire contents
   - Paste into SQL editor
   - Click "Run"
   - You should see NOTICE messages showing the updated values

## Method 2: Via Supabase CLI (If you have DB password)

```bash
# From project root
supabase db push

# When prompted for password, enter your database password
```

## Method 3: Via psql (If you have direct access)

```bash
# Connect to database
psql postgres://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres

# Run migrations
\i supabase/migrations/20250111_consolidated_eal_system.sql
\i supabase/migrations/20250111_eal_parameter_revision.sql
```

## Verification After Running

Run this query to verify the migrations applied correctly:

```sql
-- Check attack weights
SELECT attack_type_code, raw_weight 
FROM attack_meta 
WHERE attack_type_code IN ('DATA_BREACH', 'RANSOMWARE', 'PHISHING_BEC', 'SITE_HACK')
ORDER BY raw_weight DESC;

-- Check severity multipliers  
SELECT * FROM severity_weight ORDER BY weight_multiplier DESC;

-- Check risk constants
SELECT key, value FROM risk_constants 
WHERE key IN ('LOW_CONFIDENCE', 'ML_CONFIDENCE', 'HIGH_CONFIDENCE', 'C_BASE');

-- Run sanity check
SELECT * FROM eal_sanity_check;
```

## Expected Results

After both migrations:
- attack_meta should show new weights (DATA_BREACH: $2.5M, etc.)
- severity_weight should show reduced multipliers (CRITICAL: 2.0, HIGH: 1.0)
- risk_constants should show narrower bands (0.6, 1.0, 1.4)
- eal_sanity_check should show all tests as "✓ PASS"

## Trigger EAL Recalculation

After migrations are applied, trigger recalculation for a recent scan:

```bash
node scripts/trigger-eal-calculation.js I50E5WPlwFQ
```

This will show the new EAL totals using the revised parameters.