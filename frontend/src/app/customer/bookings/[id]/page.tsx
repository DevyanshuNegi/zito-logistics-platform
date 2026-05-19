'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  CircleDollarSign,
  Headset,
  LocateFixed,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { CustomerAiAssistant } from '@/components/support/CustomerAiAssistant';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
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
  tradeMode?: string | null;
  railCorridorCode?: string | null;
  originNode?: string | null;
  destinationNode?: string | null;
  containerReference?: string | null;
  billOfLadingNumber?: string | null;
  idfNumber?: string | null;
  pacReady?: boolean | null;
  customsStatus?: string | null;
  icmsStatus?: string | null;
  stops?: Array<{
    sequence?: number;
    address?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
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
  freightMilestones?: Array<{
    id: string;
    title: string;
    nodeLabel?: string | null;
    status: string;
    blockedReason?: string | null;
    note?: string | null;
    completedAt?: string | null;
  }>;
};

function statusClassName(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'CANCELLED') return 'bg-rose-100 text-rose-700';
  if (normalized === 'IN_TRANSIT' || normalized === 'ASSIGNED' || normalized === 'PICKED_UP') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-amber-100 text-amber-700';
}

function formatLogisticsValue(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Pending';
}

function formatCustomerBookingAmount(totalPrice: number) {
  return totalPrice > 0 ? formatMoney(totalPrice) : 'Rate under review';
}

