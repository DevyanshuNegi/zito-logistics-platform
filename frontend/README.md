# Zito Frontend

This workspace is the Next.js 14 web portal for Zito by Zito Tech Africa Limited.

## Local setup

1. Install dependencies

```bash
npm install
```

2. Create `frontend/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

3. Start the frontend

```bash
npm run dev
```

The app runs on `http://localhost:3000` by default, so set `PORT=3001` if the backend is already using `3000`.

## Production deployment

- The frontend reads `NEXT_PUBLIC_API_URL` and is hosting-provider agnostic.
- Use Neon for the backing PostgreSQL database through the backend environment, not as a frontend host.
- Use `npm run build` for production builds.
- Use `npm run start` for any Node-compatible production host.
