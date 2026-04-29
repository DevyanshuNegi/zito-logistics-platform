'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
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
      setError(caught instanceof ApiError ? caught.message : 'Unable to load jobs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function updateStatus(trip: Trip) {
    const status = statusSelection[trip.id];
    if (!status) {
      setError('Choose the next status first.');
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
      setError('Provide a rejection reason.');
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

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Driver jobs error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {!shift?.active ? (
        <Alert title="Shift required" variant="warning">
          Start a shift before moving bookings out of the assigned state.
        </Alert>
      ) : null}

      <SurfaceCard title="Driver jobs" description="Accept, move, deliver, or reject assigned bookings.">
        <Table
          rows={jobs}
          columns={[
            {
              key: 'trip',
              header: 'Trip',
              render: (trip) => (
                <div>
                  <p className="font-semibold text-white">{trip.reference}</p>
                  <p className="text-xs text-slate-400">
                    {trip.stops?.[0]?.address ?? 'Pickup pending'} → {trip.stops?.[1]?.address ?? 'Drop-off pending'}
                  </p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Current status',
              render: (trip) => formatStatus(trip.status),
            },
            {
              key: 'move',
              header: 'Move trip',
              render: (trip) => {
                const nextStatuses = getDriverNextStatuses(trip.status);
                const selectedStatus = statusSelection[trip.id] ?? nextStatuses[0] ?? '';

                return (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
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
                    <Input
                      placeholder="Operational note"
                      value={noteSelection[trip.id] ?? ''}
                      onChange={(event) =>
                        setNoteSelection((current) => ({
                          ...current,
                          [trip.id]: event.target.value,
                        }))
                      }
                    />
                    {selectedStatus === 'DELIVERED' ? (
                      <>
                        <Input
                          placeholder="Delivery proof URL"
                          value={proofSelection[trip.id] ?? ''}
                          onChange={(event) =>
                            setProofSelection((current) => ({
                              ...current,
                              [trip.id]: event.target.value,
                            }))
                          }
                        />
                        <Input
                          placeholder="Delivery OTP"
                          value={otpSelection[trip.id] ?? ''}
                          onChange={(event) =>
                            setOtpSelection((current) => ({
                              ...current,
                              [trip.id]: event.target.value,
                            }))
                          }
                        />
                      </>
                    ) : null}
                    <Button disabled={busyId === trip.id} onClick={() => void updateStatus(trip)}>
                      Update trip
                    </Button>
                  </div>
                );
              },
            },
            {
              key: 'reject',
              header: 'Reject',
              render: (trip) =>
                trip.status === 'ASSIGNED' ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Reason"
                      value={rejectSelection[trip.id] ?? ''}
                      onChange={(event) =>
                        setRejectSelection((current) => ({
                          ...current,
                          [trip.id]: event.target.value,
                        }))
                      }
                    />
                    <Button variant="danger" disabled={busyId === trip.id} onClick={() => void rejectTrip(trip.id)}>
                      Reject trip
                    </Button>
                  </div>
                ) : (
                  <span className="text-slate-400">Not available</span>
                ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
