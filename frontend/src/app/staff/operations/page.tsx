'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatMoney, formatStatus } from '@/lib/format';

type Stop = {
  address?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
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

export default function StaffOperationsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [driverSelection, setDriverSelection] = useState<Record<string, string>>({});
  const [statusSelection, setStatusSelection] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const bookingsPath = filterStatus
        ? `/admin/bookings?status=${encodeURIComponent(filterStatus)}`
        : '/admin/bookings';

      const [bookingResponse, driverResponse] = await Promise.all([
        api.get<BookingResponse>(bookingsPath),
        api.get<Driver[]>('/drivers?available=true'),
      ]);

      setBookings(bookingResponse.bookings);
      setDrivers(driverResponse);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load operations queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filterStatus]);

  const driverMap = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );

  async function assignDriver(bookingId: string) {
    const driverId = driverSelection[bookingId];
    const driver = driverId ? driverMap.get(driverId) : null;

    if (!driverId || !driver?.vehicle?.id) {
      setError('Choose a driver that already has an assigned vehicle.');
      return;
    }

    setBusyId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/bookings/${bookingId}/assign`, {
        driverId,
        vehicleId: driver.vehicle.id,
        note: 'Assigned from staff operations desk',
      });
      setSuccess('Trip assigned successfully.');
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
        note: 'Updated from staff operations desk',
      });
      setSuccess('Trip status updated.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update trip status.');
    } finally {
      setBusyId(null);
    }
  }

  async function requestCancel(bookingId: string) {
    const reason = window.prompt('Cancellation reason');
    if (!reason) return;

    setBusyId(bookingId);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/admin/bookings/${bookingId}/cancel`, { reason });
      setSuccess('Cancellation request submitted for approval.');
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to request cancellation.');
    } finally {
      setBusyId(null);
    }
  }

  const liveTrips = bookings.filter((booking) =>
    ['ACCEPTED', 'ARRIVED', 'PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION'].includes(booking.status),
  ).length;
  const awaitingAssignment = bookings.filter((booking) =>
    ['CREATED', 'SEARCHING', 'APPROVED'].includes(booking.status),
  ).length;
  const availableDrivers = drivers.filter((driver) => driver.isAvailable).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Awaiting assignment" value={String(awaitingAssignment)} helper="Trips still waiting for dispatch action." tone="warning" />
        <StatCard label="Live trips" value={String(liveTrips)} helper="Trips currently active across the operations queue." tone="info" />
        <StatCard label="Available drivers" value={String(availableDrivers)} helper="Drivers ready to be assigned right now." tone="success" />
      </div>

      {error ? (
        <Alert title="Operations workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Operations workflow updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Operations filters" description="Monitor bookings, assign drivers, and keep dispatch moving.">
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

      <SurfaceCard title="Operations queue" description="Dispatch trips, update delivery states, and request audited cancellations when needed.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={bookings}
            columns={[
              {
                key: 'booking',
                header: 'Trip',
                render: (booking) => (
                  <div>
                    <p className="font-semibold text-white">{booking.reference}</p>
                    <p className="text-xs text-slate-400">
                      {(booking.stops?.[0]?.address ?? 'Pickup pending')}
                      {' -> '}
                      {(booking.stops?.[1]?.address ?? 'Drop-off pending')}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (booking) => formatStatus(booking.status),
              },
              {
                key: 'price',
                header: 'Price',
                render: (booking) => formatMoney(booking.totalPrice),
              },
              {
                key: 'assignment',
                header: 'Assignment',
                render: (booking) => (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200">
                      {booking.driver?.user?.fullName ?? 'Unassigned'}
                      {booking.vehicle?.plateNumber ? ` · ${booking.vehicle.plateNumber}` : ''}
                    </p>
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={driverSelection[booking.id] ?? ''}
                      onChange={(event) =>
                        setDriverSelection((current) => ({
                          ...current,
                          [booking.id]: event.target.value,
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
                    <Button className="w-full" disabled={busyId === booking.id} variant="secondary" onClick={() => void assignDriver(booking.id)}>
                      Assign driver
                    </Button>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Status actions',
                render: (booking) => (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={statusSelection[booking.id] ?? ''}
                      onChange={(event) =>
                        setStatusSelection((current) => ({
                          ...current,
                          [booking.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose status</option>
                      {statusOptions.filter(Boolean).map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                    </select>
                    <Button className="w-full" disabled={busyId === booking.id} onClick={() => void updateStatus(booking.id)}>
                      Update status
                    </Button>
                    <Button className="w-full" disabled={busyId === booking.id} variant="danger" onClick={() => void requestCancel(booking.id)}>
                      Request cancel
                    </Button>
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
