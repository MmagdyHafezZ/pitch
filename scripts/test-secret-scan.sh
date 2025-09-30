#!/bin/bash

# Test script to show what detect-secrets will scan vs exclude

echo "🔍 Testing detect-secrets folder exclusions..."
echo ""

echo "📂 Folders that WILL be scanned:"
find . -type d -name "src" -o -name "public" -o -name "docs" | head -10

echo ""
echo "🚫 Folders that will be EXCLUDED:"
echo "  - .git/"
echo "  - .husky/_/"
echo "  - node_modules/"
echo "  - apps/*/node_modules/"
echo "  - apps/*/dist/"
echo "  - apps/*/build/"
echo "  - apps/*/.next/"
echo "  - apps/*/coverage/"
echo "  - apps/*/prisma/migrations/"
echo "  - apps/*/prisma/generated/"
echo "  - docker/"
echo "  - .vscode/"
echo "  - .idea/"

echo ""
echo "📄 File types that will be EXCLUDED:"
echo "  - *.min.js, *.min.css"
echo "  - *.map files"
echo "  - *.log files"
echo "  - Image files (png, jpg, svg, etc.)"
echo "  - Font files (woff, ttf, etc.)"
echo "  - Lock files (pnpm-lock.yaml, package-lock.json)"
echo "  - .env.example files"

echo ""
echo "✅ This ensures detect-secrets only scans actual source code!"