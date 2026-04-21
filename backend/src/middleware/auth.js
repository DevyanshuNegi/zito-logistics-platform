// PRD v8.0 — Industry Standard Backend Alignment
//
// PRD References:
//   §3   — User Roles & Permissions (RBAC)
//   §11  — Security (JWT, RBAC enforced at middleware level)
//   §14  — Compliance & KYC Framework
//   §16  — Centralised Control Model (VG Authority / data scope)
//   §18  — System Enforcement Rules (assignment validation, data lock)
//   §25.1 — API-level role-based data filtering
//   §25.2 — Booking ownership model
//   §25.7 — Multi-tenant isolation
//   §25.8 — Audit log system
//
// ─── ROLE ALIGNMENT (Option A — DB updated to match PRD) ─────────────────────
// DB ENUM now matches PRD §3 exactly:
//   super_admin, operations_admin, finance_admin,
//   customer, driver, transporter, agent, agency
//
// Old 'admin' role: if any legacy records exist, they are treated as
// operations_admin in the ADMIN_ROLES guard (see comment in isAdmin()).
// Run migration: UPDATE users SET role='operations_admin' WHERE role='admin';
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../utils/prisma');

const { verifyJwt } = require('../utils/jwt');
const { ROLES, ADMIN_ROLES } = require('../constants/roles');
const { ERRORS, buildError } = require('../constants/errors');

/* ============================================================ */
// All three admin variants — used throughout for role guards
// All roles — useful for routes open to every authenticated user
const ALL_ROLES = Object.values(ROLES);

/* ============================================================
   1. AUTHENTICATE
   Validates Bearer JWT, loads fresh user from DB, blocks
   deleted / inactive accounts before anything else runs.
   PRD §11 — JWT required on all endpoints except /register & /login.
   ============================================================ */

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(ERRORS.UNAUTHORIZED.httpStatus).json(buildError(ERRORS.AUTH_REQUIRED));
    }

    const token = authHeader.split(' ')[1];

    // Verify signature and expiry
    let decoded;
    try {
      decoded = verifyJwt(token);
    } catch (jwtErr) {
      const code = jwtErr.name === 'TokenExpiredError'
        ? 'TOKEN_EXPIRED'
        : 'INVALID_TOKEN';
      return res.status(401).json(buildError(ERRORS[code] || ERRORS.TOKEN_INVALID));
    }

    // Always load fresh from DB — never trust stale token payload for role/status
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        role: true,
        email: true,
        full_name: true,
        phone: true,
        isActive: true,
        deletedAt: true,
        complianceStatus: true,
        dataLocked: true,
        transporterId: true,
        agentId: true,
        agencyId: true,
      }
    });

    if (!user) {
      return res.status(ERRORS.USER_NOT_FOUND.httpStatus).json(buildError(ERRORS.USER_NOT_FOUND));
    }

    // PRD §25.9 — soft delete: blocked accounts must not pass auth
    if (user.deletedAt) {
      return res.status(401).json(buildError(ERRORS.ACCOUNT_DEACTIVATED, 'This account has been removed.'));
    }

    // PRD §17 — inactive / suspended accounts are blocked immediately
    if (!user.isActive) {
      return res.status(401).json(buildError(ERRORS.ACCOUNT_DEACTIVATED, 'Account is suspended.'));
    }

    // §4.1 acting_as field in JWT enables View As mode
    if (decoded.acting_as && user.role === ROLES.SUPER_ADMIN) {
      req.adminUser = user;
      req.user = { ...user, role: decoded.acting_as, isImpersonated: true };
      req.viewAs = true;
    } else {
      req.user = user;
    }

    next();

  } catch (err) {
    console.error('❌ authenticate() error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' }
    });
  }
};

/* ============================================================
   2. AUTHORIZE (Role Guard)
   Pass one or more ROLES values. Fails fast if req.user.role
   is not in the allowed list.
   PRD §3, §11 — RBAC enforced at API middleware level.

   Usage:
     router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN), handler)
   ============================================================ */

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code:    'FORBIDDEN',
          message: `Access denied. Allowed role(s): ${roles.join(', ')}`
        }
      });
    }

    next();
  };
};

/* ============================================================
   3. ADMIN GUARD
   Shorthand — allows any of the three admin roles.
   PRD §3.1–3.3.

   Usage:
     router.get('/', authenticate, isAdmin, handler)
   ============================================================ */

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: { code: 'ADMIN_ONLY', message: 'Admin access required' }
    });
  }

  next();
};

/* ============================================================
   4. SUPER ADMIN GUARD
   Only super_admin reaches system config, pricing, assignment
   engine mode, View As, and global overrides.
   PRD §3.1 — Super Admin is the highest authority.

   Usage:
     router.patch('/system-settings', authenticate, isSuperAdmin, handler)
   ============================================================ */

const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      error: {
        code:    'SUPER_ADMIN_ONLY',
        message: 'Super Admin access required for this action'
      }
    });
  }

  next();
};

