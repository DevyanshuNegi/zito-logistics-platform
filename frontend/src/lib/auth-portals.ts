export type PortalKind = 'service' | 'partners' | 'internal' | 'agency';

export type RoleOption = {
  role: string;
  label: string;
  description: string;
};

export const SERVICE_ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'CUSTOMER',
    label: 'Individual Customer',
    description: 'Book trips, pay, track drivers, and raise support tickets.',
  },
  {
    role: 'CORPORATE',
    label: 'Corporate',
    description: 'Book on contract credit, manage invoices, and review commercial terms.',
  },
];

export const PARTNER_ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'DRIVER',
    label: 'Driver',
    description: 'Start shifts, receive jobs, move trips, and review earnings.',
  },
  {
    role: 'AGENT',
    label: 'Agent',
    description:
      'Source vehicles and loads, onboard drivers, and run commission-based supply operations.',
  },
  {
    role: 'TRANSPORTER',
    label: 'Transporter',
    description: 'Run a transporter organization, manage fleet readiness, and coordinate drivers.',
  },
  {
    role: 'COURIER_COMPANY',
    label: 'Courier Company',
    description: 'Run courier operations, owned fleet, and Zito CFA network fulfillment.',
  },
  {
    role: 'WAREHOUSE_PARTNER',
    label: 'Warehouse Partner',
    description: 'Operate warehouse inventory, scanning, bins, and dispatch readiness.',
  },
];

export const INTERNAL_ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'Platform control, approvals, and governance.',
  },
  {
    role: 'ADMIN',
    label: 'Admin',
    description: 'Operational control, approvals, and monitoring.',
  },
  {
    role: 'AGENCY_STAFF',
    label: 'Head Office Staff',
    description: 'Head-office operations, customer care, and accounts teams.',
  },
];

export const AGENCY_ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'AGENCY_STAFF',
    label: 'Agency Staff',
    description: 'Branch and agency operations, support, and finance workflows.',
  },
];

export const ORGANIZATION_ROLES = new Set([
  'AGENT',
  'TRANSPORTER',
  'COURIER_COMPANY',
  'CORPORATE',
  'WAREHOUSE_PARTNER',
]);

