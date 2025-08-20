#!/bin/bash

# Version check script for secret scanning tools
# Ensures we're using the correct pinned versions

set -e

echo "🔍 Checking secret scanning tool versions..."

# Required versions
required_truffle="3.83."
required_gg="1.26."

# Check TruffleHog version
echo "Checking TruffleHog version..."
trufflehog_version=$(trufflehog --version 2>&1 || echo "not found")
if echo "$trufflehog_version" | grep -q "$required_truffle"; then
    echo "✅ TruffleHog: $trufflehog_version"
else
    echo "❌ TruffleHog version mismatch. Expected: $required_truffle, Got: $trufflehog_version"
    exit 1
fi

# Check ggshield version
echo "Checking ggshield version..."
ggshield_version=$(ggshield --version 2>&1 || echo "not found")
if echo "$ggshield_version" | grep -q "$required_gg"; then
    echo "✅ ggshield: $ggshield_version"
else
    echo "❌ ggshield version mismatch. Expected: $required_gg, Got: $ggshield_version"
    exit 1
fi

echo "🎉 All secret scanning tools are at the correct versions!"

# Test basic functionality
echo "🧪 Testing basic functionality..."

# Test TruffleHog with a simple file
echo "Testing TruffleHog..."
echo "fake_key_12345" > /tmp/test_secret.txt
trufflehog filesystem /tmp/test_secret.txt --json --no-verification > /tmp/trufflehog_test.json || true
rm -f /tmp/test_secret.txt /tmp/trufflehog_test.json

# Test ggshield with stdin
echo "Testing ggshield..."
echo "fake_key_12345" | ggshield secret scan stdin --json --no-banner > /tmp/ggshield_test.json || true
rm -f /tmp/ggshield_test.json

echo "✅ Basic functionality tests passed!"