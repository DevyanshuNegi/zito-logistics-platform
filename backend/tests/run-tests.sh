#!/bin/bash
# ZITO API Test Runner
# Usage: ./run-tests.sh [environment]
# Environments: local, staging, production

set -e

ENV=${1:-local}
echo "🧪 Running ZITO API Tests - Environment: $ENV"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Setup based on environment
case $ENV in
  local)
    export NODE_ENV=test
    export DB_HOST=localhost
    export DB_NAME=zito_test
    echo "📍 Local test database: $DB_NAME"
    ;;
  staging)
    export NODE_ENV=staging
    echo "📍 Staging environment"
    ;;
  production)
    echo -e "${RED}⚠️  WARNING: Running tests in PRODUCTION${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Aborted"
      exit 1
    fi
    export NODE_ENV=production
    ;;
esac

# Install dependencies if needed
echo "📦 Checking dependencies..."
npm list jest supertest >/dev/null 2>&1 || npm install

# Run database migrations
echo "🗄️  Setting up test database..."
npm run db:migrate:test 2>/dev/null || echo "Migration skipped (may not exist)"

# Run tests
echo "🚀 Starting tests..."
npm test -- --verbose 2>&1 | tee test-output.log

# Check results
if [ ${PIPESTATUS[0]} -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  
  # Generate coverage report
  echo "📊 Coverage report:"
  cat coverage/lcov-report/index.html 2>/dev/null || echo "Coverage report not generated"
  
  exit 0
else
  echo -e "${RED}❌ Tests failed!${NC}"
  echo "📄 See test-output.log for details"
  exit 1
fi
