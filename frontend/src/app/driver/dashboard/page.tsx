'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';

type DriverProfile = {
  user?: {
    fullName?: string | null;
  } | null;
  vehicle?: {
    plateNumber?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
  isOnline?: boolean;
  isAvailable?: boolean;
};

type ShiftStatus = {
  active: boolean;
  hoursElapsed?: number;
  hoursRemaining?: number;
  fatigueAlert?: string | null;
};

type PayrollSummary = {
  totalEarned: number;
  pendingAmount: number;
};

type Trip = {
  id: string;
  reference: string;
  status: string;
  stops?: Array<{ address?: string | null }>;
};

type TripResponse = {
  bookings: Trip[];
};

export default function DriverDashboardPage() {
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [shift, setShift] = useState<ShiftStatus | null>(null);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [jobs, setJobs] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [profileResponse, shiftResponse, summaryResponse, jobsResponse] = await Promise.all([
        api.get<DriverProfile>('/drivers/me'),
        api.get<ShiftStatus>('/drivers/shift/status'),
        api.get<PayrollSummary>('/driver/payroll/summary'),
        api.get<TripResponse>('/driver/trips?limit=5'),
      ]);

      setProfile(profileResponse);
      setShift(shiftResponse);
      setSummary(summaryResponse);
      setJobs(jobsResponse.bookings);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load driver dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Driver dashboard error" variant="danger">
          {error}
        </Alert>
      ) : null}

      {shift?.fatigueAlert ? (
        <Alert title="Fatigue alert" variant="warning">
          {shift.fatigueAlert}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shift" value={shift?.active ? 'Active' : 'Not active'} helper={shift?.active ? `${shift.hoursRemaining ?? 0}h remaining` : 'Start shift before accepting jobs.'} tone={shift?.active ? 'success' : 'warning'} />
        <StatCard label="Availability" value={profile?.isAvailable ? 'Available' : 'Unavailable'} helper={profile?.isOnline ? 'Online' : 'Offline'} tone={profile?.isAvailable ? 'info' : 'neutral'} />
        <StatCard label="Earned" value={formatMoney(summary?.totalEarned)} helper="Paid payroll total." tone="success" />
        <StatCard label="Pending payout" value={formatMoney(summary?.pendingAmount)} helper="Approved or pending payroll still unpaid." tone="warning" />
      </div>

      <SurfaceCard
        title={`Welcome ${profile?.user?.fullName ?? 'Driver'}`}
        description="Operational snapshot for shifts, assigned vehicle, and current jobs."
        actions={
          <div className="flex gap-3">
            <Link href="/driver/shift">
              <Button>Open shift controls</Button>
            </Link>
            <Link href="/driver/jobs">
              <Button variant="secondary">Manage jobs</Button>
            </Link>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Assigned vehicle</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {profile?.vehicle?.plateNumber ?? 'No vehicle assigned'}
            </p>
            <p className="text-sm text-slate-300">
              {profile?.vehicle?.type ?? 'Vehicle type pending'} · {formatStatus(profile?.vehicle?.status)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Hours elapsed</p>
            <p className="mt-3 text-lg font-semibold text-white">{shift?.hoursElapsed ?? 0}h</p>
          </div>
          <div className="rounded-3xl border border-slate-700/40 bg-slate-900/55 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Recent jobs</p>
            <p className="mt-3 text-lg font-semibold text-white">{jobs.length}</p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Recent jobs" description="Latest trips pushed to the driver app.">
        <Table
          rows={jobs}
          columns={[
            {
              key: 'reference',
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
              header: 'Status',
              render: (trip) => formatStatus(trip.status),
            },
            {
              key: 'action',
              header: 'Action',
              render: (trip) => (
                <Link href="/driver/jobs">
                  <Button variant="secondary">Open jobs</Button>
                </Link>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
