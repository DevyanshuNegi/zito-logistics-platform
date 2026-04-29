'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Contract = {
  id: string;
  customerId: string;
  businessName: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  billingCycle: string;
  paymentTermDays: number;
  status: string;
  expiresAt?: string | null;
  customer?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    role?: string | null;
    status?: string | null;
  } | null;
};

type ContractListResponse = {
  contracts: Contract[];
  total: number;
};

type UserOption = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  role: string;
  status?: string | null;
};

type UsersResponse = {
  data: UserOption[];
  meta: {
    total: number;
  };
};

const BILLING_CYCLES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'] as const;
const CONTRACT_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'SUPERSEDED'] as const;

const EMPTY_FORM = {
  customerId: '',
  businessName: '',
  creditLimit: '',
  billingCycle: 'MONTHLY',
  paymentTermDays: '30',
  status: 'DRAFT',
  expiresAt: '',
};

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const activeCount = useMemo(
    () => contracts.filter((contract) => contract.status === 'ACTIVE').length,
    [contracts],
  );
  const creditLimitTotal = useMemo(
    () => contracts.reduce((sum, contract) => sum + contract.creditLimit, 0),
    [contracts],
  );

  async function loadContracts() {
    setLoading(true);
    setError(null);

    try {
      const [contractsResponse, customersResponse] = await Promise.all([
        api.get<ContractListResponse>(
          statusFilter ? `/contracts?status=${encodeURIComponent(statusFilter)}` : '/contracts',
        ),
        api.get<UsersResponse>('/users?role=CORPORATE&limit=100'),
      ]);
      setContracts(contractsResponse.contracts);
      setCustomers(customersResponse.data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load contracts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, [statusFilter]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(contract: Contract) {
    setEditingId(contract.id);
    setForm({
      customerId: contract.customerId,
      businessName: contract.businessName,
      creditLimit: String(contract.creditLimit),
      billingCycle: contract.billingCycle,
      paymentTermDays: String(contract.paymentTermDays),
      status: contract.status,
      expiresAt: contract.expiresAt ? contract.expiresAt.slice(0, 10) : '',
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      customerId: form.customerId,
      businessName: form.businessName,
      creditLimit: Number(form.creditLimit),
      billingCycle: form.billingCycle,
      paymentTermDays: Number(form.paymentTermDays),
      status: form.status,
      expiresAt: form.expiresAt || undefined,
    };

    try {
      if (editingId) {
        await api.patch(`/contracts/${editingId}`, payload);
        setSuccess('Contract updated.');
      } else {
        await api.post('/contracts', payload);
        setSuccess('Contract created.');
      }

      resetForm();
      await loadContracts();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save contract.');
    } finally {
      setSaving(false);
    }
  }

  async function quickStatusUpdate(contractId: string, status: string) {
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/contracts/${contractId}`, { status });
      setSuccess(`Contract moved to ${formatStatus(status)}.`);
      await loadContracts();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update contract status.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Contracts" value={String(contracts.length)} helper="Contracts returned by the current filters." />
        <StatCard label="Active" value={String(activeCount)} helper="Contracts currently granting credit access." tone="success" />
        <StatCard label="Credit ceiling" value={formatMoney(creditLimitTotal)} helper="Combined approved contract limits." tone="info" />
      </div>

      {error ? (
        <Alert title="Contract workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Contract update applied" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title={editingId ? 'Edit corporate contract' : 'Create corporate contract'}
        description="Phase 3.3 commercial terms control for corporate accounts."
        actions={
          editingId ? (
            <Button variant="ghost" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null
        }
      >
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Corporate customer</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.customerId}
              onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
            >
              <option value="">Select corporate account</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName ?? customer.email ?? customer.id}
                </option>
              ))}
            </select>
          </label>
          <Input label="Business name" required value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} />
          <Input label="Credit limit" required min="0" step="0.01" type="number" value={form.creditLimit} onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value }))} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Billing cycle</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.billingCycle}
              onChange={(event) => setForm((current) => ({ ...current, billingCycle: event.target.value }))}
            >
              {BILLING_CYCLES.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>
          <Input label="Payment terms (days)" required min="1" step="1" type="number" value={form.paymentTermDays} onChange={(event) => setForm((current) => ({ ...current, paymentTermDays: event.target.value }))} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Status</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              {CONTRACT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>
          <Input label="Expires at" type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
          <div className="xl:col-span-4">
            <Button disabled={saving} type="submit">
              {saving ? 'Saving contract...' : editingId ? 'Update contract' : 'Create contract'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Contract register" description="Create, activate, suspend, or revise corporate credit terms." actions={
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Filter</span>
          <select
            className="w-52 rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {CONTRACT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </label>
      }>
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No corporate contracts have been created yet."
            rows={contracts}
            columns={[
              {
                key: 'contract',
                header: 'Contract',
                render: (contract) => (
                  <div>
                    <p className="font-semibold text-white">{contract.businessName}</p>
                    <p className="text-xs text-slate-400">{compactId(contract.id)}</p>
                  </div>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (contract) => (
                  <div className="text-xs text-slate-300">
                    <p>{contract.customer?.fullName ?? contract.customer?.email ?? compactId(contract.customerId)}</p>
                    <p>{formatStatus(contract.customer?.status ?? 'UNKNOWN')}</p>
                  </div>
                ),
              },
              {
                key: 'credit',
                header: 'Credit',
                render: (contract) => (
                  <div className="text-xs text-slate-300">
                    <p>Limit: {formatMoney(contract.creditLimit)}</p>
                    <p>Used: {formatMoney(contract.creditUsed)}</p>
                    <p>Available: {formatMoney(contract.creditAvailable)}</p>
                  </div>
                ),
              },
              {
                key: 'terms',
                header: 'Terms',
                render: (contract) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatStatus(contract.billingCycle)}</p>
                    <p>{contract.paymentTermDays} days</p>
                    <p>Expiry: {formatDateTime(contract.expiresAt)}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (contract) => formatStatus(contract.status),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (contract) => (
                  <div className="space-y-2">
                    <Button className="w-full" variant="secondary" onClick={() => startEdit(contract)}>
                      Edit
                    </Button>
                    {contract.status !== 'ACTIVE' ? (
                      <Button className="w-full" onClick={() => void quickStatusUpdate(contract.id, 'ACTIVE')}>
                        Activate
                      </Button>
                    ) : (
                      <Button className="w-full" variant="danger" onClick={() => void quickStatusUpdate(contract.id, 'SUSPENDED')}>
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
