#!/bin/bash
# Load test — simulate concurrent requests to find breaking points.
# Requires: autocannon (npm install -g autocannon)

set -euo pipefail

echo "🔥 Quaesitor Load Test"
echo "========================"
echo ""

if ! command -v autocannon &> /dev/null; then
  echo "Installing autocannon..."
  npm install -g autocannon
fi

BASE_URL="${BASE_URL:-http://localhost:3000}"
CONCURRENT="${CONCURRENT:-20}"
DURATION="${DURATION:-30}"

echo "Target: $BASE_URL"
echo "Concurrent: $CONCURRENT"
echo "Duration: ${DURATION}s"
echo ""

# Test 1: Health endpoint (lightweight)
echo "📊 Test 1: /api/health (lightweight GET)"
autocannon -c "$CONCURRENT" -d "$DURATION" "$BASE_URL/api/health" 2>/dev/null || true
echo ""

# Test 2: Chat endpoint (heavyweight POST — requires auth)
echo "📊 Test 2: /api/chat (heavyweight POST)"
echo "   Skipping — requires auth + LLM key"
echo ""

# Test 3: Static page
echo "📊 Test 3: / (page load)"
autocannon -c "$CONCURRENT" -d "$DURATION" "$BASE_URL/" 2>/dev/null || true
echo ""

echo "✅ Load test complete"
echo "   Review results above for latency p50/p95/p99 and error rate"
