#!/bin/bash
set -euo pipefail

echo "=== Validating security tools in worker image ==="

docker run --rm scanner-worker:test sh -c '
set -e
echo "Checking nuclei..."
nuclei -version || exit 1

echo "Checking trufflehog..."
trufflehog --version || exit 1

echo "Checking chromium..."
chromium-browser --version || exit 1

echo "Checking Python tools..."
python3 -c "import dnstwist, whois" || exit 1

echo "✅ All security tools validated!"
'