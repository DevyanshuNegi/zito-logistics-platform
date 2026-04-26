export const LEGACY_ROLE_MAP = Object.freeze({
  admin: 'operations_admin',
  operations: 'operations_admin',
  accounts: 'finance_admin',
});

export const normalizeRole = (role) => LEGACY_ROLE_MAP[role] || role || '';

export const SUPER_ADMIN_ROLE = 'super_admin';
export const OPERATIONS_ADMIN_ROLE = 'operations_admin';
export const FINANCE_ADMIN_ROLE = 'finance_admin';

export const ADMIN_ROLES = [
  SUPER_ADMIN_ROLE,
  OPERATIONS_ADMIN_ROLE,
  FINANCE_ADMIN_ROLE,
];

export const OPERATIONS_ROLES = [
  SUPER_ADMIN_ROLE,
  OPERATIONS_ADMIN_ROLE,
];

export const FINANCE_ROLES = [
  SUPER_ADMIN_ROLE,
  FINANCE_ADMIN_ROLE,
];

export const MARKETPLACE_ROLES = [
  'driver',
  'transporter',
  'agent',
  ...ADMIN_ROLES,
];

export const SETTINGS_ROLES = [SUPER_ADMIN_ROLE];

export const PORTAL_HOME_BY_ROLE = Object.freeze({
  [SUPER_ADMIN_ROLE]: '/',
  [OPERATIONS_ADMIN_ROLE]: '/',
  [FINANCE_ADMIN_ROLE]: '/reports',
  customer: '/portal/customer',
  driver: '/portal/driver',
  transporter: '/portal/transporter',
  agent: '/portal/agent',
  agency: '/portal/agency',
});

export const getHomePathForRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return PORTAL_HOME_BY_ROLE[normalizedRole] || '/login';
};

export const matchesAllowedRoles = (role, allowedRoles = []) => {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalizedRole);
};

export const canUseViewAs = (role) => normalizeRole(role) === SUPER_ADMIN_ROLE;
