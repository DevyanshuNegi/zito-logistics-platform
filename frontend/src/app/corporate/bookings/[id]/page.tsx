'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { TrackingTimeline } from '@/components/tracking/TrackingTimeline';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  createdAt?: string;
  stops?: Array<{
    sequence?: number;
    address?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  }>;
  driver?: {
    user?: {
      fullName?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
  } | null;
  payments?: Array<{
    id: string;
    reference: string;
    amount: number;
    status: string;
    method: string;
  }>;
  escrow?: {
    status?: string | null;
    amount?: number | null;
  } | null;
  supportTickets?: Array<{
    id: string;
    status: string;
    description?: string | null;
  }>;
};

export default function CorporateBookingDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const bookingId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBooking() {
    if (!bookingId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingDetail>(`/corporate/bookings/${bookingId}`);
      setBooking(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load corporate booking detail.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBooking();
  }, [bookingId]);

  async function cancelBooking() {
    const reason = window.prompt('Cancellation reason');
    if (!reason || !bookingId) return;

    try {
      await api.post(`/corporate/bookings/${bookingId}/cancel`, { reason });
      await loadBooking();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel booking.');
    }
  }

  if (loading) {
    return <Spinner />;
  }

  if (!booking) {
    return (
      <Alert title="Booking not found" variant="danger">
        {error ?? 'No corporate booking data returned.'}
      </Alert>
    );
  }

  const canCancel = !['COMPLETED', 'CANCELLED'].includes(booking.status);
  const timelineStops = (booking.stops ?? []).map((stop) => ({
    sequence: stop.sequence,
    address: stop.address ?? undefined,
    contactName: stop.contactName ?? undefined,
    contactPhone: stop.contactPhone ?? undefined,
  }));

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Corporate booking detail error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title={booking.reference}
        description={`Created ${formatDateTime(booking.createdAt)}.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => window.location.assign('/corporate/invoices')}>
              Open invoices
            </Button>
            {canCancel ? (
              <Button variant="danger" onClick={() => void cancelBooking()}>
                Cancel booking
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</p>
            <p className="mt-3 text-lg font-semibold text-white">{formatStatus(booking.status)}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Amount</p>
            <p className="mt-3 text-lg font-semibold text-white">{formatMoney(booking.totalPrice)}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Driver</p>
            <p className="mt-3 text-lg font-semibold text-white">{booking.driver?.user?.fullName ?? 'Awaiting assignment'}</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Escrow</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {booking.escrow ? `${formatStatus(booking.escrow.status)} · ${formatMoney(booking.escrow.amount)}` : 'Not created yet'}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <TrackingTimeline stops={timelineStops} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SurfaceCard title="Payments" description="Payment activity already tied to this booking.">
          <div className="space-y-3">
            {booking.payments?.length ? (
              booking.payments.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/55 px-4 py-3">
                  <p className="font-semibold text-white">{payment.reference}</p>
                  <p className="text-sm text-slate-300">
                    {payment.method} · {formatStatus(payment.status)} · {formatMoney(payment.amount)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No payment records yet.</p>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Support tickets" description="Recent support items linked to this booking.">
          <div className="space-y-3">
            {booking.supportTickets?.length ? (
              booking.supportTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-slate-700/40 bg-slate-900/55 px-4 py-3">
                  <p className="font-semibold text-white">{formatStatus(ticket.status)}</p>
                  <p className="text-sm text-slate-300">{ticket.description ?? 'No description'}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No support tickets linked to this booking yet.</p>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
