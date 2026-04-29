'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  deliveryOtp?: string | null;
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

export default function CustomerBookingDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const bookingId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  async function loadBooking() {
    if (!bookingId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingDetail>(`/customer/bookings/${bookingId}`);
      setBooking(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load booking detail.');
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
      await api.post(`/customer/bookings/${bookingId}/cancel`, { reason });
      await loadBooking();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel booking.');
    }
  }

  async function submitRating(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingId) return;

    try {
      await api.post(`/customer/bookings/${bookingId}/rate`, {
        rating: Number(rating),
        comment: comment || undefined,
      });
      await loadBooking();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to submit rating.');
    }
  }

  if (loading) {
    return <Spinner />;
  }

  if (!booking) {
    return (
      <Alert title="Booking not found" variant="danger">
        {error ?? 'No booking data returned.'}
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
        <Alert title="Booking detail error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title={booking.reference}
        description={`Created ${formatDateTime(booking.createdAt)}.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/customer/tracking/${booking.id}`}>
              <Button>Track live</Button>
            </Link>
            <Link href="/customer/payments">
              <Button variant="secondary">Open payments</Button>
            </Link>
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
        <SurfaceCard title="Payments" description="Booking-linked payment attempts and their latest status.">
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

      {booking.status === 'COMPLETED' ? (
        <SurfaceCard title="Rate this booking" description="Customer ratings remain open for 48 hours after completion.">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submitRating}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Rating</span>
              <select
                className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              >
                {['5', '4', '3', '2', '1'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Comment"
              textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="md:col-span-2">
              <Button type="submit">Submit rating</Button>
            </div>
          </form>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
