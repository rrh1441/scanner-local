#!/bin/bash
# Tool verification script for DealBrief Security Scanner

echo "=== DealBrief Security Scanner Tool Verification ==="
echo

# Test Node.js environment
echo "1. Node.js Environment:"
echo "   NODE_TLS_REJECT_UNAUTHORIZED: ${NODE_TLS_REJECT_UNAUTHORIZED:-'NOT SET'}"
echo "   TESTSSL_PATH: ${TESTSSL_PATH:-'NOT SET'}"
echo "   NUCLEI_TEMPLATES: ${NUCLEI_TEMPLATES:-'NOT SET'}"
echo

# Test nuclei
echo "2. Testing nuclei:"
if command -v nuclei &> /dev/null; then
    echo "   ✅ nuclei found: $(which nuclei)"
    nuclei -version | head -1
else
    echo "   ❌ nuclei not found"
fi
echo

# Test testssl.sh
echo "3. Testing testssl.sh:"
if [ -f "${TESTSSL_PATH}" ]; then
    echo "   ✅ testssl.sh found: ${TESTSSL_PATH}"
    ${TESTSSL_PATH} --version | head -1
elif command -v testssl.sh &> /dev/null; then
    echo "   ✅ testssl.sh found in PATH: $(which testssl.sh)"
    testssl.sh --version | head -1
else
    echo "   ❌ testssl.sh not found"
fi
echo

# Test TruffleHog
echo "4. Testing TruffleHog:"
if command -v trufflehog &> /dev/null; then
    echo "   ✅ trufflehog found: $(which trufflehog)"
    trufflehog --version
else
    echo "   ❌ trufflehog not found"
fi
echo

# Test SpiderFoot
echo "5. Testing SpiderFoot:"
if command -v sf &> /dev/null; then
    echo "   ✅ SpiderFoot found: $(which sf)"
    echo "   SpiderFoot installed at: /opt/spiderfoot"
elif [ -f "/opt/spiderfoot/sf.py" ]; then
    echo "   ✅ SpiderFoot found: /opt/spiderfoot/sf.py"
else
    echo "   ❌ SpiderFoot not found"
fi
echo

# Test OpenSSL (for manual certificate checking)
echo "6. Testing OpenSSL:"
if command -v openssl &> /dev/null; then
    echo "   ✅ openssl found: $(which openssl)"
    openssl version
else
    echo "   ❌ openssl not found"
fi
echo

# Test certificate mismatch detection
echo "7. Testing certificate mismatch detection:"
echo "   Testing lodging-source.com certificate..."
if command -v openssl &> /dev/null; then
    CERT_SUBJECT=$(echo | openssl s_client -connect lodging-source.com:443 -servername lodging-source.com 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)
    if [[ "$CERT_SUBJECT" == *"www.lodging-source.com"* ]]; then
        echo "   ✅ Certificate mismatch detected: $CERT_SUBJECT"
        echo "   This should be flagged as a HIGH severity finding"
    else
        echo "   ⚠️  Certificate subject: $CERT_SUBJECT"
    fi
else
    echo "   ❌ Cannot test - openssl not available"
fi
echo

echo "=== Verification Complete ==="