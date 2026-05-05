'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  autobotSummary?: string | null;
  bookingId?: string | null;
  booking?: {
    reference?: string | null;
    status?: string | null;
  } | null;
  raiser?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  } | null;
  handler?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  messages?: Array<{
    id: string;
    actorType: string;
    message: string;
    createdAt?: string;
  }>;
  createdAt?: string;
};

export default function StaffSupportPage() {
  const pathname = usePathname();
  const supportBasePath = (pathname ?? '').startsWith('/agency')
    ? '/agency/support'
    : '/staff/support';
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

  const operationsTickets = tickets.filter((ticket) =>
    ['BOOKING', 'DRIVER'].includes(ticket.category),
  ).length;
  const financeTickets = tickets.filter((ticket) => ticket.category === 'PAYMENT').length;
  const botAssistedCount = useMemo(
    () => tickets.filter((ticket) => Boolean(ticket.autobotSummary)).length,
    [tickets],
  );

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Queue size" value={String(tickets.length)} helper="All customer and partner requests visible to customer care." />
        <StatCard label="Ops-related" value={String(operationsTickets)} helper="Booking and driver issues to hand off into operations when needed." tone="warning" />
        <StatCard label="Payment-related" value={String(financeTickets)} helper="Invoice and payment issues that may need accounts review." tone="info" />
        <StatCard label="Bot-assisted" value={String(botAssistedCount)} helper="Tickets that already include an autobot handoff summary." tone="success" />
      </div>

      {error ? (
        <Alert title="Support queue error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Customer care queue" description="Review requests raised by users, take ownership, open the full conversation, resolve them directly, or escalate them to operations or accounts.">
        <Table
          rows={tickets}
          columns={[
            {
              key: 'ticket',
              header: 'Ticket',
              render: (ticket) => (
                <div>
                  <p className="font-semibold text-white">{formatStatus(ticket.category)}</p>
                  <p className="text-xs text-slate-400">
                    {ticket.booking?.reference ?? ticket.bookingId ?? 'General support'}
                  </p>
                </div>
              ),
            },
            {
              key: 'requester',
              header: 'Requester',
              render: (ticket) => (
                <div>
                  <p className="font-medium text-slate-100">{ticket.raiser?.fullName ?? 'Unknown user'}</p>
                  <p className="text-xs text-slate-400">
                    {ticket.raiser?.role ? formatStatus(ticket.raiser.role) : 'User'} · {ticket.raiser?.email ?? ticket.raiser?.phone ?? 'No contact'}
                  </p>
                </div>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              render: (ticket) => formatStatus(ticket.priority),
            },
            {
              key: 'status',
              header: 'Current status',
              render: (ticket) => formatStatus(ticket.status),
            },
            {
              key: 'details',
              header: 'Latest context',
              render: (ticket) => (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">
                    {ticket.messages?.[0]?.message ?? ticket.description ?? 'No description'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(ticket.messages?.[0]?.createdAt ?? ticket.createdAt)}
                    {ticket.handler?.fullName ? ` · Owner: ${ticket.handler.fullName}` : ''}
                  </p>
                  {ticket.autobotSummary ? (
                    <p className="text-xs text-cyan-300">Autobot summary attached</p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (ticket) => (
                <div className="space-y-2">
                  <Link
                    className="inline-flex items-center justify-center rounded-2xl border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
                    href={`${supportBasePath}/${ticket.id}`}
                  >
                    Open thread
                  </Link>
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
