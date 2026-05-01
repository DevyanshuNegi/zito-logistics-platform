'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatCourierCapacitySource } from '@/lib/courier-capacity';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type BookingStop = {
  address?: string | null;
  stopType?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  createdAt?: string;
  serviceType?: string | null;
  capacitySource?: string | null;
  stops?: BookingStop[];
  _count?: {
    waybills?: number;
    parcels?: number;
    scanEvents?: number;
  } | null;
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

function countStops(stops: BookingStop[] | undefined, allowedTypes: string[]) {
  return (stops ?? []).filter((stop) =>
    allowedTypes.includes(String(stop.stopType ?? '').trim().toUpperCase()),
  ).length;
}

export default function CourierCompanyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(
    () => bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)).length,
    [bookings],
  );
  const multiStopCount = useMemo(
    () => bookings.filter((booking) => (booking.stops?.length ?? 0) > 2).length,
    [bookings],
  );

  async function loadBookings() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingResponse>('/courier-company/bookings');
      setBookings(response.bookings);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load courier-company bookings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  async function cancelBooking(id: string) {
    const reason = window.prompt('Cancellation reason');
    if (!reason) return;

    try {
      await api.post(`/courier-company/bookings/${id}/cancel`, { reason });
      await loadBookings();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel courier-company booking.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Load plans" value={String(total)} helper="Movement plans owned by this courier account." />
        <StatCard label="Active" value={String(activeCount)} helper="County-to-county jobs still in execution or handoff." tone="info" />
        <StatCard label="Multi-stop" value={String(multiStopCount)} helper="Plans using multiple load or unload stops." tone="success" />
      </div>

      <Alert title="Courier-company mode" variant="info">
        This portal gives the courier company an operations workspace while Zito acts as the CFA backbone for county-to-county execution, visibility, and shared network support.
      </Alert>

      {error ? (
        <Alert title="Courier-company booking error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Courier-company bookings"
        description="Track active PTL, courier, and county-to-county movement plans, including multiple loading and unloading stops."
        actions={
          <Link href="/courier-company/bookings/new">
            <Button>New movement</Button>
          </Link>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No courier-company bookings exist yet."
            rows={bookings}
            columns={[
              {
                key: 'reference',
                header: 'Booking',
                render: (booking) => (
                  <div>
                    <p className="font-semibold text-white">{booking.reference}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(booking.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: 'loads',
                header: 'Loads / Unloads',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>Loads: {countStops(booking.stops, ['PICKUP', 'LOAD'])}</p>
                    <p>Unloads: {countStops(booking.stops, ['DELIVERY', 'DROPOFF', 'UNLOAD'])}</p>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: 'Execution',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatCourierCapacitySource(booking.capacitySource)}</p>
                    <p className="text-slate-500">
                      {booking._count?.waybills ?? 0} waybill(s) • {booking._count?.scanEvents ?? 0} scan(s)
                    </p>
                  </div>
                ),
              },
              {
                key: 'service',
                header: 'Service',
                render: (booking) => formatStatus(booking.serviceType ?? 'PTL'),
              },
              {
                key: 'status',
                header: 'Status',
                render: (booking) => formatStatus(booking.status),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (booking) => formatMoney(booking.totalPrice),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (booking) => (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/courier-company/bookings/${booking.id}`}>
                      <Button variant="secondary">Details</Button>
                    </Link>
                    {!['COMPLETED', 'CANCELLED'].includes(booking.status) ? (
                      <Button variant="danger" onClick={() => void cancelBooking(booking.id)}>
                        Cancel
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
