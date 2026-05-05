# Zito by Aurenza Limited

Zito is the multi-role logistics platform by Aurenza Limited for admin, customer, corporate, courier-company, driver, transporter, agent, and agency workflows.

Current implementation priorities:

- Single-source PRD: `docs/prd/ZITO_PRD_v10_ULTIMATE.docx`
- Searchable PRD export and tracker: `docs/prd/ZITO_PRD_v10_ULTIMATE.txt` and `backend/PRD_TRACKER.md`
- Neon PostgreSQL as the managed database baseline
- Provider-agnostic app hosting and Redis setup
- Manual finance and route-entry fallbacks until live M-Pesa and paid map services are enabled

Main workspaces:

- `frontend/` - web admin and portal frontend
- `backend/` - API and operational workflows
- `zito-mobile/` - Expo mobile routes, shared mobile utilities, and branding assets

Infrastructure:

- Use Neon PostgreSQL for the primary transactional database
- Use `DEPLOY_NEON.md` for Neon setup and production environment guidance
- Choose backend, frontend, and Redis hosting independently of the database vendor

Local run defaults:

- Backend: `http://127.0.0.1:5000`
- Frontend: `http://127.0.0.1:3001`
- Swagger: `http://127.0.0.1:5000/api/docs`
