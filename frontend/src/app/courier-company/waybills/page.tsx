'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { downloadBase64File } from '@/lib/download';
import { formatDateTime, formatStatus } from '@/lib/format';

type Booking = {
  id: string;
  reference: string;
  status: string;
};

type BookingResponse = {
  bookings: Booking[];
};

type Waybill = {
  id: string;
  number: string;
  type: string;
  status: string;
  issuedAt?: string;
  deliveredAt?: string | null;
  booking: {
    id: string;
    reference: string;
    vehicle?: {
      plateNumber?: string | null;
    } | null;
    driver?: {
      user?: {
        fullName?: string | null;
      } | null;
    } | null;
  };
  items: Array<{
    id: string;
  }>;
};

function nextWaybillStatus(status: string) {
  switch (String(status).trim().toUpperCase()) {
    case 'CREATED':
      return 'IN_TRANSIT';
    case 'IN_TRANSIT':
      return 'DELIVERED';
    case 'DELIVERED':
      return 'CLOSED';
    default:
      return null;
  }
}

export default function CourierCompanyWaybillsPage() {
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [waybillResponse, bookingResponse] = await Promise.all([
        api.get<Waybill[]>('/courier-company/waybills'),
        api.get<BookingResponse>('/courier-company/bookings'),
      ]);
      setWaybills(waybillResponse);
      setBookings(bookingResponse.bookings);
      if (!bookingId && bookingResponse.bookings[0]) {
        setBookingId(bookingResponse.bookings[0].id);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load courier-company waybills.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const openWaybills = useMemo(
    () => waybills.filter((waybill) => waybill.status !== 'CLOSED').length,
    [waybills],
  );

  const deliveredWaybills = useMemo(
    () => waybills.filter((waybill) => waybill.status === 'DELIVERED').length,
    [waybills],
  );

  const activeBookings = useMemo(
    () =>
      bookings.filter((booking) => !['COMPLETED', 'CANCELLED'].includes(booking.status)),
    [bookings],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingId) {
      setError('Choose a booking before creating a waybill.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await api.post<Waybill>('/courier-company/waybills', {
        bookingId,
      });
      setSuccess(`Waybill ${created.number} created for booking ${created.booking.reference}.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to create the waybill.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(waybillId: string) {
    setDownloadingId(waybillId);
    setError(null);

    try {
      const payload = await api.get<{ fileName: string; contentBase64: string }>(
        `/courier-company/waybills/${waybillId}/pdf`,
      );
      downloadBase64File(payload.fileName, payload.contentBase64, 'application/pdf');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to download the waybill PDF.',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleAdvanceStatus(waybill: Waybill) {
    const nextStatus = nextWaybillStatus(waybill.status);
    if (!nextStatus) {
      return;
    }

    setUpdatingId(waybill.id);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/courier-company/waybills/${waybill.id}/status`, {
        status: nextStatus,
      });
      setSuccess(`Waybill ${waybill.number} moved to ${formatStatus(nextStatus)}.`);
      await loadData();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update the waybill status.',
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Waybills" value={String(waybills.length)} helper="Operational manifests visible to this courier account." />
        <StatCard label="Open" value={String(openWaybills)} helper="Waybills still in execution or awaiting closure." tone="info" />
        <StatCard label="Delivered" value={String(deliveredWaybills)} helper="Waybills already confirmed at destination." tone="success" />
        <StatCard label="Eligible jobs" value={String(activeBookings.length)} helper="Bookings available for new manifest generation." tone="warning" />
      </div>

      <Alert title="Courier manifest flow" variant="info">
        Create and manage waybills here so the courier team can keep parcel manifests, vehicle context, and delivery status aligned with the CFA operations flow.
      </Alert>

      {error ? (
        <Alert title="Waybill workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert title="Waybill workflow update" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Create waybill" description="Generate a manifest for an active courier-company booking. All linked parcels will be attached automatically.">
        <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleCreate}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Booking</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              onChange={(event) => setBookingId(event.target.value)}
              value={bookingId}
            >
              <option value="">Select a booking</option>
              {activeBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.reference} • {formatStatus(booking.status)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button disabled={saving} type="submit">
              {saving ? 'Creating waybill...' : 'Create waybill'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="Waybill register" description="Monitor manifest state, assigned execution context, and download PDFs for field teams.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={waybills}
            emptyMessage="No courier-company waybills have been created yet."
            columns={[
              {
                key: 'number',
                header: 'Waybill',
                render: (waybill) => (
                  <div>
                    <p className="font-semibold text-white">{waybill.number}</p>
                    <p className="text-xs text-slate-400">{waybill.booking.reference}</p>
                  </div>
                ),
              },
              {
                key: 'execution',
                header: 'Execution',
                render: (waybill) => (
                  <div className="text-xs text-slate-300">
                    <p>{waybill.booking.vehicle?.plateNumber ?? 'Awaiting vehicle'}</p>
                    <p>{waybill.booking.driver?.user?.fullName ?? 'Awaiting driver'}</p>
                  </div>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                render: (waybill) => formatStatus(waybill.type),
              },
              {
                key: 'status',
                header: 'Status',
                render: (waybill) => formatStatus(waybill.status),
              },
              {
                key: 'items',
                header: 'Parcels',
                render: (waybill) => String(waybill.items.length),
              },
              {
                key: 'dates',
                header: 'Dates',
                render: (waybill) => (
                  <div className="text-xs text-slate-300">
                    <p>Issued: {formatDateTime(waybill.issuedAt)}</p>
                    <p>Delivered: {formatDateTime(waybill.deliveredAt)}</p>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (waybill) => (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={downloadingId === waybill.id}
                      onClick={() => void handleDownload(waybill.id)}
                      variant="secondary"
                    >
                      {downloadingId === waybill.id ? 'Preparing PDF...' : 'Download PDF'}
                    </Button>
                    {nextWaybillStatus(waybill.status) ? (
                      <Button
                        disabled={updatingId === waybill.id}
                        onClick={() => void handleAdvanceStatus(waybill)}
                      >
                        {updatingId === waybill.id
                          ? 'Updating...'
                          : `Mark ${formatStatus(nextWaybillStatus(waybill.status) ?? '')}`}
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
