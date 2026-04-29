'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

type StaffMetric = {
  staffId: string;
  userId: string;
  fullName: string;
  role: string;
  accountRole: string;
  accountStatus: string;
  agency?: {
    id: string;
    name: string;
  } | null;
  bookingsHandled: number;
  ticketsHandled: number;
  ticketsResolved: number;
  openTickets: number;
  approvalActions: number;
  averageResolutionHours: number;
  lastActivityAt?: string | null;
};

type StaffPerformanceResponse = {
  items: StaffMetric[];
  total: number;
  summary: {
    totalStaff: number;
    bookingTouches: number;
    ticketsHandled: number;
    ticketsResolved: number;
    approvalActions: number;
    averageResolutionHours: number;
  };
};

export default function AdminStaffPerformancePage() {
  const [agencyId, setAgencyId] = useState('');
  const [data, setData] = useState<StaffPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPerformance(nextAgencyId = agencyId) {
    setLoading(true);
    setError(null);

    try {
      const path = nextAgencyId
        ? `/staff-performance?agencyId=${encodeURIComponent(nextAgencyId)}`
        : '/staff-performance';
      const response = await api.get<StaffPerformanceResponse>(path);
      setData(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load staff performance.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPerformance();
  }, [agencyId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Team members" value={String(data?.summary.totalStaff ?? 0)} helper="Active staff records in the current scope." />
        <StatCard label="Booking touches" value={String(data?.summary.bookingTouches ?? 0)} helper="Distinct booking actions attributed to staff users." tone="info" />
        <StatCard label="Tickets resolved" value={String(data?.summary.ticketsResolved ?? 0)} helper="Resolved or closed tickets handled by staff." tone="success" />
        <StatCard label="Avg resolution" value={`${data?.summary.averageResolutionHours ?? 0} h`} helper="Average ticket resolution time across the current staff set." tone="warning" />
      </div>

      {error ? (
        <Alert title="Staff performance error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Filters" description="Review staff operational output by agency without leaving the admin portal.">
        <div className="max-w-sm">
          <Input
            label="Agency ID"
            help="Leave blank to view all active staff records."
            value={agencyId}
            onChange={(event) => setAgencyId(event.target.value)}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard title="Staff performance dashboard" description="PRD §44.14 metrics across booking actions, ticket handling, approval work, and resolution time.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            emptyMessage="No staff metrics found for the current scope."
            rows={data?.items ?? []}
            columns={[
              {
                key: 'staff',
                header: 'Staff',
                render: (item) => (
                  <div>
                    <p className="font-semibold text-white">{item.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {formatStatus(item.role)} · {formatStatus(item.accountRole)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'agency',
                header: 'Agency',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{item.agency?.name ?? 'Unassigned'}</p>
                    <p>{formatStatus(item.accountStatus)}</p>
                  </div>
                ),
              },
              {
                key: 'bookings',
                header: 'Bookings',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>Touches: {item.bookingsHandled}</p>
                    <p>Approval work: {item.approvalActions}</p>
                  </div>
                ),
              },
              {
                key: 'tickets',
                header: 'Tickets',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>Handled: {item.ticketsHandled}</p>
                    <p>Resolved: {item.ticketsResolved}</p>
                    <p>Open: {item.openTickets}</p>
                  </div>
                ),
              },
              {
                key: 'resolution',
                header: 'Resolution',
                render: (item) => (
                  <div className="text-xs text-slate-300">
                    <p>{item.averageResolutionHours} hours</p>
                    <p>{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : 'No recent activity'}</p>
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
