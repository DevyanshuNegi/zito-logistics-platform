// src/middleware/auth.js
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

const jwt  = require('jsonwebtoken');
const { User, Driver, DriverCompliance } = require('../models');

/* ============================================================
   ROLE CONSTANTS
   Single source of truth — import ROLES in every route file
   instead of using magic strings.
   PRD §3 — all eight roles defined here.
   ============================================================ */

const ROLES = {
  SUPER_ADMIN:      'super_admin',
  OPERATIONS_ADMIN: 'operations_admin',
  FINANCE_ADMIN:    'finance_admin',
  CUSTOMER:         'customer',
  DRIVER:           'driver',
  TRANSPORTER:      'transporter',
  AGENT:            'agent',
  AGENCY:           'agency',
};

// All three admin variants — used throughout for role guards
const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS_ADMIN,
  ROLES.FINANCE_ADMIN,
];

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
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Access token required' }
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      const code = jwtErr.name === 'TokenExpiredError'
        ? 'TOKEN_EXPIRED'
        : 'INVALID_TOKEN';
      return res.status(401).json({
        success: false,
        error: { code, message: 'Invalid or expired token. Please log in again.' }
      });
    }

    // Always load fresh from DB — never trust stale token payload for role/status
    const user = await User.findByPk(decoded.id, {
      attributes: [
        'id', 'role', 'email', 'full_name', 'phone',
        'is_active', 'is_deleted',
        'compliance_status', 'data_locked',
        'transporter_id', 'agent_id', 'agency_id',
        'scope_type',
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' }
      });
    }

    // PRD §25.9 — soft delete: blocked accounts must not pass auth
    if (user.is_deleted) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_DELETED', message: 'This account has been removed. Contact support.' }
      });
    }

    // PRD §17 — inactive / suspended accounts are blocked immediately
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is suspended. Contact support.' }
      });
    }

    // ── Legacy role guard ──────────────────────────────────────────────────
    // If DB still has old 'admin' role before migration runs, treat it as
    // operations_admin so authorize() does not silently fail.
    // Remove this block after running:
    //   UPDATE users SET role='operations_admin' WHERE role='admin';
    if (user.role === 'admin') {
      user.role = ROLES.OPERATIONS_ADMIN;
    }
    // ──────────────────────────────────────────────────────────────────────

    req.user = user;
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

  let status = req.user.compliance_status;

  // Expiry auto-block check (drivers)
  if (req.user.role === ROLES.DRIVER) {
    try {
      const driver = await Driver.findOne({ where: { user_id: req.user.id } });
      if (driver) {
        const comp = await DriverCompliance.findOne({ where: { driver_id: driver.id } });
        const now = new Date();
        const expiredFields = [];
        if (comp) {
          if (comp.license_expiry && new Date(comp.license_expiry) < now) expiredFields.push('license_expiry');
          if (comp.police_clearance_expiry && new Date(comp.police_clearance_expiry) < now) expiredFields.push('police_clearance_expiry');
          if (comp.medical_expiry && new Date(comp.medical_expiry) < now) expiredFields.push('medical_expiry');
        }
        if (expiredFields.length) {
          status = 'resubmission_required';
          await Promise.all([
            driver.update({ can_receive_assignments: false, is_available: false }),
            comp?.update({
              compliance_status: 'resubmission_required',
              status_updated_at: now,
              resubmission_comment: `Document expired: ${expiredFields.join(', ')}`,
            }),
            User.update({ compliance_status: 'resubmission_required' }, { where: { id: req.user.id } }),
          ]);
        }
      }
    } catch (e) {
      console.error('compliance expiry check failed', e.message);
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
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
    });
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
      req.scope = { isAdmin: false, transporter_id: id };
      break;

    case ROLES.AGENT:
      // Own customer portfolio and their bookings — PRD §3.7, §16.5
      req.scope = { isAdmin: false, agent_id: id };
      break;

    case ROLES.AGENCY:
      // All managed agents/transporters under this agency — PRD §3.8, §16.5
      req.scope = { isAdmin: false, agency_id: id };
      break;

    case ROLES.DRIVER:
      // Own assigned trips and compliance docs only — PRD §3.5, §16.5
      req.scope = { isAdmin: false, driver_id: id };
      break;

    case ROLES.CUSTOMER:
      // Own bookings, invoices, trip history — PRD §3.4, §16.5
      req.scope = { isAdmin: false, customer_id: id };
      break;

    default:
      return res.status(403).json({
        success: false,
        error: { code: 'UNKNOWN_ROLE', message: `Unrecognised role: ${role}` }
      });
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
    const targetUser = await User.findByPk(viewAsId, {
      attributes: [
        'id', 'role', 'email', 'full_name',
        'is_active', 'is_deleted', 'compliance_status',
        'transporter_id', 'agent_id', 'agency_id',
      ]
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'View As target user not found' }
      });
    }

    if (targetUser.is_deleted || !targetUser.is_active) {
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
      const AuditLog = require('../models/auditLog');
      await AuditLog.create({
        user_id:      req.adminUser?.id || req.user?.id || null,
        acting_as:    req.viewAs ? req.adminUser?.role : req.user?.role,
        view_as_user: req.viewAs ? req.user?.id : null,
        action,
        details:      JSON.stringify(details),
        ip_address:   req.ip || req.headers['x-forwarded-for'] || null,
        user_agent:   req.headers['user-agent'] || null,
        // created_at is set by DB default — never passed in (immutable)
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

  if (req.user.data_locked) {
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

  const { role, id, transporter_id } = req.user;

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
  // Inline export for compliance routes convenience
  requireCompliance,

  // Role constants — always import from here, never use magic strings
  ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
};