/* ============================================================
   5. FINANCE GUARD
   Only finance_admin (and super_admin) reaches financial
   data, invoices, payment records, and contract rates.
   PRD §3.3 — Finance Admin cannot touch operational data.

   Usage:
     router.get('/reports', authenticate, isFinanceOrSuper, handler)
   ============================================================ */

const isFinanceOrSuper = (req, res, next) => {
  const allowed = [ROLES.SUPER_ADMIN, ROLES.FINANCE_ADMIN];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: {
        code:    'FINANCE_ADMIN_ONLY',
        message: 'Finance Admin access required'
      }
    });
  }

  next();
};

/* ============================================================
   6. COMPLIANCE GUARD
   Blocks drivers and transporters whose compliance_status is
   not 'approved' from accessing operational endpoints.
   PRD §14, §18.1 — Assignment blocked if not approved.
   PRD §16 — Approval is exclusively controlled by VG Admin.

   Apply AFTER authenticate on operational routes:
     router.post('/trips/:id/accept', authenticate, requireCompliance, handler)
   ============================================================ */

const requireCompliance = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }

  // Only drivers and transporters go through compliance workflow
  const complianceRoles = [ROLES.DRIVER, ROLES.TRANSPORTER];
  if (!complianceRoles.includes(req.user.role)) {
    return next();
  }

  let status = req.user.complianceStatus;

  // Expiry auto-block check (drivers) - Delegates to service
  if (req.user.role === ROLES.DRIVER) {
    const { checkDriverExpiry } = require('../services/compliance.service');
    const updatedStatus = await checkDriverExpiry(req.user.id);
    if (updatedStatus) {
      status = updatedStatus;
    }
  }

  if (status === 'approved') return next();

  const messages = {
    pending:               'Your account is under review. You cannot perform this action yet.',
    rejected:              'Your account has been rejected. Please contact support.',
    resubmission_required: 'Document resubmission required before you can continue.',
  };

  return res.status(403).json({
    success: false,
    error: {
      code:               'COMPLIANCE_REQUIRED',
      message:            messages[status] || 'Account not yet approved.',
      compliance_status:  status
    }
  });
};

/* ============================================================
   7. APPLY SCOPE (Multi-Tenant Data Isolation)
   Attaches req.scope so every route handler and DB query can
   apply the correct tenant filter without repeating logic.
   PRD §25.1 — API-level role-based data filtering.
   PRD §25.7 — Multi-tenant isolation enforced at API level.
   PRD §16.5 — Each role has a defined data access scope.

   After this middleware, route handlers use:
     req.scope.isAdmin        → true = no filter (sees all)
     req.scope.transporter_id → filter bookings/fleet by this
     req.scope.agent_id       → filter customers/bookings by this
     req.scope.agency_id      → filter sub-accounts by this
     req.scope.driver_id      → filter trips/docs by this
     req.scope.customer_id    → filter bookings/invoices by this
   ============================================================ */

const applyScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(buildError(ERRORS.UNAUTHORIZED));
  }

  const { role, id } = req.user;

  switch (role) {
    case ROLES.SUPER_ADMIN:
    case ROLES.OPERATIONS_ADMIN:
    case ROLES.FINANCE_ADMIN:
      // Admins see everything — no scope restriction
      req.scope = { isAdmin: true };
      break;

    case ROLES.TRANSPORTER:
      // Own fleet, drivers, customers, bookings — PRD §3.6, §16.5
      req.scope = { isAdmin: false, transporter_id: req.user.transporterId || id };
      break;

    case ROLES.AGENT:
      // Own customer portfolio and their bookings — PRD §3.7, §16.5
      req.scope = { isAdmin: false, agent_id: req.user.agentId || id };
      break;

    case ROLES.AGENCY:
      // All managed agents/transporters under this agency — PRD §3.8, §16.5
      req.scope = { isAdmin: false, agency_id: req.user.agencyId || id };
      break;

    case ROLES.DRIVER:
      // Own assigned trips and compliance docs only — PRD §3.5, §16.5
      req.scope = { isAdmin: false, driver_id: id };
      break;

    case ROLES.CUSTOMER:
      // Own bookings, invoices, trip history — PRD §3.4, §16.5
      req.scope = { isAdmin: false, customer_id: id };
      break;

    case ROLES.WAREHOUSE_PARTNER:
      req.scope = { isAdmin: false, partner_id: id };
      break;

    case ROLES.SGR_OPERATOR:
      req.scope = { isAdmin: false, operator_id: id };
      break;

    default:
      return res.status(403).json(buildError(ERRORS.SCOPE_VIOLATION));
  }

  next();
};

/* ============================================================
   8. VIEW AS (Admin Impersonation)
   Super Admin can preview the platform as any user.
   PRD §3.1, §5.1 — "View As" mode for support, QA, onboarding.

   Send header: X-View-As-User: <user_id>
   Real admin identity preserved in req.adminUser for audit log.
   ============================================================ */

