# Zito Frontend

This workspace is the Next.js 14 web portal for Zito by Aurenza Limited.

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

- The repo-root [render.yaml](/C:/Users/Abcom/Desktop/Zito/render.yaml:1) deploys this app as a Node web service.
- Use `npm run build` for production builds.
- Use `npm run start` for the Render start command.
