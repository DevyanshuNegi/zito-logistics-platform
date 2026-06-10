'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Filter,
  LineChart as LineChartIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Warehouse,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import { compactId, formatDateTime, formatMoney, formatPercent, formatStatus } from '@/lib/format';

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

type SortKey = 'customer' | 'bookings' | 'value' | 'paid' | 'lastBooking';
type SortDirection = 'asc' | 'desc';

const INITIAL_FILTERS: FilterState = {
  period: 'monthly',
  startDate: '',
  endDate: '',
};

const DASHBOARD_NAV = [
  { label: 'Overview', icon: BarChart3 },
  { label: 'Revenue', icon: CircleDollarSign },
  { label: 'Drivers', icon: Truck },
  { label: 'Warehouses', icon: Warehouse },
  { label: 'Retention', icon: Activity },
];

function getDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getSparklinePoints(values: number[]) {
  const width = 132;
  const height = 42;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getLinePoints(values: number[], width = 720, height = 240) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getBarWidthClass(index: number) {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-2/5', 'w-1/4'];
  return widths[index] ?? 'w-1/5';
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-44 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70"
        />
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  helper,
  sparkline,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: number;
  helper: string;
  sparkline: number[];
  icon: typeof CircleDollarSign;
}) {
  const positive = delta >= 0;

  return (
    <article className="group rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-md shadow-black/20 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-violet-950/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-100">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <span
            className={[
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              positive
                ? 'bg-emerald-400/10 text-emerald-200'
                : 'bg-rose-400/10 text-rose-200',
            ].join(' ')}
          >
            {positive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <p className="mt-2 max-w-[12rem] text-xs leading-5 text-slate-400">{helper}</p>
        </div>

        <svg className="h-12 w-32 shrink-0 overflow-visible" viewBox="0 0 132 42" role="img" aria-label={`${label} trend`}>
          <polyline
            points={getSparklinePoints(sparkline)}
            fill="none"
            stroke="rgb(139 92 246)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>
      </div>
    </article>
  );
}

function GlassPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={['rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-md shadow-black/20', className].join(' ')}>
      {children}
    </section>
  );
}

