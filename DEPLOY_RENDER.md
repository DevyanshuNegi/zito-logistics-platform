# Deploy ZITO to Render

## Quick Deploy (Blueprints)

1. **Fork/Upload** this repo to GitHub
2. **Go to** [Render Dashboard](https://dashboard.render.com)
3. Click **"New +"** → **"Blueprint"**
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and create:
   - PostgreSQL database
   - Backend Node.js service
   - Frontend static site

## Manual Deploy

### 1. Database
```
New + → PostgreSQL
Name: zito-db
Database: zito_production
User: zito_admin
```

### 2. Backend Web Service
```
New + → Web Service
Name: zito-backend
Runtime: Node
Build: npm install
Start: npm start
Root Directory: backend
```

**Environment Variables:**
| Key | Value |
|-----|-------|
| NODE_ENV | production |
| PORT | 10000 |
| DB_HOST | (from zito-db) |
| DB_PORT | (from zito-db) |
| DB_NAME | (from zito-db) |
| DB_USER | (from zito-db) |
| DB_PASSWORD | (from zito-db) |
| JWT_SECRET | (generate) |
| JWT_REFRESH_SECRET | (generate) |

### 3. Frontend Static Site
```
New + → Static Site
Name: zito-frontend
Build: npm install && npm run build
Publish: dist
Root Directory: frontend
```

**Environment Variables:**
| Key | Value |
|-----|-------|
| VITE_API_URL | https://zito-backend.onrender.com |

## Post-Deploy

1. Run migrations:
```bash
# In Render Shell for backend
npm run db:migrate
npm run db:seed  # optional
```

2. Create admin user:
```bash
npm run create:admin
```

## Troubleshooting

- **CORS errors**: Add frontend URL to backend `CORS_ORIGIN`
- **DB connection**: Check DB credentials in service env vars
- **Build fails**: Check Node version (requires Node 18+)

## Migration from Legacy Hosts

1. Export your existing PostgreSQL data
2. Import it into Render PostgreSQL
3. Update your API/frontend environment variables to Render service URLs
4. Cut traffic over only after frontend and API health checks pass
