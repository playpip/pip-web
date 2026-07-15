#!/usr/bin/env bash

# Runs the full check suite (the same gates as CI). Exit on first failure.
set -e

echo "🧪 Running all tests..."
echo ""

echo "📝 Checking code formatting..."
pnpm test:format
echo ""
echo "✅ Format check passed"
echo ""

echo "🔍 Checking TypeScript types..."
pnpm test:types
echo ""
echo "✅ Type check passed"
echo ""

echo "🔎 Running linter..."
pnpm test:lint
echo ""
echo "✅ Lint check passed"
echo ""

echo "🧩 Running AVA tests..."
pnpm test:ava
echo ""
echo "✅ AVA tests passed"
echo ""

echo "🗑️  Checking for unused code..."
pnpm test:knip
echo ""
echo "✅ Knip check passed"
echo ""

echo "🔒 Running security audit..."
pnpm test:audit
echo ""
echo "✅ Audit passed"
echo ""

echo "✅ Everything passes!"
