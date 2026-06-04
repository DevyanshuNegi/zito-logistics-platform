'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import {
  compactId,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatStatus,
} from '@/lib/format';

type RevenueBucket = {
  bucket: string;
  label: string;
  invoiceCount: number;
  billedRevenue: number;
  collectedRevenue: number;
  outstandingRevenue: number;
};

type DriverRow = {
  driverId: string;
  userId: string;
  driverName: string;
  phone: string | null;
  rating: number;
  completionRate: number;
  onTimeRate: number;
  acceptanceRate: number;
  assignedTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  noShowEvents: number;
  isOnline: boolean;
  isAvailable: boolean;
  currentShiftStatus: string;
  attendanceStatus: string | null;
  lastShiftStartedAt: string | null;
  lastLocationAt: string | null;
};

type WarehouseRow = {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  agencyId: string;
  agencyName: string;
  configuredCapacity: number;
  totalBins: number;
  occupiedBins: number;
  availableBins: number;
  occupancyPercentage: number;
  activeStorageItems: number;
  averageDwellDays: number;
  turnoverCount: number;
  turnoverRate: number;
};

type RetentionCustomer = {
  customerId: string;
  label: string;
  role: string;
  bookingCount: number;
  completedBookings: number;
  lifetimeValue: number;
  paidValue: number;
  lastBookingAt: string | null;
  repeatCustomer: boolean;
};

type AnalyticsDashboard = {
  generatedAt: string;
  period: 'daily' | 'monthly';
  dateRange: {
    start: string;
    endExclusive: string;
    label: string;
  };
  board: {
    billedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    averageDriverCompletionRate: number;
    averageDriverOnTimeRate: number;
    averageWarehouseUtilization: number;
    repeatRate: number;
    averageClv: number;
    npsScore: number;
  };
  revenue: {
    summary: {
      invoiceCount: number;
      billedRevenue: number;
      collectedRevenue: number;
      outstandingRevenue: number;
      paidInvoices: number;
      overdueInvoices: number;
    };
    buckets: RevenueBucket[];
    byService: RevenueBucket[];
    byAgency: RevenueBucket[];
    notes: string[];
  };
  drivers: {
    summary: {
      totalDrivers: number;
      onlineDrivers: number;
      availableDrivers: number;
      assignedTrips: number;
      completedTrips: number;
      averageRating: number;
      averageCompletionRate: number;
      averageOnTimeRate: number;
      atRiskDrivers: number;
    };
    drivers: DriverRow[];
    notes: string[];
  };
  warehouses: {
    summary: {
      totalWarehouses: number;
      averageUtilization: number;
      averageDwellDays: number;
      totalActiveStorageItems: number;
      totalTurnoverCount: number;
      highOccupancyWarehouses: number;
    };
    warehouses: WarehouseRow[];
    notes: string[];
  };
  retention: {
    summary: {
      registeredCustomers: number;
      activeCustomers: number;
      repeatCustomers: number;
      repeatRate: number;
      averageClv: number;
      totalLifetimeValue: number;
      npsScore: number;
      ratingResponses: number;
      promoters: number;
      passives: number;
      detractors: number;
      atRiskCustomers: number;
    };
    segments: Array<{
      segment: string;
      label: string;
      count: number;
      description: string;
    }>;
    topCustomers: RetentionCustomer[];
    notes: string[];
  };
  promos: {
    readiness: string;
    promoCodes: {
      enabled: boolean;
      totalCodes: number;
      redemptions: number;
      note: string;
    };
    loyaltyPoints: {
      enabled: boolean;
      totalAccounts: number;
      totalPoints: number;
      note: string;
    };
    referrals: {
      enabled: boolean;
      totalReferrals: number;
      convertedReferrals: number;
      note: string;
    };
    supportingSignals: {
      walletAccounts: number;
      walletTransactions: number;
    };
    notes: string[];
  };
  notes: string[];
};

type FilterState = {
  period: 'daily' | 'monthly';
  startDate: string;
  endDate: string;
};

const INITIAL_FILTERS: FilterState = {
  period: 'monthly',
  startDate: '',
  endDate: '',
};

