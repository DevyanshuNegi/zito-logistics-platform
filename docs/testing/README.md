# ZITO Testing Documentation

## Overview
This directory contains testing resources for ZITO Platform Phase 1 validation.

## Test Documents

| File | Purpose |
|------|---------|
| `ZITO_Testing_Addendum_PRD_Gaps.md` | PRD gaps identified during testing |
| `MANUAL_TEST_CHECKLIST.md` | Manual testing checklist with 100+ test cases |
| `POSTMAN_COLLECTION.json` | Postman collection for API testing |

## Automated Testing (Backend)

### Setup
```bash
cd backend
npm install
```

### Run Tests
```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- api.test.js

# Run with environment
./tests/run-tests.sh local
```

### Test Structure
```
tests/
├── api.test.js           # Main API test suite
├── jest.config.js        # Jest configuration
├── setup.js              # Test setup (DB, mocks)
└── run-tests.sh          # Test runner script
```

## Test Categories

### 1. Health & Auth
- API health check
- Login for all 8 roles
- Token validation

### 2. Role Access Control
- Landing page routing
- Route protection by role
- Permission matrix validation

### 3. Core Admin Operations
- PRD §5.1 KPIs (Total/Active/Pending Bookings, Revenue, Payments)
- CRUD operations
- Soft delete / include_deleted

### 4. Booking Lifecycle
- Create (customer/agent)
- Auto/manual assignment
- Status progression
- POD upload
- Cancellation

### 5. Portals
- Customer, Driver, Transporter
- Agent (PRD §5.5)
- Agency (PRD §5.6)

### 6. View As (Super Admin)
- Preview all roles
- X-View-As-User header
- ops/finance admin blocked

### 7. Audit & Compliance
- Audit log entries
- Compliance status changes
- Document expiry alerts

## Manual Testing

### Using Postman
1. Import `POSTMAN_COLLECTION.json`
2. Set environment variables:
   - `base_url`: http://localhost:5000 (or your URL)
   - `auth_token`: (auto-set after login)
3. Run collections in order

### Using Checklist
1. Print `MANUAL_TEST_CHECKLIST.md`
2. Mark each test ⬜ → ✅ or ❌
3. Document issues in "Critical Issues" section
4. Get sign-off from QA/Product/Tech leads

## Environment Variables for Testing

```bash
# Local testing
NODE_ENV=test
DB_HOST=localhost
DB_NAME=zito_test
JWT_SECRET=test-secret
JWT_REFRESH_SECRET=test-refresh-secret

# Staging testing
NODE_ENV=staging
API_URL=https://zito-backend-staging.onrender.com

# Production testing (careful!)
NODE_ENV=production
API_URL=https://zito-backend.onrender.com
```

## CI/CD Integration

Add to `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm run test:ci
```

## Sign-off Criteria

Before Phase 1 launch:
- [ ] 90%+ automated test coverage
- [ ] All P0 tests passing (from PHASE1_TODO.md)
- [ ] Manual checklist 100% complete
- [ ] No critical issues open
- [ ] QA Lead sign-off
- [ ] Product Owner sign-off
- [ ] Tech Lead sign-off

## Debugging Failed Tests

1. Check test output: `cat backend/test-output.log`
2. Run single test: `npm test -- -t "test name"`
3. Enable debug: `DEBUG=* npm test`
4. Check database: Verify test DB is clean
5. API logs: Check backend console for errors

## Adding New Tests

```javascript
describe('New Feature', () => {
  test('should do something', async () => {
    const res = await request(app)
      .get('/api/v1/new-endpoint')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('expectedField');
  });
});
```

## Contact

For testing issues, contact:
- QA Lead: qa@vglobal-logistics.com
- Tech Lead: tech@vglobal-logistics.com
