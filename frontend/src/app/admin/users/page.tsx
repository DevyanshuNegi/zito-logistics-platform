'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneContactField } from '@/components/ui/PhoneContactField';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { buildPhoneContact, normalizePhoneNumber } from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import { compactId, formatDateTime, formatStatus } from '@/lib/format';

type ManagedUser = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
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
  data: ManagedUser[];
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

const roleOptions = [
  'CUSTOMER',
  'CORPORATE',
  'DRIVER',
  'AGENT',
  'TRANSPORTER',
  'COURIER_COMPANY',
  'WAREHOUSE_PARTNER',
  'AGENCY_STAFF',
] as const;
const staffDepartmentOptions = ['OPERATIONS', 'CUSTOMER_CARE', 'ACCOUNTS'] as const;
const staffScopeOptions = ['HEAD_OFFICE', 'AGENCY'] as const;
const organizationRoleOptions = new Set([
  'CORPORATE',
  'AGENT',
  'TRANSPORTER',
  'COURIER_COMPANY',
  'WAREHOUSE_PARTNER',
]);

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    countryOptionCode: DEFAULT_COUNTRY_ISO_CODE,
    phoneNumber: '',
    password: '',
    role: 'AGENCY_STAFF',
    companyName: '',
    agencyId: '',
    staffRole: 'OPERATIONS',
    staffScope: 'HEAD_OFFICE',
  });
  const [creationFeedback, setCreationFeedback] = useState<{
    variant: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const fullNameRef = useRef<HTMLInputElement | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filterRole) params.set('role', filterRole);
      if (filterStatus) params.set('status', filterStatus);

      const usersPath = params.size > 0 ? `/users?${params.toString()}` : '/users';
      const [usersResponse, agenciesResponse] = await Promise.all([
        api.get<UsersResponse>(usersPath),
        api.get<Agency[]>('/agencies'),
      ]);

      setUsers(usersResponse.data);
      setAgencies(agenciesResponse.filter((agency) => agency.status !== 'INACTIVE'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load user management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filterRole, filterStatus]);

  const activeAgencyId = useMemo(() => user?.agencyId ?? null, [user?.agencyId]);
  const selectedCountryOption = useMemo(
    () => findCountryCodeOptionByIsoCode(form.countryOptionCode),
    [form.countryOptionCode],
  );
  const selectedAgencyId =
    form.role === 'AGENCY_STAFF' && form.staffScope === 'AGENCY'
      ? form.agencyId || activeAgencyId || ''
      : '';
  const customerCount = users.filter((managedUser) => managedUser.role === 'CUSTOMER').length;
  const corporateCount = users.filter((managedUser) => managedUser.role === 'CORPORATE').length;
  const driverCount = users.filter((managedUser) => managedUser.role === 'DRIVER').length;
  const agentCount = users.filter((managedUser) => managedUser.role === 'AGENT').length;
  const transporterCount = users.filter((managedUser) => managedUser.role === 'TRANSPORTER').length;
  const courierCount = users.filter((managedUser) => managedUser.role === 'COURIER_COMPANY').length;
  const warehouseCount = users.filter((managedUser) => managedUser.role === 'WAREHOUSE_PARTNER').length;
  const staffCount = users.filter((managedUser) => managedUser.role === 'AGENCY_STAFF').length;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreationFeedback(null);

    try {
      await api.post('/users/internal', {
        fullName: form.fullName,
        email: form.email || undefined,
        phone: buildPhoneContact(
          selectedCountryOption?.dialCode ?? '+254',
          form.phoneNumber,
        ),
        password: form.password,
        role: form.role,
        companyName: organizationRoleOptions.has(form.role) ? form.companyName || undefined : undefined,
        agencyId: form.role === 'AGENCY_STAFF' ? selectedAgencyId || undefined : undefined,
        staffRole: form.role === 'AGENCY_STAFF' ? form.staffRole : undefined,
        staffScope: form.role === 'AGENCY_STAFF' ? form.staffScope : undefined,
      });

      setSuccess('User created successfully.');
      setCreationFeedback({
        variant: 'success',
        title: 'Registration successful',
        message:
          'The user account was created successfully. You can create another account now or continue with the directory below.',
      });
      setForm({
        fullName: '',
        email: '',
        countryOptionCode: DEFAULT_COUNTRY_ISO_CODE,
        phoneNumber: '',
        password: '',
        role: 'AGENCY_STAFF',
        companyName: '',
        agencyId: activeAgencyId ?? '',
        staffRole: 'OPERATIONS',
        staffScope: 'HEAD_OFFICE',
      });
      await loadData();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Unable to create user.';
      setError(message);
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
    setForm({
      fullName: '',
      email: '',
      countryOptionCode: DEFAULT_COUNTRY_ISO_CODE,
      phoneNumber: '',
      password: '',
      role: 'AGENCY_STAFF',
      companyName: '',
      agencyId: activeAgencyId ?? '',
      staffRole: 'OPERATIONS',
      staffScope: 'HEAD_OFFICE',
    });
    window.requestAnimationFrame(() => {
      fullNameRef.current?.focus();
    });
  }

  async function handleStatusChange(targetUser: ManagedUser, nextAction: 'activate' | 'suspend') {
    setBusyId(targetUser.id);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/users/${targetUser.id}/${nextAction}`, {});
      setSuccess(`User ${nextAction}d successfully.`);
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update user status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <StatCard label="Customers" value={String(customerCount)} helper="Customer accounts visible in the active filter." />
        <StatCard label="Corporate" value={String(corporateCount)} helper="Corporate shipper and contract accounts." tone="neutral" />
        <StatCard label="Drivers" value={String(driverCount)} helper="Driver accounts available for dispatch and fleet linkage." tone="info" />
        <StatCard label="Agents" value={String(agentCount)} helper="External sourcing and partner marketplace operators." tone="info" />
        <StatCard label="Transporters" value={String(transporterCount)} helper="Transporter accounts that can manage owned vehicles and drivers." tone="success" />
        <StatCard label="Courier" value={String(courierCount)} helper="Courier company accounts using dispatch and owned-fleet workflows." tone="success" />
        <StatCard label="Warehouse" value={String(warehouseCount)} helper="Warehouse partner accounts using inventory and dispatch operations." tone="warning" />
        <StatCard label="Staff" value={String(staffCount)} helper="Head-office and agency operations, customer care, and accounts users." tone="warning" />
      </div>

      {error ? (
        <Alert title="User management error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="User management updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Create users and teams"
        description="Provision customers, courier and warehouse partners, drivers, and head-office or agency staff from one internal workspace."
      >
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreate}>
          <Input
            label="Full name"
            required
            ref={fullNameRef}
            value={form.fullName}
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <div className="md:col-span-2 xl:col-span-3">
            <PhoneContactField
              required
              countryOptionCode={form.countryOptionCode}
              phoneNumber={form.phoneNumber}
              onCountryChange={(countryOptionCode) =>
                setForm((current) => ({ ...current, countryOptionCode }))
              }
              onPhoneChange={(phoneNumber) =>
                setForm((current) => ({
                  ...current,
                  phoneNumber: normalizePhoneNumber(phoneNumber),
                }))
              }
            />
          </div>
          <Input
            label="Password"
            required
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Role</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value,
                  companyName: organizationRoleOptions.has(event.target.value)
                    ? current.companyName
                    : '',
                  agencyId:
                    event.target.value === 'AGENCY_STAFF'
                      ? current.agencyId || activeAgencyId || ''
                      : '',
                }))
              }
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          {organizationRoleOptions.has(form.role) ? (
            <Input
              label="Company name"
              required
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
            />
          ) : null}

          {form.role === 'AGENCY_STAFF' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Staff scope</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={form.staffScope}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      staffScope: event.target.value,
                      agencyId:
                        event.target.value === 'AGENCY'
                          ? current.agencyId || activeAgencyId || ''
                          : '',
                    }))
                  }
                >
                  {staffScopeOptions.map((option) => (
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
                  value={selectedAgencyId}
                  onChange={(event) => setForm((current) => ({ ...current, agencyId: event.target.value }))}
                  disabled={form.staffScope !== 'AGENCY'}
                >
                  <option value="">
                    {form.staffScope === 'AGENCY' ? 'Select agency' : 'Head office is assigned automatically'}
                  </option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Department</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={form.staffRole}
                  onChange={(event) => setForm((current) => ({ ...current, staffRole: event.target.value }))}
                >
                  {staffDepartmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatStatus(option)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <div className="md:col-span-2 xl:col-span-3 space-y-3">
            {creationFeedback ? (
              <Alert title={creationFeedback.title} variant={creationFeedback.variant}>
                {creationFeedback.message}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={saving} type="submit">
                {saving ? 'Creating user...' : 'Create user'}
              </Button>
              {creationFeedback?.variant === 'success' ? (
                <Button type="button" variant="ghost" onClick={handleCreateAnother}>
                  Create another
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Directory filters" description="Review platform users by role, status, and operational responsibility.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Role</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={filterRole}
              onChange={(event) => setFilterRole(event.target.value)}
            >
              <option value="">All roles</option>
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {['PENDING', 'VERIFIED', 'ACTIVE', 'SUSPENDED', 'REJECTED'].map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title="Users and teams directory"
        description="Customer, driver, transporter, courier, warehouse, and scoped staff accounts appear in one operational directory."
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={users}
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (managedUser) => (
                  <div>
                    <p className="font-semibold text-white">
                      {managedUser.fullName ?? managedUser.companyName ?? 'Unnamed user'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {managedUser.email ?? managedUser.phone ?? compactId(managedUser.id)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (managedUser) => (
                  <div>
                    <p>{formatStatus(managedUser.role)}</p>
                    <p className="text-xs text-slate-400">
                      {managedUser.staffDepartment
                        ? `${formatStatus(managedUser.staffDepartment)} | ${formatStatus(managedUser.staffScope ?? 'AGENCY')} | ${managedUser.staffAgencyName ?? 'No agency'}`
                        : managedUser.companyName ?? 'Direct account'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (managedUser) => formatStatus(managedUser.status),
              },
              {
                key: 'created',
                header: 'Created',
                render: (managedUser) => formatDateTime(managedUser.createdAt),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (managedUser) => (
                  <div className="space-y-2">
                    {managedUser.status !== 'ACTIVE' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === managedUser.id}
                        onClick={() => void handleStatusChange(managedUser, 'activate')}
                      >
                        Activate
                      </Button>
                    ) : null}
                    {managedUser.status === 'ACTIVE' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === managedUser.id}
                        variant="danger"
                        onClick={() => void handleStatusChange(managedUser, 'suspend')}
                      >
                        Suspend
                      </Button>
                    ) : null}
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
