'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneContactField } from '@/components/ui/PhoneContactField';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { buildPhoneContact, normalizePhoneNumber } from '@/lib/auth-login';
import {
  DEFAULT_COUNTRY_ISO_CODE,
  findCountryCodeOptionByIsoCode,
} from '@/lib/country-codes';
import {
  compactId,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatStatus,
} from '@/lib/format';

type ManagedUser = {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  status: string;
  createdAt?: string;
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

type MarketplacePartner = {
  userId: string;
  partnerType: string;
  companyName: string;
  verificationStatus: string;
  serviceAreas: string[];
  commissionRatePct: number;
  serviceFeeFlat: number;
  premiumListing: boolean;
  updatedAt?: string;
  linkedVehicles: Array<{ id: string; plateNumber: string; type: string; status: string }>;
  linkedWarehouses: Array<{ id: string; name: string; code: string; status: string }>;
  user?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    role: string;
    status?: string | null;
  } | null;
};

type MarketplacePartnersResponse = {
  partners: MarketplacePartner[];
  total: number;
};

type Invoice = {
  id: string;
  number: string;
  type: string;
  status: string;
  isLocked: boolean;
  totalAmount: number;
  paidAmount: number;
  dueDate?: string | null;
  approvedAt?: string | null;
  isApprovalRequired: boolean;
  customerId: string;
};

type AdminInvoicesResponse = {
  invoices: Invoice[];
  total: number;
};

