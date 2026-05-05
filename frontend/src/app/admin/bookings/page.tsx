'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatStatus } from '@/lib/format';

type Stop = {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  tradeMode?: string | null;
  railCorridorCode?: string | null;
  containerReference?: string | null;
  customsStatus?: string | null;
  serviceType?: string | null;
  requiredVehicleType?: string | null;
  stops?: Stop[];
  driverId?: string | null;
  driver?: {
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
  } | null;
  escrow?: {
    status?: string | null;
    amount?: number | null;
  } | null;
  createdAt?: string | null;
};

type Driver = {
  id: string;
  isAvailable?: boolean;
  isOnline?: boolean;
  user?: {
    fullName?: string | null;
  } | null;
  vehicle?: {
    id?: string;
    plateNumber?: string | null;
    type?: string | null;
  } | null;
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

const statusOptions = [
  '',
  'CREATED',
  'SEARCHING',
  'APPROVED',
  'ASSIGNED',
  'ACCEPTED',
  'ARRIVED',
  'PICKED',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
  'DELIVERY_VERIFICATION',
  'DELIVERED',
  'PAYMENT_PENDING',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const;

const liveStatuses = new Set([
  'ACCEPTED',
  'ARRIVED',
  'PICKED',
  'IN_TRANSIT',
  'ARRIVED_AT_DESTINATION',
]);

function isRailOrContainer(booking: Booking) {
  return (
    booking.serviceType === 'RAIL' ||
    booking.requiredVehicleType === 'CONTAINER_20FT' ||
    booking.requiredVehicleType === 'CONTAINER_40FT' ||
    Boolean(booking.tradeMode) ||
    Boolean(booking.railCorridorCode) ||
    Boolean(booking.containerReference)
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [driverSelection, setDriverSelection] = useState<Record<string, string>>({});
  const [statusSelection, setStatusSelection] = useState<Record<string, string>>({});
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const bookingsPath = filterStatus
        ? `/admin/bookings?status=${encodeURIComponent(filterStatus)}&limit=120`
        : '/admin/bookings?limit=120';

      const [bookingResponse, driverResponse] = await Promise.all([
        api.get<BookingResponse>(bookingsPath),
        api.get<Driver[]>('/drivers?available=true'),
      ]);

      setBookings(bookingResponse.bookings);
      setDrivers(driverResponse);
      setSelectedBookingId((current) =>
        current && bookingResponse.bookings.some((booking) => booking.id === current)
          ? current
          : bookingResponse.bookings[0]?.id ?? null,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filterStatus]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  const driverMap = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );

  async function assignDriver(bookingId: string) {
    const driverId = driverSelection[bookingId];
    const driver = driverId ? driverMap.get(driverId) : null;

    if (!driverId || !driver?.vehicle?.id) {
      setError('Pick a driver that already has an assigned vehicle.');
      return;
    }

    setBusyId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/bookings/${bookingId}/assign`, {
        driverId,
        vehicleId: driver.vehicle.id,
        note: 'Assigned from live admin dispatch workspace',
      });
      setSuccess('Driver assignment completed.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to assign driver.');
    } finally {
      setBusyId(null);
    }
  }

  async function updateStatus(bookingId: string) {
    const status = statusSelection[bookingId];
    if (!status) {
      setError('Choose a status before updating.');
      return;
    }

    setBusyId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/bookings/${bookingId}/status`, {
        status,
        note: 'Updated from card-first admin dispatch workspace',
      });
      setSuccess('Booking status updated.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update booking status.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelBooking(bookingId: string) {
    const reason = window.prompt('Cancellation reason');
    if (!reason) return;

    setBusyId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/admin/bookings/${bookingId}/cancel`, {
        reason,
      });
      setSuccess('Booking cancellation approval request submitted.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel booking.');
    } finally {
      setBusyId(null);
    }
  }

  const assignedCount = bookings.filter((booking) => booking.driverId).length;
  const liveCount = bookings.filter((booking) => liveStatuses.has(booking.status)).length;
  const freightCount = bookings.filter(isRailOrContainer).length;

  const selectedPoints =
    selectedBooking?.stops?.slice(0, 2).map((stop, index) => ({
      lat: stop.latitude ?? null,
      lng: stop.longitude ?? null,
      label: index === 0 ? 'Pickup' : 'Drop',
      tone: (index === 0 ? 'pickup' : 'drop') as 'pickup' | 'drop',
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Visible bookings" value={String(bookings.length)} helper="Current filtered dispatch queue." />
        <StatCard label="Assigned" value={String(assignedCount)} helper="Trips already linked to a driver." tone="info" />
        <StatCard label="Live trips" value={String(liveCount)} helper="Trips currently moving through operations." tone="warning" />
        <StatCard label="Rail/container" value={String(freightCount)} helper="Freight bookings that need deeper logistics control." tone="success" />
      </div>

      {error ? (
        <Alert title="Bookings workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Bookings workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Filters"
        description="Dispatch from a live card queue, then jump into trade control when a booking becomes a rail or container move."
        actions={
          <Link
            className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
            href="/admin/rail-container"
          >
            Open rail/container desk
          </Link>
        }
      >
        <label className="block max-w-sm space-y-2">
          <span className="text-sm font-medium text-slate-200">Status</span>
          <select
            className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option || 'ALL'} value={option}>
                {option ? formatStatus(option) : 'All statuses'}
              </option>
            ))}
          </select>
        </label>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SurfaceCard
          title="Dispatch queue"
          description="Review operational jobs as cards instead of tables, with the next action visible on every booking."
        >
          {loading ? (
            <Spinner />
          ) : bookings.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
              No bookings match the current filter.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  className={[
                    'w-full rounded-[22px] border px-4 py-4 text-left transition',
                    selectedBookingId === booking.id
                      ? 'border-cyan-400/45 bg-cyan-500/10 shadow-[0_18px_36px_rgba(34,211,238,0.08)]'
                      : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-500/50',
                  ].join(' ')}
                  onClick={() => setSelectedBookingId(booking.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{booking.reference}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {(booking.stops?.[0]?.address ?? 'Pickup pending')} {'->'}{' '}
                        {(booking.stops?.[1]?.address ?? 'Drop-off pending')}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                      {formatStatus(booking.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                    <span className="rounded-full border border-slate-700/50 bg-slate-950/70 px-2.5 py-1">
                      {booking.driver?.user?.fullName ?? 'Unassigned'}
                    </span>
                    {booking.vehicle?.plateNumber ? (
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/70 px-2.5 py-1">
                        {booking.vehicle.plateNumber}
                      </span>
                    ) : null}
                    {booking.tradeMode ? (
                      <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-violet-100">
                        {formatStatus(booking.tradeMode)}
                      </span>
                    ) : null}
                    {booking.customsStatus ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                        Customs {formatStatus(booking.customsStatus)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{formatMoney(booking.totalPrice)}</p>
                    {isRailOrContainer(booking) ? (
                      <span className="text-xs font-semibold text-cyan-300">Freight control ready</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          title="Live booking control"
          description="Map-first dispatch workspace for assignment, status override, and high-risk cancellation review."
        >
          {!selectedBooking ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
              Choose a booking from the queue to review its route and next controls.
            </div>
          ) : (
            <div className="space-y-5">
              <RoutePreviewMap
                className="h-64 rounded-[24px]"
                points={selectedPoints}
                statusBadge={formatStatus(selectedBooking.status)}
                titleBadge="Live dispatch"
              />

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedBooking.reference}</p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Driver</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedBooking.driver?.user?.fullName ?? 'Unassigned'}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Vehicle</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedBooking.vehicle?.plateNumber ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Escrow</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedBooking.escrow?.status
                      ? formatStatus(selectedBooking.escrow.status)
                      : 'Not started'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Assign driver</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={driverSelection[selectedBooking.id] ?? ''}
                    onChange={(event) =>
                      setDriverSelection((current) => ({
                        ...current,
                        [selectedBooking.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.user?.fullName ?? 'Unnamed driver'}
                        {driver.vehicle?.plateNumber ? ` · ${driver.vehicle.plateNumber}` : ' · No vehicle'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Override status</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={statusSelection[selectedBooking.id] ?? ''}
                    onChange={(event) =>
                      setStatusSelection((current) => ({
                        ...current,
                        [selectedBooking.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose status</option>
                    {statusOptions
                      .filter((option) => option)
                      .map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              {isRailOrContainer(selectedBooking) ? (
                <div className="rounded-[20px] border border-violet-400/25 bg-violet-500/10 px-4 py-4 text-sm text-violet-100">
                  <p className="font-semibold">Freight logistics controls active</p>
                  <p className="mt-1 text-violet-100/90">
                    Corridor: {selectedBooking.railCorridorCode ? formatStatus(selectedBooking.railCorridorCode) : 'Pending'} ·
                    Container: {selectedBooking.containerReference || 'Pending'} ·
                    Customs: {selectedBooking.customsStatus ? formatStatus(selectedBooking.customsStatus) : 'Pending'}
                  </p>
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-cyan-100"
                    href="/admin/rail-container"
                  >
                    Open rail/container desk
                  </Link>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busyId === selectedBooking.id}
                  onClick={() => void assignDriver(selectedBooking.id)}
                >
                  Assign driver
                </Button>
                <Button
                  disabled={busyId === selectedBooking.id}
                  onClick={() => void updateStatus(selectedBooking.id)}
                  variant="secondary"
                >
                  Update status
                </Button>
                <Button
                  disabled={busyId === selectedBooking.id}
                  onClick={() => void cancelBooking(selectedBooking.id)}
                  variant="danger"
                >
                  Request cancel
                </Button>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
