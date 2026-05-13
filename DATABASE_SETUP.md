# Database Setup - Permanent Solution

## Problem
Backend keeps failing with: `PrismaClientInitializationError: Can't reach database server`

This is because `.env` points to a remote AWS Neon database that's not accessible from your machine.

## Solution: Local PostgreSQL

### 1. Install PostgreSQL (if not installed)
- Download from: https://www.postgresql.org/download/windows/
- Or use: `choco install postgresql` (if using Chocolatey)

### 2. Create local database
```bash
# Open PostgreSQL command line
psql -U postgres

# Create database
CREATE DATABASE zito_db;
\q
```

### 3. Update `.env` (Already Done)
Your `.env` now has:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zito_db"
```

### 4. Initialize Prisma migrations
```bash
cd backend
npx prisma migrate deploy
```

### 5. Restart backend server
```bash
cd backend
npm run dev
```

---

## Option 2: Keep Using Remote Database

If you need AWS database access:

1. **Check PostgreSQL is running on your system**
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. **Verify AWS database is online**
   - Check AWS Console → RDS → Neon database status
   - Test connection from terminal:
   ```bash
   psql postgresql://neondb_owner:npg_QBS3bXA0jPsr@ep-fancy-flower-aomdlszy-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb
   ```

3. **Check firewall/network**
   - Ensure port 5432 is open
   - Check if corporate VPN/proxy is blocking AWS connections

---

## Recommended: Use Environment-Specific .env Files

Create `.env.local` for development (ignored by git):
```
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zito_db"
TWILIO_VERIFY_SERVICE_SID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
PORT=5000
```

This keeps your committed `.env` unchanged while allowing local overrides.
