'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type ShiftStatus = {
  active: boolean;
  shift?: {
    id: string;
    shiftStartTime?: string;
  } | null;
  hoursElapsed?: number;
  hoursRemaining?: number;
  fatigueAlert?: string | null;
};

type ShiftHistory = {
  shifts: Array<{
    id: string;
    shiftStartTime?: string;
    shiftEndTime?: string | null;
    totalHours?: number | null;
    status?: string | null;
  }>;
};

export default function DriverShiftPage() {
  const [status, setStatus] = useState<ShiftStatus | null>(null);
  const [history, setHistory] = useState<ShiftHistory['shifts']>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadShiftData() {
    setLoading(true);
    setError(null);

    try {
      const [statusResponse, historyResponse] = await Promise.all([
        api.get<ShiftStatus>('/drivers/shift/status'),
        api.get<ShiftHistory>('/drivers/shift/history'),
      ]);

      setStatus(statusResponse);
      setHistory(historyResponse.shifts);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load shift data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShiftData();
  }, []);

  async function runShiftAction(path: '/drivers/shift/start' | '/drivers/shift/end') {
    setBusy(true);
    setError(null);

    try {
      await api.post(path, {});
      await loadShiftData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update shift.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Shift workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {status?.fatigueAlert ? (
        <Alert title="Fatigue alert" variant="warning">
          {status.fatigueAlert}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Shift state" value={status?.active ? 'Active' : 'Ended'} helper="Driver must have an active shift to move jobs." tone={status?.active ? 'success' : 'neutral'} />
        <StatCard label="Hours elapsed" value={`${status?.hoursElapsed ?? 0}h`} helper="Live shift runtime." tone="info" />
        <StatCard label="Hours remaining" value={`${status?.hoursRemaining ?? 0}h`} helper="Maximum shift cap is 12h." tone="warning" />
      </div>

      <SurfaceCard title="Shift controls" description="Start or end the shift enforced by the driver guard.">
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !!status?.active} onClick={() => void runShiftAction('/drivers/shift/start')}>
            Start shift
          </Button>
          <Button
            disabled={busy || !status?.active}
            onClick={() => void runShiftAction('/drivers/shift/end')}
            variant="secondary"
          >
            End shift
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Shift history" description="Recent shift sessions recorded by the backend.">
        <Table
          rows={history}
          columns={[
            {
              key: 'start',
              header: 'Start',
              render: (shift) => formatDateTime(shift.shiftStartTime),
            },
            {
              key: 'end',
              header: 'End',
              render: (shift) => formatDateTime(shift.shiftEndTime),
            },
            {
              key: 'hours',
              header: 'Hours',
              render: (shift) => `${shift.totalHours ?? 0}h`,
            },
            {
              key: 'status',
              header: 'Status',
              render: (shift) => shift.status ?? 'Unknown',
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
