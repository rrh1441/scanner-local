#!/bin/bash

# Run EAL debug queries
DB_URL=$(npx supabase status --output json | jq -r '.["DB URL"]')

if [ -z "$DB_URL" ]; then
    echo "Error: Could not get Supabase DB URL"
    exit 1
fi

echo "Running EAL debug queries..."
psql "$DB_URL" -f scripts/debug-eal-calculation.sql