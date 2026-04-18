# ZITO

ZITO is a multi-role logistics platform for admin, customer, driver, transporter, agent, and agency workflows.

Current implementation priorities:

- Frontend-first PRD alignment based on `docs/prd/Zito_PRD_v6_Final.txt`
- Render as the default deployment target
- Manual finance and route-entry fallbacks until live M-Pesa and paid map services are enabled

Main workspaces:

- `frontend/` - web admin and portal frontend
- `backend/` - API and operational workflows
- `app/` - Expo mobile routes
- `src/` - shared mobile utilities and constants

Deployment:

- Use Render blueprints from `render.yaml`
- See `DEPLOY_RENDER.md` for the Render-first setup flow
