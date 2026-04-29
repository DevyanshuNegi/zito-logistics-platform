'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  createdAt?: string;
  stops?: Array<{ address?: string | null }>;
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

export default function CustomerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingResponse>('/customer/bookings');
      setBookings(response.bookings);
      setTotal(response.total);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load bookings.');
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
      await api.post(`/customer/bookings/${id}/cancel`, { reason });
      await loadBookings();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel booking.');
    }
  }

  const activeCount = bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)).length;
  const completedCount = bookings.filter((booking) => booking.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Bookings" value={String(total)} helper="All customer bookings." />
        <StatCard label="Active" value={String(activeCount)} helper="Trips still in motion or pending." tone="info" />
        <StatCard label="Completed" value={String(completedCount)} helper="Closed trips available for rating." tone="success" />
      </div>

      {error ? (
        <Alert title="Booking workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Your bookings"
        description="Track existing jobs, cancel before completion, or jump into a new booking."
        actions={
          <Link href="/customer/bookings/new">
            <Button>New booking</Button>
          </Link>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
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
                key: 'route',
                header: 'Route',
                render: (booking) =>
                  `${booking.stops?.[0]?.address ?? 'Pickup pending'} → ${booking.stops?.[1]?.address ?? 'Drop-off pending'}`,
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
                    <Link href={`/customer/bookings/${booking.id}`}>
                      <Button variant="secondary">Details</Button>
                    </Link>
                    <Link href={`/customer/tracking/${booking.id}`}>
                      <Button>Track</Button>
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