const bookingDetailAiQuickActions = [
  {
    label: 'Explain this booking',
    message: 'Explain this booking status, route, and what should happen next for the customer.',
  },
  {
    label: 'Payment help',
    message: 'Help me understand the payment and invoice side of this booking.',
  },
  {
    label: 'Support help',
    message: 'I need the clearest support path for this booking.',
  },
  {
    label: 'After delivery',
    message: 'What should I do after delivery for this booking, including payment, proof, or rating?',
  },
] as const;

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
        <Alert title="Booking detail issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#e9f4ff_0%,#f5f9ff_48%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {booking.reference}
              </span>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(booking.status)}`}
              >
                {formatStatus(booking.status)}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              Booking detail built around route, status, and next action.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Created {formatDateTime(booking.createdAt)}. Track the live route, review payment state, and keep support access close without digging through tables.
            </p>
          </div>

            <div className="flex flex-wrap gap-3">
              <Link href={`/customer/tracking/${booking.id}`}>
                <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
                  <LocateFixed className="mr-2 h-4 w-4" />
                  Track live
                </Button>
              </Link>
              <Link href="/customer/bookings/new">
                <Button
                  variant="secondary"
                  className="rounded-[16px] bg-white px-4 py-3 text-slate-800 shadow-none hover:bg-slate-100"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Re-book
                </Button>
              </Link>
              <Link href="/customer/payments">
                <Button
                  variant="secondary"
                className="rounded-[16px] bg-slate-100 px-4 py-3 text-slate-800 shadow-none hover:bg-slate-200"
              >
                Payments
              </Button>
            </Link>
            {canCancel ? (
              <Button
                variant="danger"
                className="rounded-[16px] bg-rose-500 px-4 py-3 text-white shadow-none hover:bg-rose-600"
                onClick={() => void cancelBooking()}
              >
                Cancel booking
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white/94 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <RoutePreviewMap
          className="h-[260px]"
          titleBadge="Booking route"
          statusBadge={formatStatus(booking.status)}
          points={[
            {
              label: 'Pickup',
              tone: 'pickup',
              lat: booking.stops?.[0]?.latitude ?? null,
              lng: booking.stops?.[0]?.longitude ?? null,
            },
            {
              label: 'Drop',
              tone: 'drop',
              lat: booking.stops?.[1]?.latitude ?? null,
              lng: booking.stops?.[1]?.longitude ?? null,
            },
          ]}
        />

        <div className="-mt-5 rounded-t-[24px] bg-white px-5 pb-5 pt-4 shadow-[0_-8px_22px_rgba(15,23,42,0.06)]">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#cbd5e1]" />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[18px] bg-[#f8fbff] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Pickup
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {booking.stops?.[0]?.address ?? 'Pickup pending'}
              </p>
            </div>
            <div className="rounded-[18px] bg-[#f8fbff] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Drop-off
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {booking.stops?.[1]?.address ?? 'Drop pending'}
              </p>
            </div>
            <div className="rounded-[18px] bg-[#f8fbff] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
                Delivery OTP
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1a1a2e]">
                {booking.deliveryOtp ?? 'Available later'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Amount',
            value: formatCustomerBookingAmount(booking.totalPrice),
            helper:
              booking.totalPrice > 0
                ? 'Customer-visible quote total.'
                : 'Final rate will appear here after admin or marketplace review.',
          },
          {
            label: 'Driver',
            value: booking.driver?.user?.fullName ?? 'Awaiting assignment',
            helper: booking.driver?.user?.phone ?? 'Driver contact appears after assignment.',
          },
          {
            label: 'Vehicle',
            value: booking.vehicle?.plateNumber ?? 'Vehicle pending',
            helper: booking.vehicle?.type ?? 'Vehicle type appears after assignment.',
          },
          {
            label: 'Escrow',
            value: booking.escrow ? formatStatus(booking.escrow.status ?? 'PENDING') : 'Not created',
            helper: booking.escrow ? formatMoney(booking.escrow.amount ?? 0) : 'Escrow record unavailable.',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[28px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-700">Route summary</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Human-readable route instead of raw booking data
            </h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Pickup</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {booking.stops?.[0]?.address ?? 'Pickup pending'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.stops?.[0]?.contactName ?? 'Contact pending'}
                  {booking.stops?.[0]?.contactPhone ? ` · ${booking.stops[0].contactPhone}` : ''}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Drop-off</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {booking.stops?.[1]?.address ?? 'Drop pending'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.stops?.[1]?.contactName ?? 'Receiver pending'}
                  {booking.stops?.[1]?.contactPhone ? ` · ${booking.stops[1].contactPhone}` : ''}
                </p>
              </div>
            </div>
          </div>

          <TrackingTimeline stops={timelineStops} />

          {(booking.tradeMode ||
            booking.railCorridorCode ||
            booking.originNode ||
            booking.destinationNode ||
            booking.containerReference ||
            booking.billOfLadingNumber ||
            booking.idfNumber) ? (
            <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-sky-700">
                Rail and container control
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Corridor and customs readiness
              </h2>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Trade mode</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatLogisticsValue(booking.tradeMode)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Rail corridor</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {formatLogisticsValue(booking.railCorridorCode)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Origin node</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {booking.originNode ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Destination node</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {booking.destinationNode ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Container reference</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {booking.containerReference ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Bill of lading</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {booking.billOfLadingNumber ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">IDF number</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {booking.idfNumber ?? 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Compliance state</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    Customs {formatLogisticsValue(booking.customsStatus)} / iCMS {formatLogisticsValue(booking.icmsStatus)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.pacReady ? 'PAC ready' : 'PAC pending'}
                  </p>
                </div>
              </div>

              {booking.freightMilestones?.length ? (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Freight handoff timeline
                  </p>
                  <div className="mt-4 space-y-3">
                    {booking.freightMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="rounded-[20px] border border-slate-200 bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{milestone.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {milestone.nodeLabel ?? 'Node pending'}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(milestone.status)}`}>
                            {formatStatus(milestone.status)}
                          </span>
                        </div>
                        {milestone.note ? (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {milestone.note}
                          </p>
                        ) : null}
                        {milestone.blockedReason ? (
                          <p className="mt-2 text-sm text-rose-600">
                            Blocked: {milestone.blockedReason}
                          </p>
                        ) : null}
                        {milestone.completedAt ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Completed {formatDateTime(milestone.completedAt)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <CustomerAiAssistant
            compact
            screenContext="CUSTOMER_BOOKING_DETAIL"
            bookings={[{ id: booking.id, reference: booking.reference }]}
            defaultBookingId={booking.id}
            title="Need help with this booking?"
            description="Ask about status, payment, support, or what happens next for this specific booking."
            quickActions={bookingDetailAiQuickActions}
            placeholder="Example: What happens next for this booking, or how do I handle payment and support?"
            helpText="Zito Assistant stays on customer procedure and uses the current booking context."
          />

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#eef6ff] text-[#1b3f72]">
                <CircleDollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Payments</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Booking-linked payment history
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {booking.payments?.length ? (
                booking.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-950">{payment.reference}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {payment.method} · {formatStatus(payment.status)}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatMoney(payment.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No payment records yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#fff8e8] text-[#b7791f]">
                <Headset className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Support</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Issues and customer care linked to this trip
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {booking.supportTickets?.length ? (
                booking.supportTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-950">
                      {formatStatus(ticket.status)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {ticket.description ?? 'No description'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No support tickets linked to this booking yet.
                </p>
              )}
            </div>

            <div className="mt-4">
              <Link href="/customer/support">
                <Button
                  variant="secondary"
                  className="rounded-[16px] bg-slate-100 px-4 py-3 text-slate-800 shadow-none hover:bg-slate-200"
                >
                  Open support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {booking.status === 'COMPLETED' ? (
        <section className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-100 text-amber-700">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Rate trip</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Rate the completed booking while the delivery is still fresh
              </h2>
            </div>
          </div>

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submitRating}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Rating</span>
              <select
                className="w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
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
              tone="light"
              textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />

            <div className="md:col-span-2">
              <Button className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]" type="submit">
                Submit rating
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
