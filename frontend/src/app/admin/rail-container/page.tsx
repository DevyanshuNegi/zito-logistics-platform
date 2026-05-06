'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { RoutePreviewMap } from '@/components/maps/RoutePreviewMap';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type Stop = {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type FreightMilestone = {
  id: string;
  code: string;
  title: string;
  nodeLabel?: string | null;
  status: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  blockedReason?: string | null;
  note?: string | null;
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  serviceType: string;
  requiredVehicleType?: string | null;
  totalPrice: number;
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
  specialInstructions?: string | null;
  stops?: Stop[];
  freightMilestones?: FreightMilestone[];
};

type BookingResponse = {
  bookings: Booking[];
  total: number;
};

const TRADE_MODE_OPTIONS = ['LOCAL', 'IMPORT', 'EXPORT', 'TRANSIT'] as const;
const CORRIDOR_OPTIONS = [
  'MOMBASA_TO_ICD_NAIROBI',
  'MOMBASA_TO_ICD_NAIVASHA',
  'ICD_NAIROBI_TO_MOMBASA',
  'ICD_NAIVASHA_TO_MOMBASA',
  'OTHER',
] as const;
const DOCUMENT_STATUS_OPTIONS = ['PENDING', 'READY', 'SUBMITTED', 'CLEARED', 'HOLD'] as const;

function isRailOrContainer(booking: Booking) {
  return (
    booking.serviceType === 'RAIL' ||
    booking.requiredVehicleType === 'CONTAINER_20FT' ||
    booking.requiredVehicleType === 'CONTAINER_40FT' ||
    Boolean(booking.tradeMode) ||
    Boolean(booking.railCorridorCode) ||
    Boolean(booking.containerReference)
  );
}

function milestoneTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED') {
    return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100';
  }
  if (normalized === 'READY') {
    return 'border-sky-400/25 bg-sky-500/10 text-sky-100';
  }
  if (normalized === 'BLOCKED') {
    return 'border-rose-400/25 bg-rose-500/10 text-rose-100';
  }
  return 'border-slate-700/50 bg-slate-950/80 text-slate-300';
}