type CourierVehicle = {
  id: string;
  plateNumber: string;
  type: string;
  status: string;
  lastGpsAt?: string | null;
  ownerUser?: {
    id?: string | null;
    fullName?: string | null;
    role?: string | null;
  } | null;
  driver?: {
    id?: string | null;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
};

type WarehouseSite = {
  id: string;
  name: string;
  code: string;
  status: string;
  manager?: {
    id?: string | null;
    fullName?: string | null;
  } | null;
  zones?: Array<{ id: string }>;
  _count?: {
    items: number;
  };
};

type PartnerControlDeskProps = {
  accountRole: 'COURIER_COMPANY' | 'WAREHOUSE_PARTNER';
  marketplaceType: 'COURIER_COMPANY' | 'WAREHOUSE';
  title: string;
  description: string;
  accountLabel: string;
  assetSummaryLabel: string;
  assetIdLabel: string;
  secondaryActionHref: string;
  secondaryActionLabel: string;
};

type DirectoryRow = {
  id: string;
  account: ManagedUser | null;
  partner: MarketplacePartner | null;
  invoices: Invoice[];
  outstandingBalance: number;
  approvalQueueCount: number;
  courierVehicles: CourierVehicle[];
  warehouses: WarehouseSite[];
};

const PARTNER_STATUSES = ['APPROVED', 'REJECTED', 'SUSPENDED'] as const;

const EMPTY_ACCOUNT_FORM = {
  fullName: '',
  companyName: '',
  email: '',
  countryOptionCode: DEFAULT_COUNTRY_ISO_CODE,
  phoneNumber: '',
  password: '',
};

const EMPTY_ONBOARDING_FORM = {
  userId: '',
  companyName: '',
  serviceAreas: '',
  assetIds: '',
  commissionRatePct: '12',
  serviceFeeFlat: '0',
  premiumListing: 'false',
};

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sumOutstanding(invoices: Invoice[]) {
  return invoices.reduce(
    (sum, invoice) => sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
    0,
  );
}

export function PartnerControlDesk({
  accountRole,
  marketplaceType,
  title,
  description,
  accountLabel,
  assetSummaryLabel,
  assetIdLabel,
  secondaryActionHref,
  secondaryActionLabel,
}: PartnerControlDeskProps) {
  const isCourierDesk = accountRole === 'COURIER_COMPANY';
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [courierVehicles, setCourierVehicles] = useState<CourierVehicle[]>([]);
  const [warehouseSites, setWarehouseSites] = useState<WarehouseSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountCreationFeedback, setAccountCreationFeedback] = useState<{
    variant: 'success' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const [onboardingForm, setOnboardingForm] = useState(EMPTY_ONBOARDING_FORM);
  const contactRef = useRef<HTMLInputElement | null>(null);

  const loadDesk = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isCourierDesk) {
        const [usersResponse, partnersResponse, invoicesResponse, vehicleResponse] =
          await Promise.all([
            api.get<UsersResponse>(`/users?role=${accountRole}&limit=200`),
            api.get<MarketplacePartnersResponse>(
              `/marketplace/partners?type=${marketplaceType}`,
            ),
            api.get<AdminInvoicesResponse>('/admin/invoices'),
            api.get<CourierVehicle[]>('/fleet'),
          ]);

        setUsers(usersResponse.data);
        setPartners(partnersResponse.partners);
        setInvoices(invoicesResponse.invoices);
        setCourierVehicles(vehicleResponse);
        setWarehouseSites([]);
      } else {
        const [usersResponse, partnersResponse, invoicesResponse, warehouseResponse] =
          await Promise.all([
            api.get<UsersResponse>(`/users?role=${accountRole}&limit=200`),
            api.get<MarketplacePartnersResponse>(
              `/marketplace/partners?type=${marketplaceType}`,
            ),
            api.get<AdminInvoicesResponse>('/admin/invoices'),
            api.get<WarehouseSite[]>('/warehouse'),
          ]);

        setUsers(usersResponse.data);
        setPartners(partnersResponse.partners);
        setInvoices(invoicesResponse.invoices);
        setWarehouseSites(warehouseResponse);
        setCourierVehicles([]);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : `Unable to load ${accountLabel.toLowerCase()} control data.`,
      );
    } finally {
      setLoading(false);
    }
  }, [accountLabel, accountRole, isCourierDesk, marketplaceType]);

  useEffect(() => {
    void loadDesk();
  }, [loadDesk]);

  const activeAccounts = useMemo(
    () => users.filter((user) => user.status === 'ACTIVE'),
    [users],
  );
  const selectedCountryOption = useMemo(
    () => findCountryCodeOptionByIsoCode(accountForm.countryOptionCode),
    [accountForm.countryOptionCode],
  );

  const onboardingAssets = useMemo(() => {
    if (!onboardingForm.userId) {
      return [];
    }

    if (isCourierDesk) {
      return courierVehicles
        .filter((vehicle) => vehicle.ownerUser?.id === onboardingForm.userId)
        .map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.plateNumber} · ${formatStatus(vehicle.status)}`,
        }));
    }

    return warehouseSites
      .filter((warehouse) => warehouse.manager?.id === onboardingForm.userId)
      .map((warehouse) => ({
        id: warehouse.id,
        label: `${warehouse.code} · ${warehouse.name}`,
      }));
  }, [courierVehicles, isCourierDesk, onboardingForm.userId, warehouseSites]);

  const directoryRows = useMemo<DirectoryRow[]>(() => {
    const userMap = new Map(users.map((user) => [user.id, user]));
    const partnerMap = new Map(partners.map((partner) => [partner.userId, partner]));
    const ids = new Set<string>([
      ...users.map((user) => user.id),
      ...partners.map((partner) => partner.userId),
    ]);

    return Array.from(ids)
      .map((id) => {
        const partner = partnerMap.get(id) ?? null;
        const fallbackAccount = partner?.user
          ? {
            id: partner.user.id,
            fullName: partner.user.fullName ?? null,
            companyName: partner.companyName,
            email: partner.user.email ?? null,
            phone: partner.user.phone ?? null,
            role: partner.user.role,
            status: partner.user.status ?? 'UNKNOWN',
          }
          : null;
        const account = userMap.get(id) ?? fallbackAccount;
        const accountInvoices = invoices.filter((invoice) => invoice.customerId === id);
        const ownedCourierVehicles = courierVehicles.filter(
          (vehicle) => vehicle.ownerUser?.id === id,
        );
        const managedWarehouses = warehouseSites.filter(
          (warehouse) => warehouse.manager?.id === id,
        );

        return {
          id,
          account,
          partner,
          invoices: accountInvoices,
          outstandingBalance: sumOutstanding(accountInvoices),
          approvalQueueCount: accountInvoices.filter(
            (invoice) => invoice.isApprovalRequired && !invoice.approvedAt,
          ).length,
          courierVehicles: ownedCourierVehicles,
          warehouses: managedWarehouses,
        };
      })
      .sort((left, right) => {
        const leftName =
          left.account?.companyName ??
          left.partner?.companyName ??
          left.account?.fullName ??
          '';
        const rightName =
          right.account?.companyName ??
          right.partner?.companyName ??
          right.account?.fullName ??
          '';
        return leftName.localeCompare(rightName);
      });
  }, [courierVehicles, invoices, partners, users, warehouseSites]);

  const approvedPartners = directoryRows.filter(
    (row) => row.partner?.verificationStatus === 'APPROVED',
  ).length;
  const pendingPartners = directoryRows.filter(
    (row) => row.partner?.verificationStatus === 'PENDING_REVIEW',
  ).length;
  const dormantAccounts = directoryRows.filter((row) => !row.partner).length;
  const totalAssets = directoryRows.reduce(
    (sum, row) =>
      sum +
      (isCourierDesk ? row.courierVehicles.length : row.warehouses.length),
    0,
  );
  const outstandingBalance = directoryRows.reduce(
    (sum, row) => sum + row.outstandingBalance,
    0,
  );

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAccount(true);
    setError(null);
    setSuccess(null);
    setAccountCreationFeedback(null);

    try {
      await api.post('/users/internal', {
        fullName: accountForm.fullName,
        companyName: accountForm.companyName,
        email: accountForm.email || undefined,
        phone: buildPhoneContact(
          selectedCountryOption?.dialCode ?? '+254',
          accountForm.phoneNumber,
        ),
        password: accountForm.password,
        role: accountRole,
      });

      setAccountForm({ ...EMPTY_ACCOUNT_FORM });
      setSuccess(`${accountLabel} account created successfully.`);
      setAccountCreationFeedback({
        variant: 'success',
        title: 'Registration successful',
        message: `${accountLabel} account was created successfully. You can create another account now or continue with onboarding below.`,
      });
      await loadDesk();
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : `Unable to create ${accountLabel.toLowerCase()} account.`;
      setError(
        message,
      );
      setAccountCreationFeedback({
        variant: 'danger',
        title: 'Registration failed',
        message,
      });
    } finally {
      setSavingAccount(false);
    }
  }

  function handleCreateAnotherAccount() {
    setAccountCreationFeedback(null);
    setAccountForm({ ...EMPTY_ACCOUNT_FORM });
    window.requestAnimationFrame(() => {
      contactRef.current?.focus();
    });
  }

  async function handleOnboardPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPartner(true);
    setError(null);
    setSuccess(null);

    const payload = {
      userId: onboardingForm.userId,
      companyName: onboardingForm.companyName,
      serviceAreas: splitCsv(onboardingForm.serviceAreas),
      commissionRatePct: Number(onboardingForm.commissionRatePct || '0'),
      serviceFeeFlat: Number(onboardingForm.serviceFeeFlat || '0'),
      premiumListing: onboardingForm.premiumListing === 'true',
      ...(isCourierDesk
        ? { vehicleIds: splitCsv(onboardingForm.assetIds) }
        : { warehouseIds: splitCsv(onboardingForm.assetIds) }),
    };

    try {
      if (isCourierDesk) {
        await api.post('/marketplace/partners/courier-company', payload);
      } else {
        await api.post('/marketplace/partners/warehouse', payload);
      }

      setOnboardingForm(EMPTY_ONBOARDING_FORM);
      setSuccess(`${accountLabel} marketplace profile submitted for review.`);
      await loadDesk();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : `Unable to onboard ${accountLabel.toLowerCase()} marketplace profile.`,
      );
    } finally {
      setSavingPartner(false);
    }
  }

  function handleOnboardingUserChange(userId: string) {
    const selectedUser = users.find((user) => user.id === userId);

    setOnboardingForm((current) => ({
      ...current,
      userId,
      companyName:
        selectedUser?.companyName ??
        current.companyName ??
        selectedUser?.fullName ??
        '',
    }));
  }

  async function handleAccountStatus(userId: string, action: 'activate' | 'suspend') {
    setBusyId(`${action}:${userId}`);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/users/${userId}/${action}`, {});
      setSuccess(
        `${accountLabel} account ${action === 'activate' ? 'activated' : 'suspended'}.`,
      );
      await loadDesk();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : `Unable to ${action} ${accountLabel.toLowerCase()} account.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handlePartnerStatus(
    userId: string,
    nextStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
  ) {
    setBusyId(`${nextStatus}:${userId}`);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/marketplace/partners/${userId}/status`, {
        status: nextStatus,
      });
      setSuccess(
        `${accountLabel} marketplace profile moved to ${formatStatus(nextStatus)}.`,
      );
      await loadDesk();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : `Unable to update ${accountLabel.toLowerCase()} marketplace status.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={`${accountLabel} accounts`}
          value={String(directoryRows.length)}
          helper="Provisioned accounts visible to admin and super admin."
          tone="info"
        />
        <StatCard
          label="Active accounts"
          value={String(activeAccounts.length)}
          helper="Accounts currently allowed to sign in."
          tone="success"
        />
        <StatCard
          label="Marketplace approved"
          value={String(approvedPartners)}
          helper="Partner profiles approved for live opportunity flow."
          tone="success"
        />
        <StatCard
          label="Needs attention"
          value={String(pendingPartners + dormantAccounts)}
          helper="Pending review or not yet onboarded into marketplace control."
          tone="warning"
        />
        <StatCard
          label={assetSummaryLabel}
          value={
            isCourierDesk
              ? String(totalAssets)
              : formatMoney(outstandingBalance)
          }
          helper={
            isCourierDesk
              ? 'Owned fleet assets visible from the admin control layer.'
              : 'Open warehouse-partner invoice balance visible to finance and control.'
          }
          tone={isCourierDesk ? 'neutral' : 'warning'}
        />
      </div>

      {error ? (
        <Alert title={`${accountLabel} control error`} variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title={`${accountLabel} control updated`} variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              href="/admin/marketplace"
            >
              Marketplace board
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              href={secondaryActionHref}
            >
              {secondaryActionLabel}
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              href="/admin/invoices"
            >
              Finance view
            </Link>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <SurfaceCard
            className="h-full"
            title={`Create ${accountLabel.toLowerCase()} account`}
            description="Provision the organization account before marketplace review or operational dispatch linkage."
          >
            <form className="grid gap-4" onSubmit={handleCreateAccount}>
              <Input
                label="Authorized contact"
                required
                ref={contactRef}
                value={accountForm.fullName}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
              />
              <Input
                label="Company name"
                required
                value={accountForm.companyName}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
              />
              <Input
                label="Email"
                type="email"
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
              <PhoneContactField
                required
                countryOptionCode={accountForm.countryOptionCode}
                phoneNumber={accountForm.phoneNumber}
                onCountryChange={(countryOptionCode) =>
                  setAccountForm((current) => ({
                    ...current,
                    countryOptionCode,
                  }))
                }
                onPhoneChange={(phoneNumber) =>
                  setAccountForm((current) => ({
                    ...current,
                    phoneNumber: normalizePhoneNumber(phoneNumber),
                  }))
                }
              />
              <Input
                label="Password"
                required
                type="password"
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              {accountCreationFeedback ? (
                <Alert
                  title={accountCreationFeedback.title}
                  variant={accountCreationFeedback.variant}
                >
                  {accountCreationFeedback.message}
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button disabled={savingAccount} type="submit">
                  {savingAccount ? 'Creating account...' : 'Create account'}
                </Button>
                {accountCreationFeedback?.variant === 'success' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCreateAnotherAccount}
                  >
                    Create another
                  </Button>
                ) : null}
              </div>
            </form>
          </SurfaceCard>

          <SurfaceCard
            className="h-full"
            title={`${accountLabel} marketplace onboarding`}
            description="Register coverage, commercial terms, and linked assets from the same control surface used by admin and super admin."
          >
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleOnboardPartner}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Account</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={onboardingForm.userId}
                  onChange={(event) => handleOnboardingUserChange(event.target.value)}
                >
                  <option value="">Select account</option>
                  {activeAccounts.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.companyName ?? user.fullName ?? user.email ?? user.phone ?? user.id}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Company name"
                required
                value={onboardingForm.companyName}
                onChange={(event) =>
                  setOnboardingForm((current) => ({
                    ...current,
                    companyName: event.target.value,
                  }))
                }
              />
              <Input
                label="Service areas"
                help="Comma-separated county, city, or corridor names."
                value={onboardingForm.serviceAreas}
                onChange={(event) =>
                  setOnboardingForm((current) => ({
                    ...current,
                    serviceAreas: event.target.value,
                  }))
                }
              />
              <Input
                label={`${assetIdLabel} IDs`}
                help={
                  isCourierDesk
                    ? 'Comma-separated vehicle IDs. Leave blank if assets will be attached later.'
                    : 'Comma-separated warehouse IDs. Leave blank to use sites already managed by the account.'
                }
                value={onboardingForm.assetIds}
                onChange={(event) =>
                  setOnboardingForm((current) => ({
                    ...current,
                    assetIds: event.target.value,
                  }))
                }
              />
              <Input
                label="Commission %"
                min="0"
                max="100"
                step="0.01"
                type="number"
                value={onboardingForm.commissionRatePct}
                onChange={(event) =>
                  setOnboardingForm((current) => ({
                    ...current,
                    commissionRatePct: event.target.value,
                  }))
                }
              />
              <Input
                label="Service fee (KES)"
                min="0"
                step="0.01"
                type="number"
                value={onboardingForm.serviceFeeFlat}
                onChange={(event) =>
                  setOnboardingForm((current) => ({
                    ...current,
                    serviceFeeFlat: event.target.value,
                  }))
                }
              />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Listing</span>
                <select
                  className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                  value={onboardingForm.premiumListing}
                  onChange={(event) =>
                    setOnboardingForm((current) => ({
                      ...current,
                      premiumListing: event.target.value,
                    }))
                  }
                >
                  <option value="false">Standard</option>
                  <option value="true">Premium</option>
                </select>
              </label>
              <div className="md:col-span-2">
                <div className="rounded-[20px] border border-slate-700/40 bg-slate-950/50 px-4 py-3 text-xs text-slate-300">
                  {onboardingAssets.length === 0 ? (
                    <p>
                      No {assetIdLabel.toLowerCase()} are linked to the selected account yet.
                      You can still submit the marketplace profile and attach assets later.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-semibold text-white">Linked {assetIdLabel.toLowerCase()}</p>
                      <div className="flex flex-wrap gap-2">
                        {onboardingAssets.map((asset) => (
                          <span
                            key={asset.id}
                            className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100"
                          >
                            {asset.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <Button disabled={savingPartner} type="submit">
                  {savingPartner ? 'Submitting profile...' : 'Submit marketplace profile'}
                </Button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      </SurfaceCard>

      <SurfaceCard
        title={`${accountLabel} command register`}
        description="Account status, marketplace posture, linked assets, and finance exposure in one admin and super-admin control desk."
      >
        {loading ? (
          <div className="flex min-h-[16rem] items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <Table
            emptyMessage={`No ${accountLabel.toLowerCase()} accounts are available yet.`}
            rows={directoryRows}
            columns={[
              {
                key: 'account',
                header: 'Account',
                render: (row) => (
                  <div>
                    <p className="font-semibold text-white">
                      {row.account?.companyName ??
                        row.partner?.companyName ??
                        row.account?.fullName ??
                        'Unnamed account'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {row.account?.fullName ?? 'Contact pending'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.account?.email ??
                        row.account?.phone ??
                        row.partner?.user?.email ??
                        compactId(row.id)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'marketplace',
                header: 'Marketplace',
                render: (row) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>
                      {row.partner
                        ? formatStatus(row.partner.verificationStatus)
                        : 'Not onboarded'}
                    </p>
                    <p>
                      Coverage:{' '}
                      {row.partner?.serviceAreas.length
                        ? row.partner.serviceAreas.join(', ')
                        : 'Pending service-area setup'}
                    </p>
                    <p>
                      Commission:{' '}
                      {row.partner
                        ? formatPercent(row.partner.commissionRatePct)
                        : 'Not configured'}
                    </p>
                    <p>
                      {row.partner?.premiumListing
                        ? 'Premium listing enabled'
                        : 'Standard listing'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'operations',
                header: 'Operations',
                render: (row) => {
                  if (isCourierDesk) {
                    const liveTracked = row.courierVehicles.filter(
                      (vehicle) => Boolean(vehicle.lastGpsAt),
                    ).length;
                    return (
                      <div className="space-y-1 text-xs text-slate-300">
                        <p>Vehicles: {row.courierVehicles.length}</p>
                        <p>
                          Driver linked:{' '}
                          {row.courierVehicles.filter((vehicle) => vehicle.driver?.id).length}
                        </p>
                        <p>GPS active: {liveTracked}</p>
                      </div>
                    );
                  }

                  const totalZones = row.warehouses.reduce(
                    (sum, warehouse) => sum + (warehouse.zones?.length ?? 0),
                    0,
                  );
                  const totalItems = row.warehouses.reduce(
                    (sum, warehouse) => sum + (warehouse._count?.items ?? 0),
                    0,
                  );

                  return (
                    <div className="space-y-1 text-xs text-slate-300">
                      <p>Sites: {row.warehouses.length}</p>
                      <p>Zones: {totalZones}</p>
                      <p>Stored items: {totalItems}</p>
                    </div>
                  );
                },
              },
              {
                key: 'finance',
                header: 'Finance',
                render: (row) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>Invoices: {row.invoices.length}</p>
                    <p>Outstanding: {formatMoney(row.outstandingBalance)}</p>
                    <p>Approval queue: {row.approvalQueueCount}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>Account: {formatStatus(row.account?.status ?? 'UNKNOWN')}</p>
                    <p>
                      Profile:{' '}
                      {formatStatus(row.partner?.verificationStatus ?? 'NOT_ONBOARDED')}
                    </p>
                    <p>
                      Updated:{' '}
                      {formatDateTime(row.partner?.updatedAt ?? row.account?.createdAt)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) => (
                  <div className="space-y-2">
                    {row.account?.status !== 'ACTIVE' ? (
                      <Button
                        className="w-full"
                        disabled={busyId === `activate:${row.id}`}
                        onClick={() => void handleAccountStatus(row.id, 'activate')}
                      >
                        Activate account
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={busyId === `suspend:${row.id}`}
                        variant="danger"
                        onClick={() => void handleAccountStatus(row.id, 'suspend')}
                      >
                        Suspend account
                      </Button>
                    )}

                    {row.partner ? (
                      <>
                        {PARTNER_STATUSES.map((status) => (
                          <Button
                            key={`${row.id}:${status}`}
                            className="w-full"
                            disabled={busyId === `${status}:${row.id}`}
                            variant={
                              status === 'SUSPENDED'
                                ? 'danger'
                                : status === 'REJECTED'
                                  ? 'ghost'
                                  : 'secondary'
                            }
                            onClick={() => void handlePartnerStatus(row.id, status)}
                          >
                            {status === 'SUSPENDED'
                              ? 'Suspend profile'
                              : formatStatus(status)}
                          </Button>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Use the onboarding form above to create the marketplace profile.
                      </p>
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
