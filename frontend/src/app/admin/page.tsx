'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Stop = {
  address?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  driverId?: string | null;
  createdAt?: string;
  stops?: Stop[];
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

type LiveDriver = {
  id: string;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  lastLocationAt?: string | null;
  isAvailable?: boolean;
  user?: {
    fullName?: string | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
  } | null;
};

type AlertsDashboard = {
  generatedAt: string;
  summary: {
    totalAlerts: number;
    pendingAlerts: number;
    routedAlerts: number;
    resolvedAlerts: number;
    criticalAlerts: number;
    unroutedAlerts: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    status: string;
    createdAt: string;
    subjectLabel: string;
  }>;
};

type AuditDashboard = {
  summary: {
    pending: number;
    executed: number;
    rejected: number;
    failed: number;
  };
};

type AnalyticsDashboard = {
  generatedAt: string;
  board: {
    billedRevenue: number;
    collectedRevenue: number;
    outstandingRevenue: number;
    averageDriverOnTimeRate: number;
    averageWarehouseUtilization: number;
  };
};

type DirectoryUser = {
  id: string;
  role: string;
};

type UsersResponse = {
  data: DirectoryUser[];
};

type DashboardState = {
  bookings: Booking[];
  liveDrivers: LiveDriver[];
  alerts: AlertsDashboard | null;
  approvals: AuditDashboard | null;
  analytics: AnalyticsDashboard | null;
  directoryUsers: DirectoryUser[];
};

type DriverMarker = {
  id: string;
  label: string;
  plate: string;
  left: number;
  top: number;
  available: boolean;
};

const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'REJECTED']);
const ACTIVE_TRIP_STATUSES = new Set([
  'ASSIGNED',
  'ACCEPTED',
  'ARRIVED',
  'PICKED',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'DELIVERY_VERIFICATION',
  'DELIVERED',
  'PAYMENT_PENDING',
]);

const QUICK_ACTIONS = [
  { href: '/admin/bookings', label: 'Assign trip', icon: 'TR', helper: 'Review new jobs' },
  { href: '/admin/users', label: 'Users & teams', icon: 'US', helper: 'Manage roles and desks' },
  { href: '/admin/workforce', label: 'Workforce', icon: 'WF', helper: 'Head office and agency desks' },
  { href: '/admin/courier-companies', label: 'Courier control', icon: 'CC', helper: 'Courier-company command desk' },
  { href: '/admin/warehouse-partners', label: 'Warehouse control', icon: 'WH', helper: 'Warehouse-partner oversight' },
  { href: '/admin/agencies', label: 'Agencies', icon: 'AG', helper: 'Manage field branches' },
  { href: '/admin/audit', label: 'Approvals', icon: 'AP', helper: 'Pending control queue' },
  { href: '/admin/analytics', label: 'Reports', icon: 'RP', helper: 'Revenue and ops' },
  { href: '/admin/alerts', label: 'Alerts', icon: 'AL', helper: 'Active escalations' },
] as const;

const DEMAND_BUCKETS = [
  { key: 'CREATED', label: 'Created', tone: 'bg-[#1b3f72]' },
  { key: 'SEARCHING', label: 'Searching', tone: 'bg-[#2563eb]' },
  { key: 'APPROVED', label: 'Approved', tone: 'bg-[#0f766e]' },
  { key: 'ASSIGNED', label: 'Assigned', tone: 'bg-[#7c3aed]' },
  { key: 'IN_TRANSIT', label: 'In transit', tone: 'bg-[#16a34a]' },
  { key: 'COMPLETED', label: 'Completed', tone: 'bg-[#e8a020]' },
] as const;