export default function RailContainerAdminPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState('LOCAL');
  const [railCorridorCode, setRailCorridorCode] = useState('');
  const [originNode, setOriginNode] = useState('');
  const [destinationNode, setDestinationNode] = useState('');
  const [containerReference, setContainerReference] = useState('');
  const [billOfLadingNumber, setBillOfLadingNumber] = useState('');
  const [idfNumber, setIdfNumber] = useState('');
  const [customsStatus, setCustomsStatus] = useState('PENDING');
  const [icmsStatus, setIcmsStatus] = useState('PENDING');
  const [pacReady, setPacReady] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [milestoneBusyKey, setMilestoneBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<BookingResponse>('/admin/bookings?limit=200');
      const freightBookings = response.bookings.filter(isRailOrContainer);
      setBookings(freightBookings);
      setSelectedBookingId((current) =>
        current && freightBookings.some((booking) => booking.id === current)
          ? current
          : freightBookings[0]?.id ?? null,
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load rail and container workflows.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  useEffect(() => {
    if (!selectedBooking) {
      return;
    }

    setTradeMode(selectedBooking.tradeMode ?? 'LOCAL');
    setRailCorridorCode(selectedBooking.railCorridorCode ?? '');
    setOriginNode(selectedBooking.originNode ?? '');
    setDestinationNode(selectedBooking.destinationNode ?? '');
    setContainerReference(selectedBooking.containerReference ?? '');
    setBillOfLadingNumber(selectedBooking.billOfLadingNumber ?? '');
    setIdfNumber(selectedBooking.idfNumber ?? '');
    setCustomsStatus(selectedBooking.customsStatus ?? 'PENDING');
    setIcmsStatus(selectedBooking.icmsStatus ?? 'PENDING');
    setPacReady(Boolean(selectedBooking.pacReady));
    setSpecialInstructions(selectedBooking.specialInstructions ?? '');
  }, [selectedBooking]);

  const customsPendingCount = useMemo(
    () =>
      bookings.filter((booking) =>
        ['PENDING', 'SUBMITTED', 'HOLD'].includes(booking.customsStatus ?? 'PENDING'),
      ).length,
    [bookings],
  );
  const pacReadyCount = useMemo(
    () => bookings.filter((booking) => booking.pacReady).length,
    [bookings],
  );
  const activeCorridors = useMemo(
    () =>
      new Set(
        bookings
          .map((booking) => booking.railCorridorCode)
          .filter((value): value is string => Boolean(value)),
      ).size,
    [bookings],
  );

  async function saveTradeControl() {
    if (!selectedBooking) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(`/admin/bookings/${selectedBooking.id}/trade-control`, {
        tradeMode,
        railCorridorCode: selectedBooking.serviceType === 'RAIL' ? railCorridorCode || undefined : undefined,
        originNode,
        destinationNode,
        containerReference: containerReference || undefined,
        billOfLadingNumber: billOfLadingNumber || undefined,
        idfNumber: idfNumber || undefined,
        customsStatus,
        icmsStatus,
        pacReady,
        specialInstructions: specialInstructions || undefined,
      });
      setSuccess('Rail and container controls updated.');
      await loadBookings();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to update trade controls.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateMilestone(
    milestoneId: string,
    status: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED',
  ) {
    if (!selectedBooking) {
      return;
    }

    const key = `${milestoneId}:${status}`;
    const note =
      status === 'BLOCKED'
        ? window.prompt('Blocked reason or intervention note')
        : window.prompt('Optional milestone note') ?? '';

    if (status === 'BLOCKED' && !note?.trim()) {
      return;
    }

    setMilestoneBusyKey(key);
    setError(null);
    setSuccess(null);

    try {
      await api.patch(
        `/admin/bookings/${selectedBooking.id}/freight-milestones/${milestoneId}`,
        {
          status,
          note: note?.trim() || undefined,
          blockedReason: status === 'BLOCKED' ? note?.trim() || undefined : undefined,
        },
      );
      setSuccess(`Milestone marked ${formatStatus(status)}.`);
      await loadBookings();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to update the freight milestone.',
      );
    } finally {
      setMilestoneBusyKey(null);
    }
  }

  const mapPoints =
    selectedBooking?.stops?.slice(0, 2).map((stop, index) => ({
      lat: stop.latitude ?? null,
      lng: stop.longitude ?? null,
      label: index === 0 ? 'Origin' : 'Destination',
      tone: (index === 0 ? 'pickup' : 'drop') as 'pickup' | 'drop',
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Freight workflows"
          value={String(bookings.length)}
          helper="Rail and container bookings visible in control."
        />
        <StatCard
          label="Customs pending"
          value={String(customsPendingCount)}
          helper="Moves still waiting on customs or iCMS clearance."
          tone="warning"
        />
        <StatCard
          label="PAC ready"
          value={String(pacReadyCount)}
          helper="Moves that can proceed into pre-arrival dispatch windows."
          tone="success"
        />
        <StatCard
          label="Active corridors"
          value={String(activeCorridors)}
          helper="Enabled rail corridors present in the active queue."
          tone="info"
        />
      </div>

      {error ? (
        <Alert title="Rail/container control error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Rail/container control updated" variant="success">
          {success}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SurfaceCard
          title="Freight queue"
          description="Prioritize active SGR and container workflows from one rail and port desk."
          actions={
            <Link
              className="text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
              href="/admin/bookings"
            >
              Open full booking queue
            </Link>
          }
        >
          {loading ? (
            <Spinner />
          ) : bookings.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
              No rail or container workflows are active yet.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  className={[
                    'w-full rounded-[22px] border px-4 py-4 text-left transition',
                    selectedBookingId === booking.id
                      ? 'border-cyan-400/45 bg-cyan-500/10 shadow-[0_18px_36px_rgba(34,211,238,0.08)]'
                      : 'border-slate-700/40 bg-slate-900/60 hover:border-slate-500/50',
                  ].join(' ')}
                  onClick={() => setSelectedBookingId(booking.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{booking.reference}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {(booking.originNode || booking.stops?.[0]?.address || 'Origin pending')} {'->'}{' '}
                        {(booking.destinationNode || booking.stops?.[1]?.address || 'Destination pending')}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                      {formatStatus(booking.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                    <span className="rounded-full border border-slate-700/50 bg-slate-950/70 px-2.5 py-1">
                      {formatStatus(booking.serviceType)}
                    </span>
                    {booking.requiredVehicleType ? (
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/70 px-2.5 py-1">
                        {formatStatus(booking.requiredVehicleType)}
                      </span>
                    ) : null}
                    {booking.tradeMode ? (
                      <span className="rounded-full border border-slate-700/50 bg-slate-950/70 px-2.5 py-1">
                        {formatStatus(booking.tradeMode)}
                      </span>
                    ) : null}
                    {booking.customsStatus ? (
                      <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                        Customs {formatStatus(booking.customsStatus)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{formatMoney(booking.totalPrice)}</p>
                </button>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          title="Trade control desk"
          description="Manage corridor, customs, and documentation control without leaving the admin command surface."
        >
          {!selectedBooking ? (
            <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-900/60 px-4 py-5 text-sm text-slate-400">
              Choose a freight booking to review the logistics controls.
            </div>
          ) : (
            <div className="space-y-5">
              <RoutePreviewMap
                className="h-64 rounded-[24px]"
                points={mapPoints}
                statusBadge={formatStatus(selectedBooking.status)}
                titleBadge="Rail / container"
              />

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedBooking.reference}</p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatStatus(selectedBooking.serviceType)}</p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Vehicle</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedBooking.requiredVehicleType
                      ? formatStatus(selectedBooking.requiredVehicleType)
                      : 'Pending'}
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-700/40 bg-slate-900/60 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Value</p>
                  <p className="mt-2 text-sm font-semibold text-white">{formatMoney(selectedBooking.totalPrice)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Trade mode</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={tradeMode}
                    onChange={(event) => setTradeMode(event.target.value)}
                  >
                    {TRADE_MODE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatStatus(option)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBooking.serviceType === 'RAIL' ? (
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-200">Rail corridor</span>
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                      value={railCorridorCode}
                      onChange={(event) => setRailCorridorCode(event.target.value)}
                    >
                      <option value="">Select corridor</option>
                      {CORRIDOR_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {formatStatus(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Origin node</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={originNode}
                    onChange={(event) => setOriginNode(event.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Destination node</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={destinationNode}
                    onChange={(event) => setDestinationNode(event.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Container reference</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={containerReference}
                    onChange={(event) => setContainerReference(event.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Bill of lading</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={billOfLadingNumber}
                    onChange={(event) => setBillOfLadingNumber(event.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">IDF number</span>
                  <input
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={idfNumber}
                    onChange={(event) => setIdfNumber(event.target.value)}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Customs status</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={customsStatus}
                    onChange={(event) => setCustomsStatus(event.target.value)}
                  >
                    {DOCUMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatStatus(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">iCMS status</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={icmsStatus}
                    onChange={(event) => setIcmsStatus(event.target.value)}
                  >
                    {DOCUMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {formatStatus(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="md:col-span-2 space-y-2">
                  <span className="text-sm font-medium text-slate-200">Special instructions</span>
                  <textarea
                    className="min-h-[108px] w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={specialInstructions}
                    onChange={(event) => setSpecialInstructions(event.target.value)}
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                <input
                  checked={pacReady}
                  className="h-4 w-4 rounded border-slate-700/70 bg-slate-950/60"
                  onChange={(event) => setPacReady(event.target.checked)}
                  type="checkbox"
                />
                Pre-arrival clearance (PAC) is ready
              </label>

              <div className="flex flex-wrap gap-3">
                <Button disabled={saving} onClick={() => void saveTradeControl()}>
                  {saving ? 'Saving trade control...' : 'Save trade control'}
                </Button>
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
                  href="/admin/bookings"
                >
                  Open booking controls
                </Link>
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-700/40 bg-slate-900/50 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Freight milestones
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    Port, ICD, customs, and last-mile handoff control
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Keep each freight leg visible instead of hiding rail and container work inside one booking status.
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedBooking.freightMilestones?.length ? (
                    selectedBooking.freightMilestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="rounded-[20px] border border-slate-700/40 bg-slate-950/70 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {milestone.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {milestone.nodeLabel ?? 'Node pending'}
                            </p>
                          </div>
                          <span
                            className={[
                              'rounded-full border px-3 py-1 text-[11px] font-semibold',
                              milestoneTone(milestone.status),
                            ].join(' ')}
                          >
                            {formatStatus(milestone.status)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
                          <p>Scheduled: {milestone.scheduledAt ? formatDateTime(milestone.scheduledAt) : 'Pending'}</p>
                          <p>Started: {milestone.startedAt ? formatDateTime(milestone.startedAt) : 'Pending'}</p>
                          <p>Completed: {milestone.completedAt ? formatDateTime(milestone.completedAt) : 'Pending'}</p>
                        </div>
                        {milestone.blockedReason ? (
                          <p className="mt-2 text-xs text-rose-300">
                            Blocked: {milestone.blockedReason}
                          </p>
                        ) : null}
                        {milestone.note ? (
                          <p className="mt-2 text-xs text-slate-300">
                            Note: {milestone.note}
                          </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(['READY', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'] as const).map(
                            (status) => {
                              const buttonKey = `${milestone.id}:${status}`;
                              return (
                                <Button
                                  key={status}
                                  disabled={milestoneBusyKey === buttonKey}
                                  onClick={() => void updateMilestone(milestone.id, status)}
                                  variant={
                                    status === 'BLOCKED'
                                      ? 'danger'
                                      : status === 'COMPLETED'
                                        ? 'secondary'
                                        : 'primary'
                                  }
                                >
                                  {milestoneBusyKey === buttonKey
                                    ? 'Updating...'
                                    : `Mark ${formatStatus(status)}`}
                                </Button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-slate-700/50 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                      No freight milestones exist yet for this booking.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