function RevenueLineChart({ buckets }: { buckets: RevenueBucket[] }) {
  const width = 720;
  const height = 240;
  const billed = buckets.map((bucket) => bucket.billedRevenue);
  const collected = buckets.map((bucket) => bucket.collectedRevenue);
  const outstanding = buckets.map((bucket) => bucket.outstandingRevenue);
  const maxValue = Math.max(...billed, ...collected, ...outstanding, 1);
  const lastBucket = buckets.at(-1);

  return (
    <div className="relative h-[320px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 p-4">
      <div className="absolute right-4 top-4 rounded-xl border border-white/10 bg-slate-900/90 p-3 text-xs shadow-md shadow-black/20">
        <p className="font-medium text-white">{lastBucket?.label ?? 'No period'}</p>
        <p className="mt-1 text-slate-400">Peak scale {formatMoney(maxValue)}</p>
      </div>

      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue line chart">
        {[0, 1, 2, 3].map((line) => {
          const y = 20 + line * 58;
          return (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.14)"
              strokeWidth="1"
            />
          );
        })}
        <polyline
          points={getLinePoints(billed, width, height)}
          fill="none"
          stroke="#8b5cf6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <polyline
          points={getLinePoints(collected, width, height)}
          fill="none"
          stroke="#22d3ee"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <polyline
          points={getLinePoints(outstanding, width, height)}
          fill="none"
          stroke="#f59e0b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
      </svg>

      <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-500" />Billed</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-400" />Collected</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Outstanding</span>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('period', nextFilters.period);
      if (nextFilters.startDate) params.set('startDate', nextFilters.startDate);
      if (nextFilters.endDate) params.set('endDate', nextFilters.endDate);

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

  const revenueBuckets = useMemo(() => dashboard?.revenue.buckets ?? [], [dashboard?.revenue.buckets]);
  const sparkline = revenueBuckets.map((bucket) => bucket.billedRevenue);
  const currentRevenue = revenueBuckets.at(-1)?.billedRevenue ?? dashboard?.board.billedRevenue ?? 0;
  const previousRevenue = revenueBuckets.at(-2)?.billedRevenue ?? 0;
  const currentCollected = revenueBuckets.at(-1)?.collectedRevenue ?? dashboard?.board.collectedRevenue ?? 0;
  const previousCollected = revenueBuckets.at(-2)?.collectedRevenue ?? 0;

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = dashboard?.retention.topCustomers ?? [];
    const searchedRows = query
      ? rows.filter((customer) =>
          [customer.label, customer.role, customer.customerId]
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : rows;

    return [...searchedRows].sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const values: Record<SortKey, [string | number, string | number]> = {
        customer: [left.label, right.label],
        bookings: [left.bookingCount, right.bookingCount],
        value: [left.lifetimeValue, right.lifetimeValue],
        paid: [left.paidValue, right.paidValue],
        lastBooking: [left.lastBookingAt ?? '', right.lastBookingAt ?? ''],
      };
      const [leftValue, rightValue] = values[sortKey];

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
  }, [dashboard?.retention.topCustomers, searchQuery, sortDirection, sortKey]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDashboard();
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('desc');
  }

  return (
    <div className="relative -mx-4 -my-2 min-h-screen overflow-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:-mx-6 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(139,92,246,0.18),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(34,211,238,0.12),transparent_26%)]" />

      <div className="relative mx-auto grid max-w-7xl gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-md shadow-black/20 xl:block">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 text-white shadow-md shadow-violet-950/40">
              <LineChartIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">ZITO Analytics</p>
              <p className="text-xs text-slate-400">Executive signal board</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Analytics sections">
            {DASHBOARD_NAV.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={`#${item.label.toLowerCase()}`}
                  className={[
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition duration-200 ease-out',
                    index === 0
                      ? 'bg-violet-500 text-white shadow-md shadow-violet-950/40'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
              <Sparkles className="h-4 w-4" />
              Live model
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-300">
              Revenue, driver, warehouse, and retention signals are pulled from the current reporting window.
            </p>
          </div>
        </aside>

        <main className="space-y-6">
          <header id="overview" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-violet-100">
                <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_16px_rgba(139,92,246,0.9)]" />
                Linear meets Vercel analytics
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                SaaS operating metrics, tuned for fast decisions.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                A dark, focused command surface for revenue, driver quality, warehouse utilization, and customer retention.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-300 shadow-md shadow-black/20">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Generated</p>
              <p className="mt-2 font-medium text-white">
                {dashboard ? formatDateTime(dashboard.generatedAt) : 'Loading report'}
              </p>
              <p className="mt-1 text-xs text-slate-400">{dashboard?.dateRange.label ?? 'Current window'}</p>
            </div>
          </header>

          <GlassPanel>
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Period</span>
                <select
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
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
                className="rounded-xl"
                value={filters.startDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, startDate: event.target.value }))
                }
              />

              <Input
                label="End date"
                type="date"
                className="rounded-xl"
                value={filters.endDate}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, endDate: event.target.value }))
                }
              />

              <div className="flex items-end">
                <Button className="min-h-11 rounded-xl bg-violet-500 shadow-violet-950/40 hover:bg-violet-400" disabled={loading} type="submit">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {loading ? 'Refreshing' : 'Apply'}
                </Button>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 rounded-xl"
                  onClick={() => {
                    setFilters(INITIAL_FILTERS);
                    void loadDashboard(INITIAL_FILTERS);
                  }}
                >
                  Reset
                </Button>
              </div>
            </form>
          </GlassPanel>

          {error ? (
            <Alert title="Analytics error" variant="danger">
              {error}
            </Alert>
          ) : null}

          {loading && !dashboard ? (
            <DashboardSkeleton />
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
              <MetricCard
                label="Billed revenue"
                value={formatMoney(dashboard?.board.billedRevenue ?? 0)}
                delta={getDelta(currentRevenue, previousRevenue)}
                helper="Invoice value in scope"
                sparkline={sparkline}
                icon={CircleDollarSign}
              />
              <MetricCard
                label="Collected"
                value={formatMoney(dashboard?.board.collectedRevenue ?? 0)}
                delta={getDelta(currentCollected, previousCollected)}
                helper="Settled revenue signal"
                sparkline={revenueBuckets.map((bucket) => bucket.collectedRevenue)}
                icon={CheckCircle2}
              />
              <MetricCard
                label="Driver on-time"
                value={formatPercent(dashboard?.board.averageDriverOnTimeRate ?? 0)}
                delta={dashboard?.board.averageDriverOnTimeRate ?? 0}
                helper="SLA-backed operations"
                sparkline={revenueBuckets.map((_, index) => (dashboard?.board.averageDriverOnTimeRate ?? 0) + index)}
                icon={Truck}
              />
              <MetricCard
                label="Warehouse use"
                value={formatPercent(dashboard?.board.averageWarehouseUtilization ?? 0)}
                delta={dashboard?.board.averageWarehouseUtilization ?? 0}
                helper="Occupied-bin average"
                sparkline={revenueBuckets.map((_, index) => (dashboard?.board.averageWarehouseUtilization ?? 0) + index * 0.5)}
                icon={Warehouse}
              />
            </section>
          )}

          <section id="revenue" className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
            <GlassPanel className="min-h-[420px]">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-200">Revenue</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Revenue trajectory</h2>
                  <p className="mt-1 text-sm text-slate-400">Billed, collected, and outstanding movement by period.</p>
                </div>
                <Button variant="ghost" className="min-h-11 rounded-xl">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              <RevenueLineChart buckets={revenueBuckets} />
            </GlassPanel>

            <GlassPanel>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-200">Distribution</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Service mix</h2>
              <div className="mt-6 space-y-4">
                {(dashboard?.revenue.byService ?? []).slice(0, 5).map((service, index) => {
                  return (
                    <div key={service.bucket}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-200">{formatStatus(service.label)}</span>
                        <span className="text-slate-400">{formatMoney(service.billedRevenue)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-800">
                        <div className={['h-full rounded-full bg-violet-500', getBarWidthClass(index)].join(' ')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          </section>

          <section id="drivers" className="grid gap-6 lg:grid-cols-3">
            <GlassPanel>
              <Truck className="h-5 w-5 text-violet-300" />
              <p className="mt-4 text-3xl font-semibold text-white">{dashboard?.drivers.summary.onlineDrivers ?? 0}</p>
              <p className="mt-1 text-sm text-slate-400">Online drivers</p>
            </GlassPanel>
            <GlassPanel>
              <Activity className="h-5 w-5 text-cyan-300" />
              <p className="mt-4 text-3xl font-semibold text-white">{formatPercent(dashboard?.drivers.summary.averageCompletionRate ?? 0)}</p>
              <p className="mt-1 text-sm text-slate-400">Completion rate</p>
            </GlassPanel>
            <GlassPanel>
              <Warehouse className="h-5 w-5 text-emerald-300" />
              <p className="mt-4 text-3xl font-semibold text-white">{dashboard?.warehouses.summary.totalActiveStorageItems ?? 0}</p>
              <p className="mt-1 text-sm text-slate-400">Active warehouse items</p>
            </GlassPanel>
          </section>

          <GlassPanel className="overflow-hidden" >
            <div id="retention" className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-200">Customers</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Retention table</h2>
                <p className="mt-1 text-sm text-slate-400">Filter and sort customers by engagement, value, and recency.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
                <label className="relative block">
                  <span className="sr-only">Search customers</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
                <Button variant="ghost" className="min-h-11 rounded-xl">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    {[
                      ['Customer', 'customer'],
                      ['Bookings', 'bookings'],
                      ['Lifetime value', 'value'],
                      ['Paid', 'paid'],
                      ['Last booking', 'lastBooking'],
                    ].map(([label, key]) => (
                      <th key={key} className="px-4 py-4 font-medium">
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-left transition hover:text-white"
                          onClick={() => handleSort(key as SortKey)}
                        >
                          {label}
                          {sortKey === key ? (
                            sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredCustomers.length ? (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.customerId} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">{customer.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatStatus(customer.role)} / {compactId(customer.customerId)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {customer.bookingCount}
                          <span className="ml-2 rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                            {customer.repeatCustomer ? 'repeat' : 'new'}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-100">{formatMoney(customer.lifetimeValue)}</td>
                        <td className="px-4 py-4 text-slate-300">{formatMoney(customer.paidValue)}</td>
                        <td className="px-4 py-4 text-slate-400">
                          {customer.lastBookingAt ? formatDateTime(customer.lastBookingAt) : 'No booking date'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center">
                          <CalendarDays className="h-8 w-8 text-violet-300" />
                          <p className="mt-3 font-medium text-white">No customers match this view</p>
                          <p className="mt-1 text-sm text-slate-400">Adjust filters or reset the search query.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </main>
      </div>
    </div>
  );
}
