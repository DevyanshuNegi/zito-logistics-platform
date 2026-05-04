# Neon Infrastructure Baseline

This repo now treats Neon PostgreSQL as the managed primary database baseline.

## What Neon covers

- Managed PostgreSQL
- Branching and environment isolation at the database layer
- SSL-secured connection strings for local and production environments

## What Neon does not cover

- Backend hosting
- Frontend hosting
- Redis or queue storage

Choose those runtime services independently so the platform is not locked to a single app-hosting vendor.

## Recommended environment model

Backend:

- `DATABASE_URL` = Neon pooled connection string for application runtime
- `DIRECT_URL` = Neon direct connection string for Prisma migrations and maintenance
- `REDIS_URL` = your chosen Redis provider or local Redis

Frontend:

- `NEXT_PUBLIC_API_URL` = your deployed backend origin plus `/api/v1`

Mobile:

- `EXPO_PUBLIC_API_URL` = your reachable backend origin

## Neon setup

1. Create a Neon project and database.
2. Open Neon `Connection parameters` and collect both the direct `Host` and `Pooler host`.
3. Build `DATABASE_URL` with the Neon `Pooler host`.
4. Build `DIRECT_URL` with the Neon direct `Host`.
5. Keep `sslmode=require` on both URLs.
6. On local Windows setups, do not add `channel_binding=require` to the Prisma URLs unless you have verified the TLS stack supports it.
6. Update `backend/.env` with the Neon URLs, then run:

```bash
cd backend
npm run deploy:neon
```

The `deploy:neon` script validates that:

- `DATABASE_URL` uses the Neon pooler host
- `DATABASE_URL` includes `pgbouncer=true`
- `DIRECT_URL` uses the direct Neon host
- both URLs include `sslmode=require`

## Local development example

```env
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-PROJECT-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://USER:PASSWORD@YOUR-NEON-PROJECT.REGION.aws.neon.tech/neondb?sslmode=require
REDIS_URL=redis://localhost:6379
```

## Mapping from the Neon console screen

If you are using the `Connection parameters` tab in Neon:

- `Pooler host` -> use this host in `DATABASE_URL`
- `Host` -> use this host in `DIRECT_URL`
- `Database` -> use this as the database name
- `Role` -> use this as the username
- `Password` -> use the real unmasked password in both URLs

Do not rely on the single `Connection string` box unless you verify that it already uses the `Pooler host`. In this repo, the safest setup is to build both URLs from `Connection parameters`.

Example pattern:

```env
DATABASE_URL=postgresql://ROLE:PASSWORD@POOLER_HOST/DATABASE?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://ROLE:PASSWORD@HOST/DATABASE?sslmode=require
```

## Production checklist

- Neon `DATABASE_URL` configured
- Neon `DIRECT_URL` configured
- Redis provider configured
- `ALLOWED_ORIGINS` set for the deployed frontend
- `NEXT_PUBLIC_API_URL` set for the web app
- JWT secrets configured
- Payment, SMS, email, and maps credentials configured when moving beyond fallback mode
