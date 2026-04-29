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

type ContractPayload = {
  contract: {
    businessName: string;
    creditLimit: number;
    creditUsed: number;
    creditAvailable: number;
    status: string;
  } | null;
};

export default function CorporateBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [contract, setContract] = useState<ContractPayload['contract']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);

    try {
      const [bookingResponse, contractResponse] = await Promise.all([
        api.get<BookingResponse>('/corporate/bookings'),
        api.get<ContractPayload>('/corporate/contracts'),
      ]);
      setBookings(bookingResponse.bookings);
      setTotal(bookingResponse.total);
      setContract(contractResponse.contract);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load corporate bookings.');
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
      await api.post(`/corporate/bookings/${id}/cancel`, { reason });
      await loadBookings();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel booking.');
    }
  }

  const activeCount = bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Bookings" value={String(total)} helper="Corporate bookings owned by this account." />
        <StatCard label="Active" value={String(activeCount)} helper="Trips still consuming operational or credit attention." tone="info" />
        <StatCard label="Credit used" value={formatMoney(contract?.creditUsed ?? 0)} helper="Current contract exposure." />
        <StatCard label="Credit available" value={formatMoney(contract?.creditAvailable ?? 0)} helper="Headroom remaining before booking blocks." tone="success" />
      </div>

      {error ? (
        <Alert title="Corporate booking error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title="Corporate bookings"
        description="Bookings created under your active contract and governed by corporate credit rules."
        actions={
          <Link href="/corporate/bookings/new">
            <Button>New corporate booking</Button>
          </Link>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No corporate bookings exist yet."
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
                    <Link href={`/corporate/bookings/${booking.id}`}>
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
