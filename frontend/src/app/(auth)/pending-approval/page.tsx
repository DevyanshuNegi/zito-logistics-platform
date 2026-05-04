'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { AuthShell } from '@/components/layout/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { getPortalConfig, getPortalKindForRole } from '@/lib/auth-portals';
import { formatStatus } from '@/lib/format';

const roleGuidance: Record<string, { title: string; checks: string[]; eta: string }> = {
  CUSTOMER: {
    title: 'Customer account pending activation',
    checks: [
      'Registration details are reviewed.',
      'Contact identity is confirmed.',
      'Account access is activated for bookings and payments.',
    ],
    eta: 'Usually a few working hours.',
  },
  DRIVER: {
    title: 'Driver application under review',
    checks: [
      'Driver identity and phone are verified.',
      'Licence and readiness checks are completed.',
      'Shift and trip access opens after activation.',
    ],
    eta: 'Usually 1 to 2 business days.',
  },
  AGENT: {
    title: 'Agent partner profile under review',
    checks: [
      'Company legal identity and authorized contact details are reviewed.',
      'Vehicle supply, driver onboarding, and commission-readiness are validated.',
      'Partner marketplace and fleet access open after activation.',
    ],
    eta: 'Usually 1 to 3 business days.',
  },
  TRANSPORTER: {
    title: 'Transporter company profile under review',
    checks: [
      'Company legal identity and authorized contact details are reviewed.',
      'Fleet setup and assignment readiness are validated.',
      'Operations access opens after approval.',
    ],
    eta: 'Usually 1 to 3 business days.',
  },
  COURIER_COMPANY: {
    title: 'Courier company onboarding under review',
    checks: [
      'Company registration and authorized contact details are reviewed.',
      'Courier operations profile and supporting documents are validated.',
      'CFA portal access opens after activation.',
    ],
    eta: 'Usually 1 to 3 business days.',
  },
  CORPORATE: {
    title: 'Corporate account under review',
    checks: [
      'Company legal identity and authorized contact details are reviewed.',
      'Commercial and billing readiness is confirmed.',
      'Corporate booking and invoice access opens after activation.',
    ],
    eta: 'Usually 1 to 3 business days.',
  },
  WAREHOUSE_PARTNER: {
    title: 'Warehouse partner profile under review',
    checks: [
      'Warehouse company identity and authorized contact details are reviewed.',
      'Scanning, inventory, and dispatch readiness are validated.',
      'Partner operations access opens after activation.',
    ],
    eta: 'Usually 1 to 3 business days.',
  },
  AGENCY_STAFF: {
    title: 'Staff account waiting for approval',
    checks: [
      'Agency linkage is validated.',
      'Staff permissions are configured.',
      'Support and operations access is activated.',
    ],
    eta: 'Usually within 1 business day.',
  },
};

export default function PendingApprovalPage() {
  const { pendingRegistration, clearPending, logout, user } = useAuth();
  const [queryRole, setQueryRole] = useState<string | null>(null);
  const [queryStatus, setQueryStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setQueryRole(params.get('role'));
    setQueryStatus(params.get('status'));
  }, []);

  const role = pendingRegistration?.role ?? user?.role ?? queryRole ?? 'CUSTOMER';
  const status = pendingRegistration?.status ?? queryStatus ?? 'PENDING';
  const name = pendingRegistration?.fullName ?? user?.fullName ?? 'there';
  const companyName = pendingRegistration?.companyName ?? user?.companyName ?? null;
  const guidance = roleGuidance[role] ?? roleGuidance.CUSTOMER;
  const portal = getPortalConfig(getPortalKindForRole(role));

  return (
    <AuthShell
      eyebrow="Pending Approval"
      title={guidance.title}
      subtitle="Non-active accounts stay blocked from sign-in until approval is complete."
      footer={
        <p>
          Need to restart?{' '}
          <Link href={portal.selectRolePath} className="text-cyan-200 hover:text-cyan-100">
            Choose another role
          </Link>
          .
        </p>
      }
    >
      <div className="space-y-4">
        <Alert title={`Hello, ${name}`} variant="info">
          Current status: {formatStatus(status)}.
          {companyName ? ` Company: ${companyName}.` : ''}
        </Alert>

        <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Review checklist</p>
          <div className="mt-4 space-y-3">
            {guidance.checks.map((step) => (
              <div
                key={step}
                className="rounded-2xl border border-slate-700/40 bg-slate-950/55 px-4 py-3 text-sm text-slate-200"
              >
                {step}
              </div>
            ))}
          </div>
        </div>

        <Alert title="Expected timing" variant="success">
          {guidance.eta}
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Link href={portal.loginPath} className="flex-1 min-w-[180px]">
            <Button className="w-full">Back to login</Button>
          </Link>
          <Button
            className="flex-1 min-w-[180px]"
            variant="secondary"
            onClick={() => {
              clearPending();
              logout();
            }}
          >
            Clear pending draft
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