export const PORTAL_CONFIG = {
  service: {
    productName: 'Zito Logistics',
    appStoreName: 'Zito Logistics Service App',
    loginPath: '/login',
    selectRolePath: '/select-role',
    registerPath: '/register',
    roleOptions: SERVICE_ROLE_OPTIONS,
    eyebrow: 'Logistics Login',
    title: 'Sign in to Zito Logistics',
    subtitle:
      'For individual customers and corporate shippers. Use phone OTP or email OTP, then finish email sign-in with your password.',
    panelEyebrow: 'Logistics Service',
    panelTitle: 'Book, track, and manage deliveries with Zito Logistics.',
    panelSubtitle:
      'Customers and corporate shippers use this app to create bookings, manage payments, and track fulfillment.',
    registerCta: 'Start service registration',
    switchCta:
      'Driver, agent, transporter, courier company, or warehouse partner? Use Zito Partners.',
    switchHref: '/partners/login',
    guideHref: '/guides/service',
  },
  partners: {
    productName: 'Zito Partners',
    appStoreName: 'Zito Partners App',
    loginPath: '/partners/login',
    selectRolePath: '/partners/select-role',
    registerPath: '/partners/register',
    roleOptions: PARTNER_ROLE_OPTIONS,
    eyebrow: 'Partners Login',
    title: 'Sign in to Zito Partners',
    subtitle:
      'For drivers, agents, transporters, courier companies, and warehouse partners. Use OTP first, then finish email sign-in with your password when needed.',
    panelEyebrow: 'Partners Network',
    panelTitle: 'Run supply-side operations inside Zito Partners.',
    panelSubtitle:
      'Drivers, agents, transporters, courier companies, and warehouse partners use this app for jobs, fleet, warehousing, supply, and partner operations.',
    registerCta: 'Start partner registration',
    switchCta: 'Need the customer or corporate app? Use Zito Logistics.',
    switchHref: '/login',
    guideHref: '/guides/partners',
  },
  internal: {
    productName: 'Zito Internal',
    appStoreName: 'Zito Internal Ops',
    loginPath: '/internal/login',
    selectRolePath: '/internal/login',
    registerPath: '/internal/login',
    roleOptions: INTERNAL_ROLE_OPTIONS,
    eyebrow: 'Internal Access',
    title: 'Sign in to Zito Internal',
    subtitle:
      'For super admin, admin, and head-office staff only. Internal accounts are provisioned separately and are not shown in public customer or partner flows.',
    panelEyebrow: 'Head Office Operations',
    panelTitle: 'Operate approvals, controls, teams, and governance privately.',
    panelSubtitle:
      'This private path is reserved for head-office control, supervision, and internal desks. Public users do not register here.',
    registerCta: '',
    switchCta: 'Agency, branch, or station staff? Use Zito Agency.',
    switchHref: '/agency/login',
    guideHref: '/guides/internal',
  },
  agency: {
    productName: 'Zito Agency',
    appStoreName: 'Zito Agency Desk',
    loginPath: '/agency/login',
    selectRolePath: '/agency/login',
    registerPath: '/agency/login',
    roleOptions: AGENCY_ROLE_OPTIONS,
    eyebrow: 'Agency Access',
    title: 'Sign in to Zito Agency',
    subtitle:
      'For agency, branch, and station staff who handle local operations, support, and accounts workflows.',
    panelEyebrow: 'Agency Operations',
    panelTitle: 'Run branch operations, support desks, and local finance workflows.',
    panelSubtitle:
      'This path is reserved for agency teams provisioned by head office. Public users do not register here.',
    registerCta: '',
    switchCta: 'Head office or admin team? Use Zito Internal.',
    switchHref: '/internal/login',
    guideHref: '/guides/internal',
  },
} as const satisfies Record<
  PortalKind,
  {
    productName: string;
    appStoreName: string;
    loginPath: string;
    selectRolePath: string;
    registerPath: string;
    roleOptions: RoleOption[];
    eyebrow: string;
    title: string;
    subtitle: string;
    panelEyebrow: string;
    panelTitle: string;
    panelSubtitle: string;
    registerCta: string;
    switchCta: string;
    switchHref: string;
    guideHref: string;
  }
>;

export function getPortalConfig(kind: PortalKind) {
  return PORTAL_CONFIG[kind];
}

export function getPortalKindFromPathname(pathname?: string | null): PortalKind {
  const value = pathname ?? '';
  if (value.startsWith('/agency')) {
    return 'agency';
  }
  if (value.startsWith('/partners')) {
    return 'partners';
  }
  if (value.startsWith('/internal')) {
    return 'internal';
  }
  return 'service';
}

export function getPortalKindForRole(
  role?: string | null,
  staffScope?: string | null,
): PortalKind {
  const normalized = (role ?? '').trim().toUpperCase();
  const normalizedStaffScope = (staffScope ?? '').trim().toUpperCase();
  if (SERVICE_ROLE_OPTIONS.some((option) => option.role === normalized)) {
    return 'service';
  }
  if (PARTNER_ROLE_OPTIONS.some((option) => option.role === normalized)) {
    return 'partners';
  }
  if (normalized === 'AGENCY_STAFF' && normalizedStaffScope === 'AGENCY') {
    return 'agency';
  }
  return 'internal';
}

export function resolvePortalRole(
  kind: PortalKind,
  role?: string | null,
) {
  const requested = (role ?? '').trim().toUpperCase();
  const options = getPortalConfig(kind).roleOptions;
  if (options.some((option) => option.role === requested)) {
    return requested;
  }
  return options[0]?.role ?? 'CUSTOMER';
}

export function getGuidePathForRole(role?: string | null, staffScope?: string | null) {
  return getPortalConfig(getPortalKindForRole(role, staffScope)).guideHref;
}
