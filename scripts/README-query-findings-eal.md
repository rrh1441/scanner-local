# Query Findings EAL Script

This script queries the findings table in Supabase to analyze EAL (Expected Annual Loss) values for a specific scan.

## Usage

```bash
# Default scan_id (I50E5WPlwFQ)
SUPABASE_URL=<your-url> SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/query-findings-eal.js

# Custom scan_id
SUPABASE_URL=<your-url> SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/query-findings-eal.js <scan_id>
```

## Running on Fly.io

Since the environment variables are already set on Fly.io, you can SSH into a running instance and run:

```bash
# SSH into the scanner
fly ssh console -a dealbrief-scanner

# Run the script
node scripts/query-findings-eal.js I50E5WPlwFQ
```

## What it shows

1. **Breakdown by finding_type**: Groups findings by type and shows:
   - Count of findings per type
   - Average EAL values (low, ML, high, daily) for each type

2. **Sample findings**: Shows 5-10 example findings with full details including:
   - Finding type and severity
   - Asset information
   - EAL calculations
   - Description snippet

3. **Summary statistics**: Overall totals across all findings:
   - Total number of findings
   - Sum of all EAL values (low, ML, high, daily)

## Required Environment Variables

- `SUPABASE_URL`: The Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key with read access to the findings table

## Note

The script requires the `@supabase/supabase-js` package which is already installed in the project.