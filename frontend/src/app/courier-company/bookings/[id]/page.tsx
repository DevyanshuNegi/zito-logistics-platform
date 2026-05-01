'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { ApiError, api } from '@/lib/api';
import { formatCourierCapacitySource } from '@/lib/courier-capacity';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type BookingStop = {
  sequence?: number;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  stopType?: string | null;
};

type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  totalPrice: number;
  createdAt?: string;
  serviceType?: string | null;
  capacitySource?: string | null;
  cargoType?: string | null;
  vehicleType?: string | null;
  specialInstructions?: string | null;
  _count?: {
    parcels?: number;
    scanEvents?: number;
    waybills?: number;
  } | null;
  stops?: BookingStop[];
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
};

export default function CourierCompanyBookingDetailPage() {
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
      const response = await api.get<BookingDetail>(`/courier-company/bookings/${bookingId}`);
      setBooking(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load courier-company booking detail.');
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
      await api.post(`/courier-company/bookings/${bookingId}/cancel`, { reason });
      await loadBooking();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to cancel courier-company booking.');
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

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Courier-company booking detail error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard
        title={booking.reference}
        description={`Created ${formatDateTime(booking.createdAt)}.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/courier-company/dispatch">
              <Button variant="secondary">Open dispatch</Button>
            </Link>
            <Link href="/courier-company/scan">
              <Button variant="secondary">Open scan ops</Button>
            </Link>
            <Link href="/courier-company/waybills">
              <Button variant="secondary">Open waybills</Button>
            </Link>
            <Link href="/courier-company/fleet">
              <Button variant="secondary">Open owned fleet</Button>
            </Link>
            {canCancel ? (
              <Button variant="danger" onClick={() => void cancelBooking()}>
                Cancel request
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
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Assigned vehicle</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {booking.vehicle?.plateNumber ?? 'Awaiting assignment'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Driver</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {booking.driver?.user?.fullName ?? 'Awaiting assignment'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Execution</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatCourierCapacitySource(booking.capacitySource)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ops trail</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {booking._count?.scanEvents ?? 0} scan(s)
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {booking._count?.waybills ?? 0} waybill(s) • {booking._count?.parcels ?? 0} parcel(s)
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Movement plan" description="The courier-company load plan can include multiple loading and unloading points across the county-to-county chain.">
        <div className="space-y-4">
          {(booking.stops ?? []).map((stop) => (
            <div key={`${stop.sequence}-${stop.address}`} className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {formatStatus(stop.stopType ?? 'INTERMEDIATE')} · Stop {stop.sequence}
              </p>
              <p className="mt-2 font-semibold text-white">{stop.address ?? 'Address pending'}</p>
              <p className="mt-1 text-sm text-slate-300">
                {stop.contactName ?? 'Contact pending'} · {stop.contactPhone ?? 'Phone pending'}
              </p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Commercial summary" description="Operational context for the courier-company movement plan.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Service line</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {formatStatus(booking.serviceType ?? 'PTL')}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Vehicle: {booking.vehicleType ?? booking.vehicle?.type ?? 'Pending'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Execution: {formatCourierCapacitySource(booking.capacitySource)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Load profile</p>
            <p className="mt-3 text-lg font-semibold text-white">{booking.cargoType ?? 'General cargo'}</p>
            <p className="mt-1 text-sm text-slate-400">
              {booking.specialInstructions ?? 'No additional operating notes.'}
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