export default function AdminAnalyticsPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('period', nextFilters.period);
      if (nextFilters.startDate) {
        params.set('startDate', nextFilters.startDate);
      }
      if (nextFilters.endDate) {
        params.set('endDate', nextFilters.endDate);
      }

      const response = await api.get<AnalyticsDashboard>(`/analytics/dashboard?${params.toString()}`);
      setDashboard(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load analytics dashboard.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDashboard();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Billed revenue"
          value={dashboard ? formatMoney(dashboard.board.billedRevenue) : formatMoney(0)}
          helper="Invoice value in the selected reporting window."
          tone="success"
        />
        <StatCard
          label="Collected revenue"
          value={dashboard ? formatMoney(dashboard.board.collectedRevenue) : formatMoney(0)}
          helper="Paid amount captured against those invoices."
        />
        <StatCard
          label="Driver on-time"
          value={dashboard ? formatPercent(dashboard.board.averageDriverOnTimeRate) : formatPercent(0)}
          helper="Average on-time percentage using SLA breach signals."
          tone="info"
        />
        <StatCard
          label="Repeat rate"
          value={dashboard ? formatPercent(dashboard.board.repeatRate) : formatPercent(0)}
          helper="Share of active customers with at least two bookings."
          tone="warning"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Average CLV"
          value={dashboard ? formatMoney(dashboard.board.averageClv) : formatMoney(0)}
          helper="Average lifetime billed value across active customers."
        />
        <StatCard
          label="NPS proxy"
          value={dashboard ? String(dashboard.board.npsScore) : '0'}
          helper="Derived from 1-to-5 booking ratings stored in audit logs."
          tone="info"
        />
        <StatCard
          label="Warehouse utilization"
          value={dashboard ? formatPercent(dashboard.board.averageWarehouseUtilization) : formatPercent(0)}
          helper="Average occupied-bin percentage across warehouses."
        />
        <StatCard
          label="Outstanding revenue"
          value={dashboard ? formatMoney(dashboard.board.outstandingRevenue) : formatMoney(0)}
          helper="Open invoice value still awaiting collection."
          tone="warning"
        />
      </div>

      {error ? (
        <Alert title="Analytics error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Analytics controls"
        description="Phase 3.7 analytics for finance, operations, warehouse, and retention. Revenue, driver, and warehouse metrics follow the selected reporting window."
        actions={
          <div className="text-xs text-slate-400">
            Generated: {dashboard ? formatDateTime(dashboard.generatedAt) : 'Loading...'}
          </div>
        }
      >
        <form className="grid gap-4 md:grid-cols-4 xl:grid-cols-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Period</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={filters.period}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period: event.target.value as 'daily' | 'monthly',
                }))
              }
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </label>

          <Input
            label="Start date"
            type="date"
            value={filters.startDate}
            onChange={(event) =>
              setFilters((current) => ({ ...current, startDate: event.target.value }))
            }
          />

          <Input
            label="End date"
            type="date"
            value={filters.endDate}
            onChange={(event) =>
              setFilters((current) => ({ ...current, endDate: event.target.value }))
            }
          />

          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-2">
            <Button disabled={loading} type="submit">
              {loading ? 'Refreshing analytics...' : 'Refresh analytics'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFilters(INITIAL_FILTERS);
                void loadDashboard(INITIAL_FILTERS);
              }}
            >
              Reset window
            </Button>
          </div>
        </form>

        <div className="mt-4 text-sm text-slate-300">
          Scope: <span className="font-medium text-white">{dashboard?.dateRange.label ?? 'Loading...'}</span>
        </div>
      </SurfaceCard>

      {dashboard?.notes?.length ? (
        <div className="space-y-3">
          {dashboard.notes.map((note) => (
            <Alert key={note} title="Implementation note" variant="info">
              {note}
            </Alert>
          ))}
        </div>
      ) : null}

      <SurfaceCard title="Revenue trend" description="Daily or monthly billed, collected, and outstanding revenue across the selected reporting window.">
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No invoice activity found in this reporting window."
            rows={dashboard?.revenue.buckets ?? []}
            columns={[
              {
                key: 'bucket',
                header: 'Period',
                render: (bucket) => (
                  <div>
                    <p className="font-semibold text-white">{bucket.label}</p>
                    <p className="text-xs text-slate-400">{bucket.bucket}</p>
                  </div>
                ),
              },
              {
                key: 'volume',
                header: 'Invoices',
                render: (bucket) => String(bucket.invoiceCount),
              },
              {
                key: 'billed',
                header: 'Billed',
                render: (bucket) => formatMoney(bucket.billedRevenue),
              },
              {
                key: 'collected',
                header: 'Collected',
                render: (bucket) => formatMoney(bucket.collectedRevenue),
              },
              {
                key: 'outstanding',
                header: 'Outstanding',
                render: (bucket) => formatMoney(bucket.outstandingRevenue),
              },
            ]}
          />
        )}
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Revenue by service" description="How billed value is distributed across service lines.">
          {loading && !dashboard ? (
            <Spinner />
          ) : (
            <Table
              emptyMessage="No service-line revenue found."
              rows={dashboard?.revenue.byService ?? []}
              columns={[
                {
                  key: 'service',
                  header: 'Service',
                  render: (row) => formatStatus(row.label),
                },
                {
                  key: 'count',
                  header: 'Invoices',
                  render: (row) => String(row.invoiceCount),
                },
                {
                  key: 'billed',
                  header: 'Billed',
                  render: (row) => formatMoney(row.billedRevenue),
                },
                {
                  key: 'outstanding',
                  header: 'Outstanding',
                  render: (row) => formatMoney(row.outstandingRevenue),
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Revenue by agency" description="Agency share of invoice value in the selected reporting window.">
          {loading && !dashboard ? (
            <Spinner />
          ) : (
            <Table
              emptyMessage="No agency revenue found."
              rows={dashboard?.revenue.byAgency ?? []}
              columns={[
                {
                  key: 'agency',
                  header: 'Agency',
                  render: (row) => (
                    <div>
                      <p className="font-semibold text-white">{row.label}</p>
                      <p className="text-xs text-slate-400">{row.bucket === 'UNASSIGNED' ? 'No agency linked' : compactId(row.bucket)}</p>
                    </div>
                  ),
                },
                {
                  key: 'count',
                  header: 'Invoices',
                  render: (row) => String(row.invoiceCount),
                },
                {
                  key: 'billed',
                  header: 'Billed',
                  render: (row) => formatMoney(row.billedRevenue),
                },
                {
                  key: 'collected',
                  header: 'Collected',
                  render: (row) => formatMoney(row.collectedRevenue),
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard title="Driver performance" description="Completion rate, rating, and SLA-backed on-time performance per driver.">
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No driver activity found in this reporting window."
            rows={dashboard?.drivers.drivers ?? []}
            columns={[
              {
                key: 'driver',
                header: 'Driver',
                render: (driver) => (
                  <div>
                    <p className="font-semibold text-white">{driver.driverName}</p>
                    <p className="text-xs text-slate-400">
                      {driver.phone ?? compactId(driver.userId)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'performance',
                header: 'Performance',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>Completion: {formatPercent(driver.completionRate)}</p>
                    <p>On-time: {formatPercent(driver.onTimeRate)}</p>
                    <p>Rating: {driver.rating.toFixed(2)} / 5</p>
                  </div>
                ),
              },
              {
                key: 'volume',
                header: 'Trips',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>Assigned: {driver.assignedTrips}</p>
                    <p>Completed: {driver.completedTrips}</p>
                    <p>Cancelled: {driver.cancelledTrips}</p>
                  </div>
                ),
              },
              {
                key: 'ops',
                header: 'Ops state',
                render: (driver) => (
                  <div className="text-xs text-slate-300">
                    <p>{driver.isOnline ? 'Online' : 'Offline'} / {driver.isAvailable ? 'Available' : 'Busy'}</p>
                    <p>Shift: {formatStatus(driver.currentShiftStatus)}</p>
                    <p>No-show events: {driver.noShowEvents}</p>
                  </div>
                ),
              },
              {
                key: 'lastShift',
                header: 'Last shift',
                render: (driver) =>
                  driver.lastShiftStartedAt ? formatDateTime(driver.lastShiftStartedAt) : 'No shift record',
              },
            ]}
          />
        )}
      </SurfaceCard>

      <SurfaceCard title="Warehouse utilization" description="Occupied-bin utilization, dwell time, and turnover across warehouses.">
        {loading && !dashboard ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No warehouse records found."
            rows={dashboard?.warehouses.warehouses ?? []}
            columns={[
              {
                key: 'warehouse',
                header: 'Warehouse',
                render: (warehouse) => (
                  <div>
                    <p className="font-semibold text-white">{warehouse.warehouseName}</p>
                    <p className="text-xs text-slate-400">
                      {warehouse.warehouseCode} • {warehouse.agencyName}
                    </p>
                  </div>
                ),
              },
              {
                key: 'utilization',
                header: 'Utilization',
                render: (warehouse) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatPercent(warehouse.occupancyPercentage)}</p>
                    <p>{warehouse.occupiedBins} / {warehouse.totalBins} bins occupied</p>
                    <p>{warehouse.availableBins} bins free</p>
                  </div>
                ),
              },
              {
                key: 'storage',
                header: 'Storage',
                render: (warehouse) => (
                  <div className="text-xs text-slate-300">
                    <p>Configured capacity: {warehouse.configuredCapacity}</p>
                    <p>Active items: {warehouse.activeStorageItems}</p>
                    <p>Avg dwell: {warehouse.averageDwellDays.toFixed(1)} days</p>
                  </div>
                ),
              },
              {
                key: 'turnover',
                header: 'Turnover',
                render: (warehouse) => (
                  <div className="text-xs text-slate-300">
                    <p>Moved out: {warehouse.turnoverCount}</p>
                    <p>Turnover rate: {formatPercent(warehouse.turnoverRate)}</p>
                  </div>
                ),
              },
            ]}
          />
        )}
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Retention snapshot" description="Customer lifetime value, repeat-rate mix, and rating-derived NPS proxy.">
          {loading && !dashboard ? (
            <Spinner />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                {dashboard?.retention.segments.map((segment) => (
                  <StatCard
                    key={segment.segment}
                    label={segment.label}
                    value={String(segment.count)}
                    helper={segment.description}
                  />
                ))}
              </div>

              <Table
                emptyMessage="No active customers found yet."
                rows={dashboard?.retention.topCustomers ?? []}
                columns={[
                  {
                    key: 'customer',
                    header: 'Customer',
                    render: (customer) => (
                      <div>
                        <p className="font-semibold text-white">{customer.label}</p>
                        <p className="text-xs text-slate-400">
                          {formatStatus(customer.role)} • {compactId(customer.customerId)}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: 'engagement',
                    header: 'Engagement',
                    render: (customer) => (
                      <div className="text-xs text-slate-300">
                        <p>Bookings: {customer.bookingCount}</p>
                        <p>Completed: {customer.completedBookings}</p>
                        <p>{customer.repeatCustomer ? 'Repeat customer' : 'Single-booking customer'}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'value',
                    header: 'Lifetime value',
                    render: (customer) => (
                      <div className="text-xs text-slate-300">
                        <p>Billed: {formatMoney(customer.lifetimeValue)}</p>
                        <p>Paid: {formatMoney(customer.paidValue)}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'lastBooking',
                    header: 'Last booking',
                    render: (customer) =>
                      customer.lastBookingAt ? formatDateTime(customer.lastBookingAt) : 'No booking date',
                  },
                ]}
              />
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Promo, loyalty, and referral program" description="Current backend program metrics for promo codes, loyalty points, and referral activity under the existing schema.">
          {loading && !dashboard ? (
            <Spinner />
          ) : (
            <div className="space-y-4">
              <Alert title={`Status: ${formatStatus(dashboard?.promos.readiness ?? 'unknown')}`} variant="info">
                Promo, loyalty, and referral metrics are derived from wallet-transaction and audit-log conventions inside the current schema.
              </Alert>

              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  label="Promo codes"
                  value={String(dashboard?.promos.promoCodes.totalCodes ?? 0)}
                  helper={dashboard?.promos.promoCodes.note ?? 'No promo data available.'}
                />
                <StatCard
                  label="Loyalty accounts"
                  value={String(dashboard?.promos.loyaltyPoints.totalAccounts ?? 0)}
                  helper={dashboard?.promos.loyaltyPoints.note ?? 'No loyalty data available.'}
                />
                <StatCard
                  label="Referrals"
                  value={String(dashboard?.promos.referrals.totalReferrals ?? 0)}
                  helper={dashboard?.promos.referrals.note ?? 'No referral data available.'}
                />
              </div>

              <div className="rounded-3xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Existing wallet substrate</p>
                <p className="mt-2">
                  Wallet accounts: {dashboard?.promos.supportingSignals.walletAccounts ?? 0}
                </p>
                <p>
                  Wallet transactions: {dashboard?.promos.supportingSignals.walletTransactions ?? 0}
                </p>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
