'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CircleDot, ShieldCheck, XCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ApiError, api } from '@/lib/api';
import { formatStatus } from '@/lib/format';
import { getDriverNextStatuses } from '@/lib/phase-one';

type Trip = {
  id: string;
  reference: string;
  status: string;
  stops?: Array<{ address?: string | null }>;
};

type TripResponse = {
  bookings: Trip[];
};

type ShiftStatus = {
  active: boolean;
};

function getRouteSummary(trip: Trip) {
  const pickup = trip.stops?.[0]?.address ?? 'Pickup pending';
  const drop = trip.stops?.[1]?.address ?? 'Drop-off pending';
  return `${pickup} -> ${drop}`;
}

function getStatusClasses(status: string) {
  const normalized = status.toUpperCase();
  if (['COMPLETED', 'DELIVERED'].includes(normalized)) {
    return 'bg-[#dcfce7] text-[#15803d]';
  }
  if (['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERY_VERIFICATION'].includes(normalized)) {
    return 'bg-[#dbeafe] text-[#1d4ed8]';
  }
  if (normalized === 'CANCELLED') {
    return 'bg-[#fee2e2] text-[#b91c1c]';
  }
  return 'bg-[#fef3c7] text-[#92400e]';
}

export default function DriverJobsPage() {
  const [jobs, setJobs] = useState<Trip[]>([]);
  const [shift, setShift] = useState<ShiftStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusSelection, setStatusSelection] = useState<Record<string, string>>({});
  const [noteSelection, setNoteSelection] = useState<Record<string, string>>({});
  const [proofSelection, setProofSelection] = useState<Record<string, string>>({});
  const [otpSelection, setOtpSelection] = useState<Record<string, string>>({});
  const [rejectSelection, setRejectSelection] = useState<Record<string, string>>({});

  async function loadJobs() {
    setLoading(true);
    setError(null);

    try {
      const [jobResponse, shiftResponse] = await Promise.all([
        api.get<TripResponse>('/driver/trips'),
        api.get<ShiftStatus>('/drivers/shift/status'),
      ]);

      setJobs(jobResponse.bookings);
      setShift(shiftResponse);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function updateStatus(trip: Trip) {
    const status = statusSelection[trip.id] ?? getDriverNextStatuses(trip.status)[0] ?? '';
    if (!status) {
      setError('Choose the next trip status first.');
      return;
    }

    setBusyId(trip.id);
    setError(null);

    try {
      await api.patch(`/driver/trips/${trip.id}/status`, {
        status,
        note: noteSelection[trip.id] || undefined,
        deliveryProofUrl: status === 'DELIVERED' ? proofSelection[trip.id] || undefined : undefined,
        deliveryOtp: status === 'DELIVERED' ? otpSelection[trip.id] || undefined : undefined,
      });
      await loadJobs();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update trip status.');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectTrip(tripId: string) {
    const reason = rejectSelection[tripId];
    if (!reason) {
      setError('Add a rejection reason before declining this trip.');
      return;
    }

    setBusyId(tripId);
    setError(null);

    try {
      await api.post(`/driver/trips/${tripId}/reject`, { reason });
      await loadJobs();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reject trip.');
    } finally {
      setBusyId(null);
    }
  }

  const metrics = useMemo(() => {
    const active = jobs.filter((trip) =>
      ['ASSIGNED', 'ACCEPTED', 'ARRIVED', 'PICKED', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'DELIVERY_VERIFICATION'].includes(
        trip.status.toUpperCase(),
      ),
    ).length;
    const completed = jobs.filter((trip) =>
      ['COMPLETED', 'DELIVERED'].includes(trip.status.toUpperCase()),
    ).length;

    return {
      total: jobs.length,
      active,
      completed,
    };
  }, [jobs]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert title="Trip workflow issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      {!shift?.active ? (
        <Alert title="Shift required" variant="warning">
          Start a shift before moving bookings out of the assigned state.
        </Alert>
      ) : null}

      <section className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
              Trip queue
            </p>
            <h1 className="mt-1 text-base font-semibold text-[#1a1a2e]">
              Assigned work and next actions
            </h1>
          </div>
          <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1b3f72]">
            {metrics.active} active
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Total', value: metrics.total },
            { label: 'Completed', value: metrics.completed },
            { label: 'Shift', value: shift?.active ? 'On' : 'Off' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-full border border-[#d7e0ec] bg-[#f8faff] px-3 py-2 text-[11px] font-semibold text-[#1a1a2e]"
            >
              {item.label}: <span className="text-[#1b3f72]">{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {jobs.length > 0 ? (
          jobs.map((trip) => {
            const nextStatuses = getDriverNextStatuses(trip.status);
            const selectedStatus = statusSelection[trip.id] ?? nextStatuses[0] ?? '';

            return (
              <article
                key={trip.id}
                className="rounded-[22px] border border-[#d7e0ec] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#1b3f72]">
                    <CircleDot className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a2e]">{trip.reference}</p>
                        <p className="mt-1 text-xs leading-5 text-[#64748b]">{getRouteSummary(trip)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${getStatusClasses(trip.status)}`}>
                        {formatStatus(trip.status)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label className="block space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                          Next action
                        </span>
                        <select
                          className="w-full rounded-[14px] border border-[#d7e0ec] bg-[#f8faff] px-3 py-3 text-sm text-[#1a1a2e] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                          value={selectedStatus}
                          onChange={(event) =>
                            setStatusSelection((current) => ({
                              ...current,
                              [trip.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choose next status</option>
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatStatus(status)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Input
                        tone="light"
                        label="Operational note"
                        placeholder="Add a short note for dispatch or delivery."
                        value={noteSelection[trip.id] ?? ''}
                        onChange={(event) =>
                          setNoteSelection((current) => ({
                            ...current,
                            [trip.id]: event.target.value,
                          }))
                        }
                      />

                      {selectedStatus === 'DELIVERED' ? (
                        <div className="space-y-3 rounded-[16px] bg-[#f8faff] px-3 py-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1a2e]">
                            <ShieldCheck className="h-4 w-4 text-[#1b3f72]" />
                            Delivery proof
                          </div>
                          <Input
                            tone="light"
                            placeholder="Proof URL"
                            value={proofSelection[trip.id] ?? ''}
                            onChange={(event) =>
                              setProofSelection((current) => ({
                                ...current,
                                [trip.id]: event.target.value,
                              }))
                            }
                          />
                          <Input
                            tone="light"
                            placeholder="Delivery OTP"
                            value={otpSelection[trip.id] ?? ''}
                            onChange={(event) =>
                              setOtpSelection((current) => ({
                                ...current,
                                [trip.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <Button
                          disabled={busyId === trip.id}
                          className="flex-1 rounded-[14px] shadow-none"
                          onClick={() => void updateStatus(trip)}
                        >
                          Update trip
                        </Button>

                        {trip.status === 'ASSIGNED' ? (
                          <Button
                            variant="danger"
                            disabled={busyId === trip.id}
                            className="rounded-[14px] shadow-none"
                            onClick={() => void rejectTrip(trip.id)}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        ) : null}
                      </div>

                      {trip.status === 'ASSIGNED' ? (
                        <Input
                          tone="light"
                          placeholder="Rejection reason"
                          value={rejectSelection[trip.id] ?? ''}
                          onChange={(event) =>
                            setRejectSelection((current) => ({
                              ...current,
                              [trip.id]: event.target.value,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <section className="rounded-[22px] border border-dashed border-[#d7e0ec] bg-white px-4 py-8 text-center shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-base font-semibold text-[#1a1a2e]">No trips have been assigned yet</p>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">
              Stay online, keep your shift active, and use the demand view to move closer to the next opportunity.
            </p>
            <div className="mt-4 flex justify-center">
              <Link
                href="/driver/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-semibold text-[#1b3f72]"
              >
                Back to driver home
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