const viewAs = async (req, res, next) => {
  const viewAsId = req.headers['x-view-as-user'];
  if (!viewAsId) return next(); // Header not present — normal request

  if (!req.user || req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only Super Admin can use View As mode' }
    });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: viewAsId } });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'View As target user not found' }
      });
    }

    if (targetUser.deletedAt || !targetUser.isActive) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VIEW_AS', message: 'Cannot view as an inactive or deleted user' }
      });
    }

    req.adminUser = req.user;   // preserve real admin identity for audit
    req.user      = targetUser; // replace scope with impersonated user
    req.viewAs    = true;

    next();
  } catch (err) {
    console.error('❌ viewAs() error:', err.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'View As failed' }
    });
  }
};

/* ============================================================
   9. AUDIT LOGGER
   Attaches req.auditLog() helper to every request.
   Route handlers call it in one line for any sensitive action.
   PRD §25.8 — immutable audit log, Admin-visible only.
   PRD §11   — audit logs for sensitive actions.

   Usage in any route handler:
     await req.auditLog('BOOKING_ASSIGNED', { booking_id, driver_id });
     await req.auditLog('DRIVER_APPROVED',  { driver_id, approved_by: req.user.id });
   ============================================================ */

const auditLogger = (req, _res, next) => {
  req.auditLog = async (action, details = {}) => {
    try {
      await prisma.auditLog.create({
        data: {
          userId:       req.adminUser?.id || req.user?.id || null,
          actingAs:     req.viewAs ? req.adminUser?.role : req.user?.role,
          viewAsUser:   req.viewAs ? req.user?.id : null,
          action,
          details:      details, // Prisma handles JSONB directly
          ipAddress:    req.ip || req.headers['x-forwarded-for'] || null,
          userAgent:    req.headers['user-agent'] || null,
        }
      });
    } catch (err) {
      // Non-fatal — never let audit failure break the main request
      console.error('❌ auditLog() write failed (non-fatal):', err.message);
    }
  };

  next();
};

/* ============================================================
   10. DATA LOCK GUARD
   Blocks changes to identity/compliance fields after approval.
   PRD §16.4 — After approval, critical data is read-only.
   PRD §25.3 — Compliance module connected to driver record.

   Apply on PATCH/PUT routes that touch identity fields:
     router.patch('/profile', authenticate, checkDataLock, handler)

   Admin always bypasses — they can unlock then edit.
   ============================================================ */

const LOCKED_FIELDS = [
  'full_name', 'id_number', 'email', 'phone',
  'license_number', 'plate_number', 'kra_pin',
  'date_of_birth', 'national_id',
];

const checkDataLock = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }

  // Admins can always modify any field
  if (ADMIN_ROLES.includes(req.user.role)) return next();

  if (req.user.dataLocked) {
    const attemptedLockedFields = Object.keys(req.body)
      .filter(key => LOCKED_FIELDS.includes(key));

    if (attemptedLockedFields.length > 0) {
      return res.status(403).json({
        success: false,
        error: {
          code:          'DATA_LOCKED',
          message:       'These fields are locked after approval. Contact Admin to request a change.',
          locked_fields: attemptedLockedFields
        }
      });
    }
  }

  next();
};

/* ============================================================
   11. BOOKING OWNERSHIP INJECTOR
   Auto-injects created_by_role, created_by_id, handled_by,
   and transporter_id into req.body before booking creation.
   PRD §25.2 — Booking ownership model.

   Apply on booking POST routes:
     router.post('/', authenticate, injectBookingOwnership, handler)
   ============================================================ */

const injectBookingOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
  }

  const { role, id, transporterId } = req.user;

  req.body.created_by_role = role;
  req.body.created_by_id   = id;

  switch (role) {
    case ROLES.TRANSPORTER:
      req.body.handled_by     = 'transporter';
      req.body.transporter_id = id;
      break;

    case ROLES.AGENT:
      // Agent books on behalf of customer; handled by linked transporter or admin
      req.body.handled_by     = transporter_id ? 'transporter' : 'admin';
      req.body.transporter_id = transporter_id || null;
      break;

    case ROLES.CUSTOMER:
      req.body.handled_by     = 'admin';
      req.body.transporter_id = null;
      break;

    case ROLES.SUPER_ADMIN:
    case ROLES.OPERATIONS_ADMIN:
      // Admin may explicitly set transporter_id in body; default to admin-handled
      req.body.handled_by     = req.body.transporter_id ? 'transporter' : 'admin';
      break;

    default:
      req.body.handled_by     = 'admin';
      req.body.transporter_id = null;
  }

  next();
};

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  // Core auth
  authenticate,
  authorize,

  // Role guards — use these in route files
  isAdmin,
  isSuperAdmin,
  isFinanceOrSuper,

  // Compliance & data integrity
  requireCompliance,
  checkDataLock,
  injectBookingOwnership,

  // Scope & multi-tenancy
  applyScope,

  // Admin tools
  viewAs,

  // Audit
  auditLogger,

  // Role constants — always import from here, never use magic strings
  ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
};
