export function normalizeRole(role?: string | null) {
  return (role ?? '').trim().toUpperCase();
}

export function getRoleHomePath(role?: string | null) {
  switch (normalizeRole(role)) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin/bookings';
    case 'CUSTOMER':
      return '/customer/bookings';
    case 'DRIVER':
      return '/driver/dashboard';
    case 'AGENT':
      return '/agent/dashboard';
    case 'TRANSPORTER':
      return '/transporter/fleet';
    case 'COURIER_COMPANY':
      return '/courier-company/dispatch';
    case 'WAREHOUSE_PARTNER':
      return '/warehouse/dashboard';
    case 'AGENCY_STAFF':
      return '/staff/support';
    case 'CORPORATE':
      return '/corporate/bookings';
    default:
      return '/login';
  }
}

export function hasAnyRole(role: string | null | undefined, allowedRoles: string[]) {
  const normalized = normalizeRole(role);
  return allowedRoles.map(normalizeRole).includes(normalized);
}
