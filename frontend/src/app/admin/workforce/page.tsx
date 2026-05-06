'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneContactField } from '@/components/ui/PhoneContactField';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import {
  buildPhoneContact,
  normalizePhoneNumber,
} from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type StaffUser = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  agencyId?: string | null;
  createdAt?: string;
  staffDepartment?: string | null;
  staffAgencyName?: string | null;
  staffScope?: string | null;
};

type UsersResponse = {
  data: StaffUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
};

type Agency = {
  id: string;
  name: string;
  status?: string | null;
};

const STAFF_DEPARTMENT_OPTIONS = ['OPERATIONS', 'CUSTOMER_CARE', 'ACCOUNTS'] as const;
const STAFF_SCOPE_OPTIONS = ['HEAD_OFFICE', 'AGENCY'] as const;

const EMPTY_STAFF_FORM = {
  fullName: '',
  email: '',
  countryOptionCode: DEFAULT_COUNTRY_ISO_CODE,
  phoneNumber: '',
  password: '',
  staffRole: 'OPERATIONS',
  staffScope: 'HEAD_OFFICE',
  agencyId: '',
};

export default function AdminWorkforcePage() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);
  const [creationFeedback, setCreationFeedback] = useState<{
    variant: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const fullNameRef = useRef<HTMLInputElement | null>(null);

  const selectedCountryOption = useMemo(
    () => findCountryCodeOptionByIsoCode(staffForm.countryOptionCode),
    [staffForm.countryOptionCode],
  );

  async function loadWorkforce() {
    setLoading(true);
    setError(null);

    try {
      const [usersResponse, agenciesResponse] = await Promise.all([
        api.get<UsersResponse>('/users?role=AGENCY_STAFF&limit=200'),
        api.get<Agency[]>('/agencies'),
      ]);

      setStaffUsers(usersResponse.data);
      setAgencies(agenciesResponse.filter((agency) => agency.status !== 'INACTIVE'));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load workforce control data.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkforce();
  }, []);

  const headOfficeCount = useMemo(
    () => staffUsers.filter((user) => user.staffScope === 'HEAD_OFFICE').length,
    [staffUsers],
  );
  const agencyStaffCount = useMemo(
    () => staffUsers.filter((user) => user.staffScope === 'AGENCY').length,
    [staffUsers],
  );
  const operationsCount = useMemo(
    () => staffUsers.filter((user) => user.staffDepartment === 'OPERATIONS').length,
    [staffUsers],
  );
  const customerCareCount = useMemo(
    () => staffUsers.filter((user) => user.staffDepartment === 'CUSTOMER_CARE').length,
    [staffUsers],
  );
  const accountsCount = useMemo(
    () => staffUsers.filter((user) => user.staffDepartment === 'ACCOUNTS').length,
    [staffUsers],
  );

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreationFeedback(null);

    try {
      await api.post('/users/internal', {
        fullName: staffForm.fullName,
        email: staffForm.email || undefined,
        phone: buildPhoneContact(
          selectedCountryOption?.dialCode ?? '+254',
          staffForm.phoneNumber,
        ),
        password: staffForm.password,
        role: 'AGENCY_STAFF',
        staffRole: staffForm.staffRole,
        staffScope: staffForm.staffScope,
        agencyId:
          staffForm.staffScope === 'AGENCY' ? staffForm.agencyId || undefined : undefined,
      });

      setStaffForm({ ...EMPTY_STAFF_FORM });
      setSuccess('Workforce user created successfully.');
      setCreationFeedback({
        variant: 'success',
        title: 'Registration successful',
        message:
          'The workforce user was created successfully. You can create another user now or review the updated directory below.',
      });
      await loadWorkforce();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : 'Unable to create workforce user.';
      setError(
        message,
      );
      setCreationFeedback({
        variant: 'danger',
        title: 'Registration failed',
        message,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCreateAnother() {
    setCreationFeedback(null);
    setStaffForm({ ...EMPTY_STAFF_FORM });
    window.requestAnimationFrame(() => {
      fullNameRef.current?.focus();
    });
  }

  async function handleStatusChange(userId: string, action: 'activate' | 'suspend') {
    setBusyId(`${action}:${userId}`);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/users/${userId}/${action}`, {});
      setSuccess(`Workforce user ${action === 'activate' ? 'activated' : 'suspended'}.`);
      await loadWorkforce();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : `Unable to ${action} workforce user.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Head office"
          value={String(headOfficeCount)}
          helper="Central operations, customer care, and finance desks."
          tone="info"
        />
        <StatCard
          label="Agency staff"
          value={String(agencyStaffCount)}
          helper="Branch and field operators tied to agencies."
          tone="warning"
        />
        <StatCard
          label="Operations desk"
          value={String(operationsCount)}
          helper="Dispatch, booking control, and field coordination."
          tone="success"
        />
        <StatCard
          label="Customer care"
          value={String(customerCareCount)}
          helper="Request-led support and issue resolution teams."
          tone="neutral"
        />
        <StatCard
          label="Accounts"
          value={String(accountsCount)}
          helper="Invoices, payments, refunds, and accounting control."
          tone="success"
        />
      </div>

      {error ? (
        <Alert title="Workforce control error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Workforce control updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Internal workforce command desk"
        description="Head-office teams and agency staff are managed separately here so admin and super admin can delegate operations, customer care, and finance without making every user a platform admin."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              href="/internal/login"
            >
              Head-office login
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              href="/agency/login"
            >
              Agency login
            </Link>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <SurfaceCard
            className="h-full"
            title="Create workforce user"
            description="Provision a head-office or agency desk user with the correct department classification."
          >
            <form className="grid gap-4" onSubmit={handleCreateStaff}>
              <Input
                label="Full name"
                required
                ref={fullNameRef}
                value={staffForm.fullName}
                onChange={(event) =>
                  setStaffForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
              />
              <Input
                label="Email"
                type="email"
                value={staffForm.email}
                onChange={(event) =>
                  setStaffForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
              <PhoneContactField
                required
                countryOptionCode={staffForm.countryOptionCode}
                phoneNumber={staffForm.phoneNumber}
                onCountryChange={(countryOptionCode) =>
                  setStaffForm((current) => ({
                    ...current,
                    countryOptionCode,
                  }))
                }
                onPhoneChange={(phoneNumber) =>
                  setStaffForm((current) => ({
                    ...current,
                    phoneNumber: normalizePhoneNumber(phoneNumber),
                  }))
                }
              />
              <Input
                label="Password"
                required
                type="password"
                value={staffForm.password}
                onChange={(event) =>
                  setStaffForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Scope</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={staffForm.staffScope}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      staffScope: event.target.value,
                      agencyId: event.target.value === 'AGENCY' ? current.agencyId : '',
                    }))
                  }
                >
                  {STAFF_SCOPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Department</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={staffForm.staffRole}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      staffRole: event.target.value,
                    }))
                  }
                >
                  {STAFF_DEPARTMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Agency</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  disabled={staffForm.staffScope !== 'AGENCY'}
                  value={staffForm.staffScope === 'AGENCY' ? staffForm.agencyId : ''}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      agencyId: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    {staffForm.staffScope === 'AGENCY'
                      ? 'Select agency'
                      : 'Head office is assigned automatically'}
                  </option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </label>
              {creationFeedback ? (
                <Alert title={creationFeedback.title} variant={creationFeedback.variant}>
                  {creationFeedback.message}
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button disabled={saving} type="submit">
                  {saving ? 'Creating staff user...' : 'Create staff user'}
                </Button>
                {creationFeedback?.variant === 'success' ? (
                  <Button type="button" variant="ghost" onClick={handleCreateAnother}>
                    Create another
                  </Button>
                ) : null}
              </div>
            </form>
          </SurfaceCard>

          <SurfaceCard
            className="h-full"
            title="Desk split"
            description="Admin and super admin supervise the desks below, while daily execution stays with the right workforce lanes."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[20px] border border-slate-700/40 bg-slate-950/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Head Office
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Centralized operations, customer care, and finance control teams use
                  the internal workspace.
                </p>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <p>Operations: dispatch, booking control, fleet coordination</p>
                  <p>Customer care: request-led support and escalation handling</p>
                  <p>Accounts: invoices, payments, accounting, refunds, approvals</p>
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-700/40 bg-slate-950/50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  Agency
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Branch teams operate through the agency desk and stay tied to a
                  specific agency for local execution.
                </p>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <p>Branch dispatch and field coordination</p>
                  <p>Local driver and warehouse support handoffs</p>
                  <p>Agency-scoped visibility instead of full global control</p>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Workforce directory"
        description="Head-office and agency staff accounts, grouped by department, scope, and readiness status."
      >
        {loading ? (
          <div className="flex min-h-[16rem] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Table
            emptyMessage="No workforce users have been provisioned yet."
            rows={staffUsers}
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (user) => (
                  <div>
                    <p className="font-semibold text-white">
                      {user.fullName ?? 'Unnamed staff user'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {user.email ?? user.phone ?? compactId(user.id)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'scope',
                header: 'Scope',
                render: (user) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>{formatStatus(user.staffScope ?? 'AGENCY')}</p>
                    <p>{user.staffAgencyName ?? 'Head office'}</p>
                  </div>
                ),
              },
              {
                key: 'department',
                header: 'Department',
                render: (user) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>{formatStatus(user.staffDepartment ?? 'OPERATIONS')}</p>
                    <p>{formatStatus(user.role)}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (user) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>{formatStatus(user.status)}</p>
                    <p>Created: {formatDateTime(user.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (user) => (
                  <div className="space-y-2">
                    {user.status !== 'ACTIVE' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === `activate:${user.id}`}
                        onClick={() => void handleStatusChange(user.id, 'activate')}
                      >
                        Activate
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={busyId === `suspend:${user.id}`}
                        variant="danger"
                        onClick={() => void handleStatusChange(user.id, 'suspend')}
                      >
                        Suspend
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
