import {
  FINANCE_ROLES,
  MARKETPLACE_ROLES,
  OPERATIONS_ROLES,
  SETTINGS_ROLES,
  normalizeRole,
} from './roles';

export const PERMISSIONS = {
  dashboard: OPERATIONS_ROLES,
  bookings: OPERATIONS_ROLES,
  assignments: OPERATIONS_ROLES,
  drivers: OPERATIONS_ROLES,
  fleet: OPERATIONS_ROLES,
  customers: OPERATIONS_ROLES,
  transporters: OPERATIONS_ROLES,
  verification: OPERATIONS_ROLES,
  payments: FINANCE_ROLES,
  reports: FINANCE_ROLES,
  contracts: FINANCE_ROLES,
  settings: SETTINGS_ROLES,
  complaints: OPERATIONS_ROLES,
  help: OPERATIONS_ROLES,
  marketplace: MARKETPLACE_ROLES,
  profile: MARKETPLACE_ROLES,
};

export function hasPermission(role, page) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) return false;

  const allowed = PERMISSIONS[page];

  if (!allowed) return true;

  return allowed.map(normalizeRole).includes(normalizedRole);
}