function relativeTime(value?: string | null) {
  if (!value) {
    return 'Pending update';
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(deltaMs) || Number.isNaN(deltaMs)) {
    return 'Pending update';
  }

  const minutes = Math.max(1, Math.round(deltaMs / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function projectDriverMarkers(drivers: LiveDriver[]): DriverMarker[] {
  const located = drivers.filter(
    (driver) =>
      driver.currentLatitude != null &&
      driver.currentLongitude != null &&
      Number.isFinite(driver.currentLatitude) &&
      Number.isFinite(driver.currentLongitude),
  );

  if (located.length === 0) {
    return [];
  }

  const latitudes = located.map((driver) => driver.currentLatitude as number);
  const longitudes = located.map((driver) => driver.currentLongitude as number);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return located.map((driver) => {
    const lng = driver.currentLongitude as number;
    const lat = driver.currentLatitude as number;
    const left =
      maxLng === minLng ? 50 : ((lng - minLng) / (maxLng - minLng)) * 78 + 11;
    const top =
      maxLat === minLat ? 50 : ((maxLat - lat) / (maxLat - minLat)) * 68 + 14;

    return {
      id: driver.id,
      label: driver.user?.fullName ?? 'Unnamed driver',
      plate: driver.vehicle?.plateNumber ?? 'No vehicle',
      available: Boolean(driver.isAvailable),
      left,
      top,
    };
  });
}

function DriverMap({ drivers }: { drivers: LiveDriver[] }) {
  const markers = useMemo(() => projectDriverMarkers(drivers), [drivers]);

  if (markers.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[28px] border border-slate-700/40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.88)_0%,rgba(15,23,42,0.94)_100%)] px-6 text-center text-sm text-slate-300">
        No live driver coordinates yet. Once drivers share location, the operations map will render here.
      </div>
    );
  }

  return (
    <div className="relative h-64 overflow-hidden rounded-[28px] border border-slate-700/40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#081223_100%)]">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(51,65,85,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(51,65,85,0.55)_1px,transparent_1px)] [background-size:2.6rem_2.6rem]" />
      <div className="absolute inset-x-0 top-[30%] h-[3px] bg-cyan-400/25" />
      <div className="absolute inset-x-0 top-[58%] h-[3px] bg-cyan-400/20" />
      <div className="absolute left-[28%] top-0 h-full w-[3px] bg-violet-400/20" />
      <div className="absolute left-[68%] top-0 h-full w-[3px] bg-violet-400/20" />
      {markers.map((marker) => (
        <div
          key={marker.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
        >
          <div
            className={[
              'rounded-full px-3 py-1 text-[11px] font-semibold shadow-[0_12px_24px_rgba(8,18,35,0.4)]',
              marker.available
                ? 'border border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                : 'border border-amber-400/30 bg-amber-500/15 text-amber-100',
            ].join(' ')}
          >
            {marker.label}
          </div>
          <div className="mt-1 rounded-full border border-slate-700/50 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 shadow-sm">
            {marker.plate}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<DashboardState>({
    bookings: [],
    liveDrivers: [],
    alerts: null,
    approvals: null,
    analytics: null,
    directoryUsers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const responses = await Promise.allSettled([
        api.get<BookingResponse>('/admin/bookings?limit=100'),
        api.get<LiveDriver[]>('/tracking/admin/drivers'),
        api.get<AlertsDashboard>('/alerts/dashboard'),
        api.get<AuditDashboard>('/audit/approvals'),
        api.get<AnalyticsDashboard>('/analytics/dashboard?period=monthly'),
        api.get<UsersResponse>('/users?limit=200'),
      ]);

      const nextWarnings: string[] = [];
      const [bookingsResult, driversResult, alertsResult, approvalsResult, analyticsResult, usersResult] = responses;

      if (bookingsResult.status !== 'fulfilled') {
        const message =
          bookingsResult.reason instanceof ApiError
            ? bookingsResult.reason.message
            : 'Unable to load admin bookings.';
        setError(message);
        setLoading(false);
        return;
      }

      if (driversResult.status !== 'fulfilled') {
        nextWarnings.push('Live driver map is unavailable right now.');
      }
      if (alertsResult.status !== 'fulfilled') {
        nextWarnings.push('Alert activity feed could not be refreshed.');
      }
      if (approvalsResult.status !== 'fulfilled') {
        nextWarnings.push('Approval queue totals are currently unavailable.');
      }
      if (analyticsResult.status !== 'fulfilled') {
        nextWarnings.push('Revenue and utilization metrics are showing fallback values.');
      }
      if (usersResult.status !== 'fulfilled') {
        nextWarnings.push('User network counts are temporarily unavailable.');
      }

      setDashboard({
        bookings: bookingsResult.value.bookings,
        liveDrivers: driversResult.status === 'fulfilled' ? driversResult.value : [],
        alerts: alertsResult.status === 'fulfilled' ? alertsResult.value : null,
        approvals: approvalsResult.status === 'fulfilled' ? approvalsResult.value : null,
        analytics: analyticsResult.status === 'fulfilled' ? analyticsResult.value : null,
        directoryUsers: usersResult.status === 'fulfilled' ? usersResult.value.data : [],
      });
      setWarnings(nextWarnings);
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  const activeBookings = useMemo(
    () => dashboard.bookings.filter((booking) => !TERMINAL_BOOKING_STATUSES.has(booking.status)),
    [dashboard.bookings],
  );
  const activeTrips = useMemo(
    () => activeBookings.filter((booking) => ACTIVE_TRIP_STATUSES.has(booking.status)),
    [activeBookings],
  );
  const unassignedBookings = useMemo(
    () => activeBookings.filter((booking) => !booking.driverId).slice(0, 5),
    [activeBookings],
  );
  const bookingBars = useMemo(
    () =>
      DEMAND_BUCKETS.map((bucket) => ({
        ...bucket,
        value: dashboard.bookings.filter((booking) => booking.status === bucket.key).length,
      })),
    [dashboard.bookings],
  );
  const maxBarValue = Math.max(...bookingBars.map((bucket) => bucket.value), 1);
  const activityFeed = dashboard.alerts?.alerts.slice(0, 5) ?? [];
  const generatedAt = dashboard.analytics?.generatedAt ?? dashboard.alerts?.generatedAt ?? null;
  const billedRevenue =
    dashboard.analytics?.board.billedRevenue ??
    dashboard.bookings.reduce((sum, booking) => sum + Number(booking.totalPrice ?? 0), 0);
  const customerCount = dashboard.directoryUsers.filter((user) => user.role === 'CUSTOMER').length;
  const transporterCount = dashboard.directoryUsers.filter((user) => user.role === 'TRANSPORTER').length;
  const courierCount = dashboard.directoryUsers.filter((user) => user.role === 'COURIER_COMPANY').length;
  const warehouseCount = dashboard.directoryUsers.filter((user) => user.role === 'WAREHOUSE_PARTNER').length;
  const staffCount = dashboard.directoryUsers.filter((user) => user.role === 'AGENCY_STAFF').length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          <p className="font-semibold">Dashboard unavailable</p>
          <p className="mt-1 text-rose-100/90">{error}</p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-[24px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          <p className="font-semibold">Partial live data</p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active bookings"
          value={String(activeBookings.length)}
          helper="Trips still moving through the ops queue."
          tone="info"
          surfaceTone="dark"
        />
        <StatCard
          label="Today's GMV"
          value={formatMoney(billedRevenue)}
          helper="Current billed revenue signal from the analytics board."
          tone="success"
          surfaceTone="dark"
        />
        <StatCard
          label="Online drivers"
          value={String(dashboard.liveDrivers.length)}
          helper="Drivers currently sharing live location."
          tone="neutral"
          surfaceTone="dark"
        />
        <StatCard
          label="Pending approvals"
          value={String(dashboard.approvals?.summary.pending ?? 0)}
          helper="High-risk requests still waiting for control review."
          tone="warning"
          surfaceTone="dark"
        />
      </div>

      <SurfaceCard
        tone="dark"
        title="Operations dashboard"
        description="Card-first command center for booking assignment, approvals, and live fleet visibility."
        actions={
          <div className="text-right text-xs text-slate-400">
            <p className="font-semibold text-cyan-200">Generated</p>
            <p>{generatedAt ? formatDateTime(generatedAt) : 'Live now'}</p>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-4 transition hover:border-cyan-400/35 hover:bg-slate-900/90 hover:shadow-[0_18px_36px_rgba(34,211,238,0.08)]"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-sm font-bold tracking-[0.18em] text-cyan-100">
                {action.icon}
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{action.label}</p>
              <p className="mt-1 text-xs text-slate-400">{action.helper}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard
        tone="dark"
        title="Customer and partner network"
        description="Operational visibility into customer, transporter, courier, warehouse, and staff account footprints."
      >
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: 'Customers', value: customerCount, href: '/admin/users?role=CUSTOMER' },
            { label: 'Transporters', value: transporterCount, href: '/admin/users?role=TRANSPORTER' },
            { label: 'Courier companies', value: courierCount, href: '/admin/courier-companies' },
            { label: 'Warehouse partners', value: warehouseCount, href: '/admin/warehouse-partners' },
            { label: 'Staff teams', value: staffCount, href: '/admin/workforce' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-4 transition hover:border-cyan-400/35 hover:bg-slate-900/90"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SurfaceCard
          tone="dark"
          title="Live operations map"
          description="Online driver positions projected into an operations radar view for rapid dispatch decisions."
        >
          <DriverMap drivers={dashboard.liveDrivers} />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Drivers live</p>
              <p className="mt-2 text-xl font-semibold text-white">{dashboard.liveDrivers.length}</p>
            </div>
            <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Available now</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {dashboard.liveDrivers.filter((driver) => driver.isAvailable).length}
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Trips in motion</p>
              <p className="mt-2 text-xl font-semibold text-white">{activeTrips.length}</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard
          tone="dark"
          title="Booking demand pulse"
          description="Operational mix of the current booking queue, highlighted for dispatch prioritization."
        >
          <div className="space-y-4">
            <div className="flex h-52 items-end gap-3 rounded-[24px] border border-slate-700/40 bg-slate-900/60 px-4 pb-4 pt-6">
              {bookingBars.map((bucket) => (
                <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                  <div className="text-[11px] font-semibold text-slate-300">{bucket.value}</div>
                  <div className="flex h-full w-full items-end justify-center">
                    <div
                      className={`w-full max-w-[52px] rounded-t-[18px] ${bucket.tone}`}
                      style={{ height: `${Math.max((bucket.value / maxBarValue) * 100, bucket.value > 0 ? 12 : 4)}%` }}
                    />
                  </div>
                  <div className="text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {bucket.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Collected revenue</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {formatMoney(dashboard.analytics?.board.collectedRevenue ?? 0)}
                </p>
              </div>
              <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Warehouse utilization</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {(dashboard.analytics?.board.averageWarehouseUtilization ?? 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard
          tone="dark"
          title="Attention queue"
          description="Bookings that still need assignment or direct operational intervention."
        >
          <div className="space-y-3">
            {unassignedBookings.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
                No unassigned active bookings right now.
              </div>
            ) : (
              unassignedBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-[20px] border border-slate-700/40 bg-slate-900/60 px-4 py-4 shadow-[0_12px_28px_rgba(8,18,35,0.32)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{booking.reference}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {(booking.stops?.[0]?.address ?? 'Pickup pending')} {'->'} {(booking.stops?.[1]?.address ?? 'Drop-off pending')}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                      {formatStatus(booking.status)}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-400">
                      <span className="font-semibold text-white">{formatMoney(booking.totalPrice)}</span>
                      <span className="ml-3">{relativeTime(booking.createdAt)}</span>
                    </div>
                    <Link
                      href="/admin/bookings"
                      className="rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Assign now
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard
          tone="dark"
          title="Live activity feed"
          description="Real-time operational events sourced from the internal alert queue."
        >
          <div className="space-y-3">
            {activityFeed.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
                No live alert activity is available right now.
              </div>
            ) : (
              activityFeed.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3"
                >
                  <div
                    className={[
                      'mt-1 h-2.5 w-2.5 rounded-full',
                      alert.severity === 'CRITICAL'
                        ? 'bg-[#dc2626]'
                        : alert.severity === 'HIGH'
                          ? 'bg-[#e8a020]'
                          : alert.severity === 'MEDIUM'
                            ? 'bg-[#2563eb]'
                            : 'bg-[#16a34a]',
                    ].join(' ')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{alert.subjectLabel}</p>
                      <span className="text-xs text-slate-400">{relativeTime(alert.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">{formatStatus(alert.type)}</span>
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/80 px-2.5 py-1 text-slate-300">{formatStatus(alert.status)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
