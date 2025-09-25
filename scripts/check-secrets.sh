#!/bin/bash

# Script to check for secrets in the codebase
# This script is used by the pre-commit hook

set -euo pipefail

if ! command -v detect-secrets >/dev/null 2>&1; then
  echo "❌ detect-secrets is not installed. Install it with 'pip install detect-secrets'" >&2
  exit 1
fi

echo "🔍 Scanning for secrets..."

# Create a temporary scan result
temp_scan=$(mktemp)

# Run detect-secrets scan using repository config
detect-secrets scan \
  --config .secrets.yaml \
  --suppress-unscannable-file-warnings > "$temp_scan"

# Check if there are any secrets in the scan that aren't in baseline
if [ -f .secrets.baseline ]; then
  baseline_count=$(jq '.results | length' .secrets.baseline 2>/dev/null || echo "0")
  current_count=$(jq '.results | length' "$temp_scan" 2>/dev/null || echo "0")

  if [ "$current_count" -gt "$baseline_count" ]; then
    echo ""
    echo "❌ New secrets detected!"
    echo "Current secrets: $current_count, Baseline: $baseline_count"
    echo ""
    echo "What to do next:"
    echo "1. Review the detected secrets"
    echo "2. If they are false positives or acceptable secrets:"
    echo "   cp $temp_scan .secrets.baseline"
    echo "3. If they are real secrets, remove them and use environment variables"
    echo "4. Then commit again"
    echo ""
    rm "$temp_scan"
    exit 1
  fi
else
  secret_count=$(jq '.results | length' "$temp_scan" 2>/dev/null || echo "0")
  if [ "$secret_count" -gt "0" ]; then
    echo ""
    echo "❌ Secrets detected and no baseline exists!"
    echo "Found $secret_count potential secrets."
    echo ""
    echo "To create baseline: cp $temp_scan .secrets.baseline"
    echo "Then review and commit the baseline file."
    echo ""
    rm "$temp_scan"
    exit 1
  fi
fi

rm "$temp_scan"
echo "✅ No new secrets detected!"
exit 0
