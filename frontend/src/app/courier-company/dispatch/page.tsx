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
import { formatDateTime, formatStatus } from '@/lib/format';

type Booking = {
  id: string;
  reference: string;
  status: string;
  createdAt?: string;
  capacitySource?: string | null;
  serviceType?: string | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
  } | null;
  driver?: {
    user?: {
      fullName?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  _count?: {
    parcels?: number;
    scanEvents?: number;
    waybills?: number;
  } | null;
};

type BookingResponse = {
  bookings: Booking[];
};

export default function CourierCompanyDispatchPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingResponse>('/courier-company/bookings');
      setBookings(response.bookings);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load the courier dispatch board.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const activeBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => !['COMPLETED', 'CANCELLED'].includes(String(booking.status)),
      ),
    [bookings],
  );

  const assignedCount = useMemo(
    () => activeBookings.filter((booking) => Boolean(booking.vehicle?.plateNumber)).length,
    [activeBookings],
  );

  const manifestCount = useMemo(
    () =>
      activeBookings.filter((booking) => Number(booking._count?.waybills ?? 0) > 0).length,
    [activeBookings],
  );

  const scanActiveCount = useMemo(
    () =>
      activeBookings.filter((booking) => Number(booking._count?.scanEvents ?? 0) > 0).length,
    [activeBookings],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active jobs" value={String(activeBookings.length)} helper="Open county-to-county movements still under execution." />
        <StatCard label="Assigned" value={String(assignedCount)} helper="Jobs already mapped to a vehicle." tone="success" />
        <StatCard label="Waybills live" value={String(manifestCount)} helper="Jobs with at least one operational manifest." tone="info" />
        <StatCard label="Scan-active" value={String(scanActiveCount)} helper="Jobs already generating checkpoint activity." tone="warning" />
      </div>

      <Alert title="CFA dispatch board" variant="info">
        This board is for the courier company operations team. Zito acts as the CFA backbone while dispatch, scan, and manifest visibility stay in one portal.
      </Alert>

      {error ? (
        <Alert title="Dispatch board error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Dispatch board"
        description="Review active movement plans, current execution source, assignment state, and operational artifacts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/courier-company/scan">
              <Button variant="secondary">Open scan ops</Button>
            </Link>
            <Link href="/courier-company/waybills">
              <Button variant="secondary">Open waybills</Button>
            </Link>
            <Link href="/courier-company/bookings/new">
              <Button>New movement</Button>
            </Link>
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={activeBookings}
            emptyMessage="No active courier-company movements are waiting for dispatch follow-up."
            columns={[
              {
                key: 'booking',
                header: 'Booking',
                render: (booking) => (
                  <div>
                    <p className="font-semibold text-white">{booking.reference}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(booking.createdAt)}</p>
                  </div>
                ),
              },
              {
                key: 'execution',
                header: 'Execution',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatCourierCapacitySource(booking.capacitySource)}</p>
                    <p>{formatStatus(booking.serviceType ?? 'PTL')}</p>
                  </div>
                ),
              },
              {
                key: 'assignment',
                header: 'Assignment',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>{booking.vehicle?.plateNumber ?? 'Awaiting vehicle'}</p>
                    <p>{booking.driver?.user?.fullName ?? 'Awaiting driver'}</p>
                  </div>
                ),
              },
              {
                key: 'ops',
                header: 'Ops trail',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>Waybills: {booking._count?.waybills ?? 0}</p>
                    <p>Parcels: {booking._count?.parcels ?? 0}</p>
                    <p>Scans: {booking._count?.scanEvents ?? 0}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (booking) => formatStatus(booking.status),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (booking) => (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/courier-company/bookings/${booking.id}`}>
                      <Button variant="secondary">Details</Button>
                    </Link>
                    <Link href="/courier-company/waybills">
                      <Button variant="secondary">Waybills</Button>
                    </Link>
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
