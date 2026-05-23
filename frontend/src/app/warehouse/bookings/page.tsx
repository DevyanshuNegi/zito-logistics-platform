'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type WarehouseBooking = {
  id: string;
  reference: string;
  status: string;
  storageType: string;
  goodsDescription: string;
  startDate: string;
  endDate: string;
  capacityRequested: number;
  capacityUnit: string;
  totalAmount: number;
  commissionAmount: number;
  partnerNetAmount: number;
  customerNote?: string | null;
  listing?: {
    title: string;
    areaLabel: string;
  } | null;
};

const STATUS_OPTIONS = [
  'ACCEPTED',
  'REJECTED',
  'GOODS_RECEIVED',
  'IN_STORAGE',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
] as const;

export default function WarehouseBookingsPage() {
  const [bookings, setBookings] = useState<WarehouseBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBookings(await api.get<WarehouseBooking[]>('/warehouse/partner/bookings'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load warehouse bookings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateStatus(bookingId: string, status: string) {
    setBusyId(`${bookingId}:${status}`);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/warehouse/partner/bookings/${bookingId}/status`, { status });
      setSuccess(`Booking moved to ${formatStatus(status)}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update booking status.');
    } finally {
      setBusyId(null);
    }
  }

  const requested = bookings.filter((booking) => booking.status === 'REQUESTED').length;
  const completed = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const commission = bookings.reduce((sum, booking) => sum + booking.commissionAmount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Requests" value={String(requested)} helper="New warehouse bookings waiting for action." tone="warning" />
        <StatCard label="Completed" value={String(completed)} helper="Bookings completed by this partner." tone="success" />
        <StatCard label="Zito commission" value={formatMoney(commission, 'KES')} helper="10% partner commission recorded on bookings." tone="info" />
      </div>

      {error ? <Alert title="Warehouse booking issue" variant="danger">{error}</Alert> : null}
      {success ? <Alert title="Warehouse booking updated" variant="success">{success}</Alert> : null}

      <SurfaceCard title="Warehouse bookings" description="Accept customer warehouse bookings, track storage status, and see commission/net payout.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={bookings}
            emptyMessage="No warehouse bookings yet."
            columns={[
              {
                key: 'booking',
                header: 'Booking',
                render: (booking) => (
                  <div>
                    <p className="font-semibold text-white">{booking.reference}</p>
                    <p className="text-xs text-slate-400">{booking.listing?.title ?? 'Warehouse listing'}</p>
                    <p className="text-xs text-slate-500">{booking.goodsDescription}</p>
                  </div>
                ),
              },
              {
                key: 'dates',
                header: 'Dates',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>{formatDateTime(booking.startDate)}</p>
                    <p>{formatDateTime(booking.endDate)}</p>
                  </div>
                ),
              },
              {
                key: 'capacity',
                header: 'Capacity',
                render: (booking) => `${booking.capacityRequested} ${booking.capacityUnit} / ${formatStatus(booking.storageType)}`,
              },
              {
                key: 'money',
                header: 'Commercials',
                render: (booking) => (
                  <div className="text-xs text-slate-300">
                    <p>Total: {formatMoney(booking.totalAmount, 'KES')}</p>
                    <p>Commission: {formatMoney(booking.commissionAmount, 'KES')}</p>
                    <p>Net: {formatMoney(booking.partnerNetAmount, 'KES')}</p>
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
                  <div className="grid gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <Button
                        key={status}
                        className="w-full"
                        disabled={busyId === `${booking.id}:${status}`}
                        variant={status === 'REJECTED' || status === 'CANCELLED' ? 'danger' : 'secondary'}
                        onClick={() => void updateStatus(booking.id, status)}
                      >
                        {formatStatus(status)}
                      </Button>
                    ))}
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
