'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bike,
  Boxes,
  ChevronRight,
  ClipboardList,
  Home,
  MapPinned,
  Package,
  Truck,
  Warehouse,
} from 'lucide-react';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Booking = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  createdAt?: string;
  stops?: Array<{
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

const serviceShortcuts = [
  {
    href: '/customer/bookings/new?service=FTL',
    label: 'FTL',
    title: 'Trucks',
    icon: Truck,
    accent: 'from-cyan-500/16 via-blue-500/14 to-violet-500/12 text-[#1b3f72]',
  },
  {
    href: '/customer/bookings/new?service=PTL',
    label: 'PTL',
    title: 'Part Load',
    icon: Boxes,
    accent: 'from-blue-500/14 via-indigo-500/12 to-violet-500/12 text-[#214c8f]',
  },
  {
    href: '/customer/bookings/new?service=COURIER',
    label: 'Courier',
    title: '2 Wheeler',
    icon: Bike,
    accent: 'from-cyan-400/16 via-sky-500/12 to-blue-500/12 text-[#155e75]',
  },
  {
    href: '/customer/bookings/new?service=WAREHOUSE',
    label: 'Storage',
    title: 'Warehouse',
    icon: Warehouse,
    accent: 'from-violet-500/14 via-fuchsia-500/10 to-cyan-500/10 text-[#5b21b6]',
  },
] as const;

const savedPlaces = [
  { label: 'Home', icon: Home },
  { label: 'Office', icon: ClipboardList },
  { label: 'Warehouse', icon: Warehouse },
] as const;

function statusClassName(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (normalized === 'CANCELLED') {
    return 'bg-[#fee2e2] text-[#b91c1c]';
  }
  if (normalized === 'ASSIGNED' || normalized === 'PICKED_UP' || normalized === 'IN_TRANSIT') {
    return 'bg-[#dbeafe] text-[#1d4ed8]';
  }
  return 'bg-[#f3e8ff] text-[#7c3aed]';
}

function BookingPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClassName(status)}`}>
      {formatStatus(status)}
    </span>
  );
}

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

  const activeBookings = useMemo(
    () => bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)),
    [bookings],
  );
  const completedBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'COMPLETED'),
    [bookings],
  );
  const leadTrip = activeBookings[0];
  const recentFeed = bookings.slice(0, 2);
  const heroPickup = leadTrip?.stops?.[0]?.address ?? 'Where to deliver?';

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Service feed issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-[#d7e0ec] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <RoutePreviewMap
          className="h-[250px]"
          titleBadge="Live route map"
          statusBadge={leadTrip ? 'Active route live' : 'Ready to book'}
          points={[
            {
              label: 'Pickup',
              tone: 'pickup',
              lat: leadTrip?.stops?.[0]?.latitude ?? null,
              lng: leadTrip?.stops?.[0]?.longitude ?? null,
            },
            {
              label: 'Drop',
              tone: 'drop',
              lat: leadTrip?.stops?.[1]?.latitude ?? null,
              lng: leadTrip?.stops?.[1]?.longitude ?? null,
            },
          ]}
        />

        <div className="-mt-5 rounded-t-[24px] bg-white px-4 pb-4 pt-3 shadow-[0_-6px_20px_rgba(15,23,42,0.06)]">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#cbd5e1]" />

          <Link
            href="/customer/bookings/new"
            className="mb-3 flex items-center gap-3 rounded-[16px] bg-[#f1f5fb] px-3.5 py-3 transition hover:bg-[#e7eef8]"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
            <span className="flex-1 text-sm font-medium text-[#1a1a2e]">
              {heroPickup}
            </span>
            <ChevronRight className="h-4 w-4 text-[#64748b]" />
          </Link>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {savedPlaces.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className="inline-flex shrink-0 items-center gap-2 rounded-[10px] border border-[#d1dcf0] bg-[#f7faff] px-3 py-2 text-[11px] font-semibold text-[#1b3f72]"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {serviceShortcuts.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'inline-flex shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold transition',
                  index === 0
                    ? 'border-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.16)]'
                    : 'border-[#b8c9e4] bg-white text-[#1b3f72] hover:bg-[#eef4ff]',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : recentFeed.length === 0 ? (
              <Link
                href="/customer/bookings/new"
                className="flex items-center gap-3 rounded-[12px] border border-dashed border-[#d7e0ec] px-3 py-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#eef4ff] text-[#1b3f72]">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1a1a2e]">Start your first booking</p>
                  <p className="text-xs text-[#64748b]">FTL, PTL, courier, hire, or warehouse support.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#1b3f72]" />
              </Link>
            ) : (
              recentFeed.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/customer/bookings/${booking.id}`}
                  className="flex items-center gap-3 border-b border-[#f1f5fb] py-2 last:border-b-0"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#eef4ff] text-[#1b3f72]">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1a1a2e]">
                      {booking.stops?.[0]?.address ?? booking.reference}
                    </p>
                    <p className="text-[11px] text-[#64748b]">
                      {formatStatus(booking.status)} / {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                  <div className="text-right text-xs font-bold text-[#1b3f72]">
                    {formatMoney(booking.totalPrice)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Services
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Choose your service</h2>
          </div>
          <span className="rounded-full bg-[#f1f5fb] px-3 py-1 text-[11px] font-semibold text-[#1b3f72]">
            {total} bookings
          </span>
        </div>

          <div className="grid grid-cols-2 gap-3">
            {serviceShortcuts.map((item) => {
              const Icon = item.icon;
              return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[20px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-[16px] bg-gradient-to-br ${item.accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-[#1a1a2e]">{item.title}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
                      {item.label}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-[#94a3b8]" />
                </div>
              </Link>
              );
            })}
          </div>

          <Link
            href="/customer/fleet"
            className="mt-3 flex items-center justify-between rounded-[18px] border border-[#d7e0ec] bg-[#f8fbff] px-4 py-4 transition hover:bg-[#eef4ff]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#1b3f72]">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a1a2e]">Own fleet</p>
                <p className="mt-1 text-[11px] leading-5 text-[#64748b]">
                  Add your own vehicles, onboard drivers, and keep those drivers on the dedicated driver app.
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#94a3b8]" />
          </Link>
        </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Active bookings
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Track what is moving</h2>
          </div>
          <Link href="/customer/tracking" className="text-xs font-semibold text-[#1b3f72]">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : activeBookings.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[#d7e0ec] bg-[#f8fbff] px-4 py-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#1b3f72]">
              <Truck className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#1a1a2e]">No active moves right now</p>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">
              Create a booking and it will appear here with live route status.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[18px] border border-[#e4ebf5] bg-[#f8faff] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <BookingPill status={booking.status} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                        {booking.reference}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-[#1a1a2e]">
                      {booking.stops?.[0]?.address ?? 'Pickup pending'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#64748b]">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {booking.stops?.[1]?.address ?? 'Drop pending'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-extrabold text-[#1b3f72]">
                    {formatMoney(booking.totalPrice)}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/customer/tracking/${booking.id}`}
                    className="flex-1 rounded-[12px] bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
                  >
                    Track
                  </Link>
                  <Link
                    href={`/customer/bookings/${booking.id}`}
                    className="flex-1 rounded-[12px] bg-white px-3 py-2 text-center text-sm font-semibold text-[#1b3f72] ring-1 ring-[#d7e0ec]"
                  >
                    Details
                  </Link>
                  <button
                    type="button"
                    className="rounded-[12px] bg-[#fee2e2] px-3 py-2 text-sm font-semibold text-[#b91c1c]"
                    onClick={() => void cancelBooking(booking.id)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Completed
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1a1a2e]">Recent deliveries</h2>
          </div>
          <Link href="/customer/support" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1b3f72]">
            <MapPinned className="h-3.5 w-3.5" />
            Help
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : completedBookings.length === 0 ? (
          <p className="rounded-[16px] bg-[#f8fbff] px-4 py-4 text-sm text-[#64748b]">
            Completed jobs will appear here after delivery closure.
          </p>
        ) : (
          <div className="space-y-2">
            {completedBookings.slice(0, 3).map((booking) => (
              <Link
                key={booking.id}
                href={`/customer/bookings/${booking.id}`}
                className="flex items-center gap-3 rounded-[14px] bg-[#f8fbff] px-3 py-3 transition hover:bg-[#eef4ff]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#1b3f72] shadow-sm">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1a1a2e]">
                    {booking.stops?.[0]?.address ?? booking.reference}
                  </p>
                  <p className="text-[11px] text-[#64748b]">
                    {formatDateTime(booking.createdAt)} / {formatStatus(booking.status)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#1b3f72]">{formatMoney(booking.totalPrice)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
