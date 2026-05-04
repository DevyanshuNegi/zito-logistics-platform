'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, LocateFixed, MapPinned, PackageCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type Booking = {
  id: string;
  reference: string;
  status: string;
  createdAt?: string;
  stops?: Array<{ address?: string | null }>;
};

type BookingResponse = {
  bookings: Booking[];
};

function statusClassName(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (normalized === 'CANCELLED') {
    return 'bg-rose-100 text-rose-700';
  }
  if (normalized === 'ASSIGNED' || normalized === 'PICKED_UP' || normalized === 'IN_TRANSIT') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-amber-100 text-amber-700';
}

export default function CustomerTrackingHubPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get<BookingResponse>('/customer/bookings');
        setBookings(response.bookings);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Unable to load live bookings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)),
    [bookings],
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#16315c_0%,#1b3f72_48%,#3b82f6_100%)] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-100/85">
              Live Tracking
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Follow active trips without digging through booking lists.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-100/85">
              Open a live route, check the driver status, and move from booking to map in one tap.
            </p>
          </div>
          <div className="rounded-[24px] bg-white/12 px-4 py-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/75">Active now</p>
            <p className="mt-3 text-3xl font-semibold">{activeBookings.length}</p>
            <p className="mt-1 text-sm text-cyan-50/80">Trips waiting, assigned, or moving</p>
          </div>
        </div>
      </section>

      {error ? (
        <Alert title="Tracking feed issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-700">Track trips</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">
              Active bookings ready for live map tracking
            </h2>
          </div>
          <Link href="/customer/bookings">
            <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
              Open booking feed
            </Button>
          </Link>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? <Spinner /> : null}

          {!loading && activeBookings.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <PackageCheck className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-950">No active trips right now</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Start a booking and it will appear here the moment a live route or driver update is available.
              </p>
              <Link href="/customer/bookings/new" className="mt-5 inline-flex">
                <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
                  Book a trip
                </Button>
              </Link>
            </div>
          ) : null}

          {!loading
            ? activeBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          {booking.reference}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(booking.status)}`}
                        >
                          {formatStatus(booking.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950">
                        {booking.stops?.[0]?.address ?? 'Pickup pending'}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {booking.stops?.[1]?.address ?? 'Drop pending'}
                        </span>
                      </div>
                    </div>

                    <Link href={`/customer/tracking/${booking.id}`}>
                      <Button className="rounded-[16px] bg-[#1b3f72] px-4 py-3 text-white shadow-none hover:bg-[#163561]">
                        <LocateFixed className="mr-2 h-4 w-4" />
                        Track live
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                      <MapPinned className="h-4 w-4 text-sky-700" />
                      {formatDateTime(booking.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
