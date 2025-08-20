# Bulk Company Loader Scripts

This directory contains scripts for bulk loading companies into the DealBrief scanner queue system.

## Overview

Three methods are available for bulk loading companies:

1. **Supabase Loader** (`supabase-bulk-loader.ts`) - **RECOMMENDED** - Uses Supabase as source of truth with duplicate checking
2. **Direct Queue Loader** (`bulk-company-loader.ts`) - Directly adds jobs to the Redis queue
3. **API Loader** (`bulk-company-api-loader.ts`) - Uses the API endpoints to add jobs

## Prerequisites

- Node.js and npm/pnpm installed
- Redis URL configured in `.env` file
- (Optional) Supabase credentials for tracking

## Input File Format

Both scripts expect a JSON file with an array of company objects:

```json
[
  {
    "companyName": "Example Corp",
    "domain": "example.com",
    "tags": ["tech", "startup"]
  },
  {
    "companyName": "Acme Industries",
    "domain": "acme.com",
    "tags": ["manufacturing"]
  }
]
```

## Usage

### Supabase Loader (Recommended)

The Supabase loader uses Supabase as the source of truth, preventing duplicate entries and providing better visibility:

```bash
# Basic usage - loads to Supabase and syncs to Redis
npm run supabase-load -- load companies.json

# Skip duplicate checking (not recommended)
npm run supabase-load -- load --no-check-existing companies.json

# Add to Supabase only, don't sync to Redis yet
npm run supabase-load -- load --no-sync-redis companies.json

# Set priority for all entries
npm run supabase-load -- load --priority 10 companies.json

# Sync pending entries from Supabase to Redis
npm run supabase-load -- sync

# Start continuous sync worker
npm run supabase-load -- worker

# Check queue status
npm run supabase-load -- status

# Check specific batch status
npm run supabase-load -- status batch-123456789
```

Key features:
- **Duplicate Prevention**: Automatically skips companies that already exist in the queue
- **Batch Tracking**: Groups companies by batch ID for easy monitoring
- **Priority Support**: Set priority levels for queue processing
- **Sync Control**: Choose when to sync from Supabase to Redis
- **Visibility**: Full visibility into queue status via Supabase

### Direct Queue Loader

Adds companies directly to the Redis queue without going through the API:

```bash
# Basic usage
npm run bulk-load -- companies.json

# With options
npm run bulk-load -- --batch-size 5 --delay 3000 companies.json

# Track in Supabase
npm run bulk-load -- --supabase-table company_queue companies.json

# Continue on errors
npm run bulk-load -- --no-stop-on-error companies.json
```

Options:
- `--batch-size <n>` - Number of companies to process at once (default: 10)
- `--delay <ms>` - Delay between batches in milliseconds (default: 2000)
- `--no-stop-on-error` - Continue processing even if errors occur
- `--supabase-table <table>` - Track queue entries in Supabase table

### API Loader

Uses the API endpoints to add companies:

```bash
# Basic usage (local API)
npm run api-load -- companies.json

# With remote API
npm run api-load -- --api-url https://api.example.com companies.json

# With monitoring
npm run api-load -- --monitor companies.json

# Custom batch size and delay
npm run api-load -- --batch-size 20 --delay 5000 companies.json
```

Options:
- `--api-url <url>` - API URL (default: http://localhost:3000 or API_URL env)
- `--batch-size <n>` - Number of companies per batch (default: 10)
- `--delay <ms>` - Delay between batches in milliseconds (default: 2000)
- `--no-stop-on-error` - Continue processing even if errors occur
- `--monitor` - Monitor scan progress after queueing

## Rate Limiting & Safety Features

Both scripts include:

1. **Batch Processing**: Process companies in configurable batches (default: 10)
2. **Delays Between Batches**: Configurable delay to prevent overwhelming the system
3. **Error Handling**: Option to stop on first error (default) or continue
4. **Progress Tracking**: Real-time progress updates and final summary
5. **Retry Logic**: API loader includes retry logic for failed requests

## Supabase Queue Table (Optional)

To track queue entries in Supabase, first create the table:

```bash
# Run the migration
psql $DATABASE_URL < supabase-queue-table.sql
```

Then use the `--supabase-table` option with the direct loader.

## Example Workflow

1. Prepare your companies JSON file
2. Test with a small batch first:
   ```bash
   npm run bulk-load -- --batch-size 5 test-companies.json
   ```
3. Monitor the queue:
   ```bash
   # Check Redis queue depth
   redis-cli LLEN scan.jobs
   ```
4. Run the full load:
   ```bash
   npm run bulk-load -- --batch-size 50 --delay 5000 all-companies.json
   ```

## Performance Considerations

- **Batch Size**: Larger batches are more efficient but may overwhelm workers
- **Delay**: Longer delays reduce system load but increase total time
- **Workers**: Ensure sufficient scanner workers are running
- **Queue Monitoring**: The system auto-scales workers based on queue depth

## Error Handling

The scripts will:
- Log all errors with company details
- Save scan IDs (API loader) for tracking
- Provide a summary of successes and failures
- Stop on first error by default (use `--no-stop-on-error` to continue)

## Monitoring

### Queue Monitor Dashboard

Use the queue monitor to track the status of your bulk loads:

```bash
# Show dashboard once
npm run queue-monitor

# Continuous monitoring (refreshes every 30 seconds)
npm run queue-monitor -- -c

# Check for duplicate entries
npm run queue-monitor -- --check-duplicates

# Check specific batch status
npm run queue-monitor -- --batch batch-123456789
```

The dashboard shows:
- Supabase queue statistics by status
- Redis queue depth
- Currently processing companies
- Recent failures with error messages
- Recently queued companies
- Average processing times

### Other Monitoring Options

After loading, you can also monitor progress via:
- Direct Supabase queries
- Use the `--monitor` flag with API loader
- Check scan status via API: `/scan/{scanId}/status`
- View logs from scanner workers

## Recommended Workflow

1. **Create the Supabase queue table**:
   ```bash
   psql $DATABASE_URL < supabase-queue-table.sql
   ```

2. **Test with a small batch**:
   ```bash
   npm run supabase-load -- load --batch-size 5 test-companies.json
   ```

3. **Monitor the test batch**:
   ```bash
   npm run queue-monitor -- -c
   ```

4. **Load your full dataset**:
   ```bash
   npm run supabase-load -- load --batch-size 50 --delay 3000 all-companies.json
   ```

5. **Start the sync worker** (if not using auto-sync):
   ```bash
   npm run supabase-load -- worker
   ```

6. **Monitor progress**:
   ```bash
   npm run queue-monitor -- -c
   ```