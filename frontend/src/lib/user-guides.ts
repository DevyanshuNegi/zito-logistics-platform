export type GuideStat = {
  label: string;
  value: string;
  helper: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning';
};

export type GuideRoleCard = {
  title: string;
  summary: string;
  highlights: string[];
};

export type GuideSection = {
  title: string;
  description: string;
  items: string[];
};

export type AppGuide = {
  title: string;
  subtitle: string;
  audienceLabel: string;
  stats: GuideStat[];
  roles: GuideRoleCard[];
  sections: GuideSection[];
};

export const APP_GUIDES: Record<'service' | 'partners' | 'internal', AppGuide> = {
  service: {
    title: 'Zito Logistics User Guide',
    subtitle:
      'Use this guide for the customer and corporate service app. It follows the current login split and workflow rules already implemented in the system.',
    audienceLabel: 'Service Roles',
    stats: [
      {
        label: 'Login path',
        value: '/login',
        helper: 'Individual Customer and Corporate accounts use the Zito Logistics app.',
        tone: 'info',
      },
      {
        label: 'Primary access',
        value: 'Phone OTP',
        helper: 'Phone OTP is the first path. Email users verify OTP, then finish with password.',
        tone: 'success',
      },
      {
        label: 'Core work',
        value: 'Book + Track',
        helper: 'Bookings, payments, invoices, support, and account controls stay in one place.',
        tone: 'warning',
      },
    ],
    roles: [
      {
        title: 'Individual Customer',
        summary: 'Book direct deliveries, manage payments, raise tickets, and track trips.',
        highlights: [
          'Home, Book, Track, Payments, Support, and Account stay inside one service workspace.',
          'Address, stop, and coordinate validation is required before booking confirmation.',
          'Logout now stays inside Account.',
        ],
      },
      {
        title: 'Corporate',
        summary: 'Manage contract-backed bookings, invoices, fleet, and commercial exposure.',
        highlights: [
          'Corporate users work inside Bookings, Contracts, Invoices, and Fleet.',
          'Credit use and invoice exposure should be reviewed before placing more loads.',
          'Corporate login remains person-based, not company-name based.',
        ],
      },
    ],
    sections: [
      {
        title: 'Login and OTP flow',
        description: 'Current public auth flow for service users.',
        items: [
          'Open /login and choose Phone OTP or Email.',
          'Phone login completes after OTP only.',
          'Email login requires OTP first and password second.',
          'If OTP is delayed, use the OTP screen resend control and wait for the cooldown countdown to finish.',
        ],
      },
      {
        title: 'Daily operating flow',
        description: 'What service users should do most often.',
        items: [
          'Create booking from the Book or New Booking flow.',
          'Monitor live or historical bookings from Home and Track.',
          'Use Payments to confirm settlement status and wallet activity.',
          'Raise a ticket from Support when a booking-specific issue needs intervention.',
        ],
      },
      {
        title: 'Rules and controls',
        description: 'Important constraints aligned to the current product rules.',
        items: [
          'Only ACTIVE accounts can log in.',
          'Bookings require valid coordinates; empty latitude/longitude is rejected.',
          'Service users must not see internal-role registration paths.',
          'Company names belong to registration, approval, contracts, and invoices, not login.',
        ],
      },
    ],
  },
  partners: {
    title: 'Zito Partners User Guide',
    subtitle:
      'Use this guide for the supply-side app used by drivers, agents, transporters, courier companies, and warehouse partners.',
    audienceLabel: 'Partner Roles',
    stats: [
      {
        label: 'Login path',
        value: '/partners/login',
        helper: 'All partner roles enter through Zito Partners.',
        tone: 'info',
      },
      {
        label: 'Partner types',
        value: '5 roles',
        helper: 'Driver, Agent, Transporter, Courier Company, and Warehouse Partner.',
        tone: 'success',
      },
      {
        label: 'Ops focus',
        value: 'Execution',
        helper: 'Jobs, scans, fleet, dispatch, warehouse, and invoice visibility are grouped here.',
        tone: 'warning',
      },
    ],
    roles: [
      {
        title: 'Driver',
        summary: 'Run shifts, receive jobs, follow demand zones, and review earnings.',
        highlights: [
          'Dashboard, Jobs, Heatmap, Shift, and Earnings are the main driver screens.',
          'Shift must be active before full job operations are expected.',
          'Phone OTP is the normal sign-in path.',
        ],
      },
      {
        title: 'Transporter',
        summary: 'Represent a B2B transporter organization with fleet and invoice controls.',
        highlights: [
          'Transporter is organization-first, not individual-only.',
          'Registration must capture company legal name plus authorized contact person.',
          'Fleet and invoice screens are the current core transporter tools.',
        ],
      },
      {
        title: 'Agent',
        summary:
          'Operate as a commission-based supply partner that sources vehicles, drivers, and trip capacity.',
        highlights: [
          'Agent is external and separate from Agency Staff or internal agency structures.',
          'Agent registration must capture company legal name plus authorized contact person.',
          'Fleet, Drivers, and Marketplace are the main working areas for agent operations.',
        ],
      },
      {
        title: 'Courier Company',
        summary: 'Operate county-to-county courier execution inside the CFA-backed portal.',
        highlights: [
          'Dispatch, Load Plans, New Movement, Scan Ops, Waybills, Owned Fleet, and Invoices are the main flows.',
          'Capacity source can be Owned Fleet, CFA Network, or Blended.',
          'Scans and waybills remain linked to one booking chain.',
        ],
      },
      {
        title: 'Warehouse Partner',
        summary: 'Run storage, inventory, bins, scan checkpoints, and warehouse exceptions.',
        highlights: [
          'Warehouse Dashboard, Bins, Inventory, Scan, and Loss screens are the core routes.',
          'Warehouse Partner is also organization-first and must register with company identity.',
          'Inventory and scan operations should preserve parcel ownership separation.',
        ],
      },
    ],
    sections: [
      {
        title: 'Login and access',
        description: 'Current partner entry rules.',
        items: [
          'Open /partners/login.',
          'Use OTP first. Email users complete password after OTP when required.',
          'Partner self-service registration is available from /partners/select-role.',
          'Internal roles are intentionally excluded from the partner app.',
        ],
      },
      {
        title: 'Execution workflows',
        description: 'Where each partner role spends time.',
        items: [
          'Drivers use jobs, shift, and earnings screens.',
          'Agents onboard drivers, manage vehicles, and respond to marketplace supply opportunities.',
          'Transporters manage fleet readiness and commercial visibility.',
          'Courier companies run dispatch, scans, waybills, and movement plans.',
          'Warehouse partners manage bins, inventory, scan events, and loss handling.',
        ],
      },
      {
        title: 'Operational rules',
        description: 'Controls that matter in the current partner build.',
        items: [
          'Driver, Agent, Transporter, Courier Company, and Warehouse Partner are separate partner identities.',
          'Agent, Transporter, Courier Company, and Warehouse Partner accounts must represent organizations.',
          'OTP resend stays inside the OTP screen and should be used instead of restarting the full login flow.',
          'Warehouse and courier operations should preserve scan traceability and chain of custody.',
        ],
      },
    ],
  },
  internal: {
    title: 'Zito Internal Ops Guide',
    subtitle:
      'Use this guide for Super Admin, Admin, and Agency Staff. These accounts are provisioned internally and do not use public self-service registration.',
    audienceLabel: 'Internal Roles',
    stats: [
      {
        label: 'Login path',
        value: '/internal/login',
        helper: 'Internal teams use a separate private login surface.',
        tone: 'info',
      },
      {
        label: 'Provisioning',
        value: 'Internal only',
        helper: 'Admin, Super Admin, and Agency Staff accounts are created through internal processes.',
        tone: 'warning',
      },
      {
        label: 'Main focus',
        value: 'Control',
        helper: 'Approvals, monitoring, support, agency operations, finance controls, and investigations.',
        tone: 'success',
      },
    ],
    roles: [
      {
        title: 'Super Admin / Admin',
        summary: 'Run platform-wide control, approval, analytics, and operational governance.',
        highlights: [
          'Admin Command includes alerts, system health, bookings, audit, contracts, fraud, invoices, marketplace, reconciliation, and more.',
          'Admin and Super Admin currently share the same main workspace path.',
          'Only ACTIVE internal accounts can log in.',
        ],
      },
      {
        title: 'Agency Staff',
        summary: 'Manage internal support queues and operational desks.',
        highlights: [
          'Staff Desk currently centers on Support Queue plus linked warehouse operations.',
          'Agency Staff must be provisioned through internal admin flow.',
          'Customer and partner users must not see this path.',
        ],
      },
    ],
    sections: [
      {
        title: 'Access rules',
        description: 'How internal identity should be handled.',
        items: [
          'Open /internal/login for internal accounts.',
          'Do not use customer or partner registration for internal staff creation.',
          'Only ACTIVE internal accounts can move into admin or staff workspaces.',
          'Internal roles should not be exposed on public role pickers.',
        ],
      },
      {
        title: 'Admin operating flow',
        description: 'High-level day-to-day internal control.',
        items: [
          'Review alerts, bookings, and support queues first.',
          'Use audit, fraud, reconciliation, and payments for exceptions and financial control.',
          'Use agencies, fleet, marketplace, and contracts for supply and commercial oversight.',
          'Use staff and warehouse-linked views when local operations require intervention.',
        ],
      },
      {
        title: 'Current implementation notes',
        description: 'What internal teams should know in the current build.',
        items: [
          'Account verification and activation still need a cleaner dedicated admin approval surface.',
          'The route split is implemented, but some internal workflows still depend on API-level control paths.',
          'User guides should be updated whenever PRD authentication, role, or routing rules change.',
        ],
      },
    ],
  },
};
