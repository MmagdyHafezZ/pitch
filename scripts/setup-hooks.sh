#!/bin/bash

echo "🔧 Setting up PITCH development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo -e "${RED}❌ Error: Please run this script from the PITCH project root directory${NC}"
    exit 1
fi

echo "📦 Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
else
    echo -e "${RED}❌ Error: pnpm is not installed. Please install pnpm first.${NC}"
    echo "Install pnpm: npm install -g pnpm"
    exit 1
fi

echo "🪝 Setting up Git hooks with Husky..."
pnpm exec husky install

# Ensure hooks are executable
if [ -f ".husky/pre-commit" ]; then
    chmod +x .husky/pre-commit
    echo -e "${GREEN}✅ Pre-commit hook configured${NC}"
else
    echo -e "${YELLOW}⚠️ Pre-commit hook file not found${NC}"
fi

if [ -f ".husky/commit-msg" ]; then
    chmod +x .husky/commit-msg
    echo -e "${GREEN}✅ Commit message hook configured${NC}"
else
    echo -e "${YELLOW}⚠️ Commit message hook file not found${NC}"
fi

echo "🧪 Running initial quality checks..."

# Check if everything builds
echo "Building applications..."
if pnpm build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${YELLOW}⚠️ Build failed - you may need to fix issues before committing${NC}"
fi

# Check linting
echo "Running linters..."
if pnpm lint; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠️ Linting issues found - run 'pnpm lint:fix' to fix automatically${NC}"
fi

# Check type checking
echo "Running type checks..."
if pnpm type-check; then
    echo -e "${GREEN}✅ Type checking passed${NC}"
else
    echo -e "${YELLOW}⚠️ Type errors found - please fix before committing${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "📋 What's been configured:"
echo "  • Husky git hooks for pre-commit and commit-msg validation"
echo "  • Commitlint for conventional commit message format"
echo "  • Lint-staged for staged file quality checks"
echo "  • Prettier for code formatting"
echo "  • ESLint for code linting"
echo ""
echo "🚀 You're ready to start developing!"
echo ""
echo "📚 Useful commands:"
echo "  pnpm dev          - Start development servers"
echo "  pnpm commit       - Interactive commit with guided prompts"
echo "  pnpm lint:fix     - Fix linting issues automatically"
echo "  pnpm format       - Format all code with Prettier"
echo "  pnpm test         - Run tests"
echo "  pnpm build        - Build for production"
echo ""
echo "📖 Read more about commit conventions:"
echo "  docs/commit-conventions.md"