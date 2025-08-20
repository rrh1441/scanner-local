#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Setting up OWASP ZAP for DealBrief Scanner"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is available"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker daemon is running"

# Install ZAP Python packages
echo "📦 Installing ZAP Python packages..."
pip3 install python-owasp-zap-v2.4

# Pull ZAP Docker image
echo "📥 Pulling OWASP ZAP Docker image..."
docker pull zaproxy/zap-stable

# Verify ZAP installation
echo "🧪 Testing ZAP installation..."
docker run --rm zaproxy/zap-stable zap-baseline.py --help > /dev/null

# Create artifacts directory
mkdir -p ./artifacts

echo "✅ ZAP setup complete!"
echo ""
echo "Usage:"
echo "  The ZAP module will automatically use Docker when scanning."
echo "  Artifacts will be saved to ./artifacts/"
echo ""
echo "Test with:"
echo "  ./scripts/test-zap-only.sh"