// ─────────────────────────────────────────────────────────────
//  ZITO · Roles & Permissions Constants
//  Single source of truth for all role identifiers and
//  permission groupings used in RBAC middleware + controllers.
// ─────────────────────────────────────────────────────────────

/**
 * All platform roles.
 * These are the only valid values for users.role.
 */
const ROLES = {
  SUPER_ADMIN:       'super_admin',
  OPERATIONS_ADMIN:  'operations_admin',
  FINANCE_ADMIN:     'finance_admin',
  CUSTOMER:          'customer',
  DRIVER:            'driver',
  TRANSPORTER:       'transporter',
  AGENT:             'agent',
  AGENCY:            'agency',
  CALL_CENTRE_AGENT: 'call_centre_agent',
  WAREHOUSE_PARTNER: 'warehouse_partner',
  SGR_OPERATOR:      'sgr_operator',
};

/**
 * Convenience groupings — used in route middleware to allow
 * multiple roles access to a single endpoint.
 *
 * Usage in a route:
 *   const { ROLE_GROUPS } = require('../constants/roles');
 *   router.get('/bookings', auth, permit(ROLE_GROUPS.ALL_ADMINS), handler);
 */
const ROLE_GROUPS = {

  // Any admin-level role
  ALL_ADMINS: [
    ROLES.SUPER_ADMIN,
    ROLES.OPERATIONS_ADMIN,
    ROLES.FINANCE_ADMIN,
  ],

  // Roles that can manage bookings operationally
  BOOKING_MANAGERS: [
    ROLES.SUPER_ADMIN,
    ROLES.OPERATIONS_ADMIN,
    ROLES.CALL_CENTRE_AGENT,
    ROLES.TRANSPORTER,
    ROLES.AGENT,
  ],

  // Roles that can create a booking on behalf of a customer
  CAN_CREATE_BOOKING: [
    ROLES.SUPER_ADMIN,
    ROLES.OPERATIONS_ADMIN,
    ROLES.CUSTOMER,
    ROLES.CALL_CENTRE_AGENT,
    ROLES.TRANSPORTER,
    ROLES.AGENT,
  ],

  // Roles that can view financial data
  FINANCE_ACCESS: [
    ROLES.SUPER_ADMIN,
    ROLES.FINANCE_ADMIN,
  ],

  // Roles that can approve/reject drivers and compliance
  COMPLIANCE_APPROVERS: [
    ROLES.SUPER_ADMIN,
    ROLES.OPERATIONS_ADMIN,
  ],

  // Roles with access to platform-wide configuration
  PLATFORM_CONFIG: [
    ROLES.SUPER_ADMIN,
  ],

  // Roles that can manage users (create, deactivate, blacklist)
  USER_MANAGERS: [
    ROLES.SUPER_ADMIN,
    ROLES.OPERATIONS_ADMIN,
  ],

  // Roles that can participate in the bidding marketplace
  MARKETPLACE_PARTICIPANTS: [
    ROLES.DRIVER,
    ROLES.TRANSPORTER,
    ROLES.AGENT,
  ],

  // Roles that manage their own sub-accounts or fleet
  FLEET_MANAGERS: [
    ROLES.TRANSPORTER,
    ROLES.AGENCY,
  ],

  // All authenticated roles (any logged-in user)
  ALL_AUTHENTICATED: Object.values(ROLES),
};

/**
 * Compliance statuses for users and drivers.
 * Used in users.compliance_status and driver_compliance.compliance_status.
 */
const COMPLIANCE_STATUS = {
  PENDING:                'pending',
  APPROVED:               'approved',
  REJECTED:               'rejected',
  RESUBMISSION_REQUIRED:  'resubmission_required',
};

/**
 * Per-role metadata — portal name, description.
 * Useful for audit logs, notifications, and admin UI labels.
 */
const ROLE_META = {
  [ROLES.SUPER_ADMIN]: {
    label: 'Super Admin',
    portal: 'Admin Portal',
    description: 'Unrestricted platform access and configuration.',
  },
  [ROLES.OPERATIONS_ADMIN]: {
    label: 'Operations Admin',
    portal: 'Admin Portal',
    description: 'Day-to-day booking and driver assignment management.',
  },
  [ROLES.FINANCE_ADMIN]: {
    label: 'Finance Admin',
    portal: 'Admin Portal',
    description: 'Financial reporting, invoices, and payment reconciliation.',
  },
  [ROLES.CUSTOMER]: {
    label: 'Customer',
    portal: 'Customer Portal',
    description: 'Book, track, and review freight orders.',
  },
  [ROLES.DRIVER]: {
    label: 'Driver',
    portal: 'Driver Portal',
    description: 'Accept trips, update status, manage wallet and earnings.',
  },
  [ROLES.TRANSPORTER]: {
    label: 'Transporter',
    portal: 'Transporter Portal',
    description: 'Manage own fleet, drivers, customers, and bookings.',
  },
  [ROLES.AGENT]: {
    label: 'Agent',
    portal: 'Agent Portal',
    description: 'Manage customer portfolios and earn commission on bookings.',
  },
  [ROLES.AGENCY]: {
    label: 'Agency',
    portal: 'Agency Portal',
    description: 'Manage multiple agents and transporters in a franchise model.',
  },
  [ROLES.CALL_CENTRE_AGENT]: {
    label: 'Call Centre Agent',
    portal: 'Admin Portal',
    description: 'Support users with offline bookings and issue resolution.',
  },
  [ROLES.WAREHOUSE_PARTNER]: {
    label: 'Warehouse Partner',
    portal: 'Warehouse Partner Portal',
    description: 'Manage godown space, GRN processing, and inventory.',
  },
  [ROLES.SGR_OPERATOR]: {
    label: 'SGR Operator',
    portal: 'SGR Partner Portal',
    description: 'Manage rail cargo slots and terminus handovers.',
  },
};

/**
 * Helper: check if a role is any type of admin.
 * Usage: isAdmin(req.user.role)
 */
const isAdmin = (role) => ROLE_GROUPS.ALL_ADMINS.includes(role);

/**
 * Helper: check if a role is a Super Admin specifically.
 */
const isSuperAdmin = (role) => role === ROLES.SUPER_ADMIN;

/**
 * Helper: check if a given role is permitted.
 * Usage in middleware: permit([ROLES.SUPER_ADMIN, ROLES.OPERATIONS_ADMIN])
 */
const permit = (...allowedRoles) => (req, res, next) => {
  const flat = allowedRoles.flat();
  if (!req.user || !flat.includes(req.user.role)) {
    const { ERRORS, buildError } = require('./errors');
    return res.status(403).json(buildError(ERRORS.ROLE_NOT_PERMITTED));
  }
  next();
};

module.exports = {
  ROLES,
  ROLE_GROUPS,
  COMPLIANCE_STATUS,
  ROLE_META,
  isAdmin,
  isSuperAdmin,
  permit,
};