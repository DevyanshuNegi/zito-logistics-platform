# Render Deployment

This repo is ready for a Render Blueprint deploy from the repo-root [render.yaml](/C:/Users/Abcom/Desktop/Zito/render.yaml:1).

## What gets created

- `zito-backend` as a Node web service
- `zito-frontend` as a Node web service for Next.js
- `zito-redis` as a Render Key Value instance
- `zito-db` as a Render Postgres database

## Why this setup looks this way

- The frontend is Next.js 14, so it must run as a Node web service instead of a static site.
- The backend must build `dist/` before boot, so the Blueprint runs Prisma generate, Prisma migrate, and the Nest build during Render's build phase.
- The backend code reads `ALLOWED_ORIGINS`, not `CORS_ORIGIN`.
- The frontend code reads `NEXT_PUBLIC_API_URL`, not `VITE_API_URL`.
- The Blueprint enables BullMQ monitoring with Redis so `/api/v1/health` can report Redis and queue readiness correctly.

## First deploy

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. In Render, choose `New` -> `Blueprint`.
3. Connect the repository and keep the default root-level `render.yaml`.
4. Review the four resources Render will create.
5. Start the deploy.

## Required follow-up env values

Add these in the Render dashboard after the first sync if you want live integrations instead of safe fallbacks:

- Backend:
  - `RESEND_API_KEY`
  - `AT_USERNAME`
  - `AT_API_KEY`
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE`
  - `MPESA_PASSKEY`
  - `MPESA_CALLBACK_URL`
  - `GOOGLE_MAPS_API_KEY`
  - `SENTRY_DSN`
  - `DATADOG_API_KEY`
- Frontend:
  - none beyond `NEXT_PUBLIC_API_URL` for baseline deploy

## Post-deploy checks

After the deploy finishes:

1. Open `https://zito-backend.onrender.com/api/v1/health`
2. Confirm `database.status` is `UP`
3. Confirm `redis.status` is `UP`
4. Open `https://zito-frontend.onrender.com/login`
5. Sign in and load at least one protected page

## Important Render notes

- This Blueprint uses free instances by default to keep setup simple.
- Free Render web services spin down on idle.
- Free Render Postgres expires after 30 days.
- Free Render Key Value is in-memory only and loses data on restart.

Before a real go-live, change these plans in [render.yaml](/C:/Users/Abcom/Desktop/Zito/render.yaml:1):

- `zito-db` from `free` to a paid Postgres tier
- `zito-redis` from `free` to a paid Key Value tier
- `zito-backend` and `zito-frontend` from `free` if you want no cold starts
