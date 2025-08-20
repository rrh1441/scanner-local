#!/bin/bash

echo "Starting timing test at $(date)"
SCAN_ID="timing-$(date +%s)"
echo "Scan ID: $SCAN_ID"

# Start the scan in background
curl -X POST https://scanner-service-242181373909.us-central1.run.app/tasks/scan \
  -H "Content-Type: application/json" \
  -d "{\"scan_id\":\"$SCAN_ID\",\"domain\":\"example.com\"}" \
  --max-time 300 2>/dev/null > scan-result.json &

CURL_PID=$!

# Wait for it to complete or timeout after 5 minutes
sleep 5
echo "Waiting for scan to complete (max 5 minutes)..."

# Check every 10 seconds if the process is still running
for i in {1..30}; do
  if ! ps -p $CURL_PID > /dev/null; then
    echo "Scan completed!"
    break
  fi
  echo "Still running... ($((i*10))s elapsed)"
  sleep 10
done

# Kill if still running
if ps -p $CURL_PID > /dev/null; then
  echo "Scan timeout after 5 minutes, killing..."
  kill $CURL_PID
fi

# Display results
if [ -f scan-result.json ]; then
  echo ""
  echo "========== SCAN RESULTS =========="
  python3 -c "
import json
with open('scan-result.json') as f:
    data = json.load(f)
    if 'metadata' in data and 'module_timings' in data['metadata']:
        timings = data['metadata']['module_timings']
        sorted_timings = sorted(timings.items(), key=lambda x: x[1], reverse=True)
        print('\\n========== MODULE TIMING RESULTS ==========')
        for module, time in sorted_timings:
            print(f'{module:<30} {time:>6}ms')
        print('============================================')
        print(f'TOTAL SCAN TIME:               {data[\"metadata\"][\"duration_ms\"]:>6}ms')
        print(f'Modules completed: {data[\"metadata\"][\"modules_completed\"]}')
        print(f'Modules failed: {data[\"metadata\"][\"modules_failed\"]}')
    else:
        print(json.dumps(data, indent=2))
  "
else
  echo "No results received"
fi

rm -f scan-result.json