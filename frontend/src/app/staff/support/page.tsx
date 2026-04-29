'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';
import { TICKET_STATUSES } from '@/lib/phase-one';

type Ticket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  description?: string | null;
  bookingId?: string | null;
  createdAt?: string;
};

export default function StaffSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusSelection, setStatusSelection] = useState<Record<string, string>>({});
  const [resolutionSelection, setResolutionSelection] = useState<Record<string, string>>({});

  async function loadTickets() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<Ticket[]>('/support');
      setTickets(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load support queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function assignTicket(ticketId: string) {
    setBusyId(ticketId);
    setError(null);

    try {
      await api.patch(`/support/${ticketId}/assign`, {});
      await loadTickets();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to assign ticket.');
    } finally {
      setBusyId(null);
    }
  }

  async function updateTicket(ticketId: string) {
    const status = statusSelection[ticketId];
    if (!status) {
      setError('Choose a status before updating the ticket.');
      return;
    }

    setBusyId(ticketId);
    setError(null);

    try {
      await api.patch(`/support/${ticketId}`, {
        status,
        resolution: resolutionSelection[ticketId] || undefined,
      });
      await loadTickets();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update ticket.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Queue size" value={String(tickets.length)} helper="All tickets visible to staff." />
        <StatCard label="Open" value={String(tickets.filter((ticket) => ticket.status === 'OPEN').length)} helper="Waiting for assignment." tone="warning" />
        <StatCard label="In progress" value={String(tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length)} helper="Currently owned by staff." tone="info" />
      </div>

      {error ? (
        <Alert title="Support queue error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Support queue" description="Assign and resolve tickets from the Phase 1 support panel.">
        <Table
          rows={tickets}
          columns={[
            {
              key: 'ticket',
              header: 'Ticket',
              render: (ticket) => (
                <div>
                  <p className="font-semibold text-white">{ticket.category}</p>
                  <p className="text-xs text-slate-400">{ticket.bookingId ?? 'General support'}</p>
                </div>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              render: (ticket) => ticket.priority,
            },
            {
              key: 'status',
              header: 'Current status',
              render: (ticket) => formatStatus(ticket.status),
            },
            {
              key: 'details',
              header: 'Details',
              render: (ticket) => (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">{ticket.description ?? 'No description'}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(ticket.createdAt)}</p>
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (ticket) => (
                <div className="space-y-2">
                  {ticket.status === 'OPEN' ? (
                    <Button disabled={busyId === ticket.id} onClick={() => void assignTicket(ticket.id)}>
                      Assign to me
                    </Button>
                  ) : null}
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 focus:border-sky-400/70 focus:outline-none"
                    value={statusSelection[ticket.id] ?? ''}
                    onChange={(event) =>
                      setStatusSelection((current) => ({
                        ...current,
                        [ticket.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Choose status</option>
                    {TICKET_STATUSES.filter((status) => status !== 'OPEN').map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Resolution note"
                    value={resolutionSelection[ticket.id] ?? ''}
                    onChange={(event) =>
                      setResolutionSelection((current) => ({
                        ...current,
                        [ticket.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    disabled={busyId === ticket.id}
                    variant="secondary"
                    onClick={() => void updateTicket(ticket.id)}
                  >
                    Update ticket
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </SurfaceCard>
    </div>
  );
}
