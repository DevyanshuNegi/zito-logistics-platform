'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  ClipboardCheck,
  MessageSquareText,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  SupportMessageThread,
  type SupportThreadAuthor,
  type SupportThreadMessage,
} from '@/components/support/SupportMessageThread';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';
import { TICKET_STATUSES } from '@/lib/phase-one';

type SupportTicketDetail = {
  id: string;
  bookingId?: string | null;
  category: string;
  priority: string;
  status: string;
  description?: string | null;
  resolution?: string | null;
  autobotSummary?: string | null;
  autobotArticle?: string | null;
  createdAt?: string;
  updatedAt?: string;
  booking?: {
    id: string;
    reference?: string | null;
    status?: string | null;
  } | null;
  raiser?: SupportThreadAuthor | null;
  handler?: SupportThreadAuthor | null;
  messages: SupportThreadMessage[];
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED', 'ESCALATED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') {
    return 'bg-emerald-500/15 text-emerald-200';
  }
  if (normalized === 'ESCALATED') {
    return 'bg-rose-500/15 text-rose-200';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'bg-sky-500/15 text-sky-200';
  }
  return 'bg-amber-500/15 text-amber-200';
}

function priorityTone(priority: string) {
  const normalized = priority.toUpperCase();
  if (normalized === 'URGENT') {
    return 'bg-rose-500/15 text-rose-200';
  }
  if (normalized === 'HIGH') {
    return 'bg-amber-500/15 text-amber-200';
  }
  if (normalized === 'MEDIUM') {
    return 'bg-sky-500/15 text-sky-200';
  }
  return 'bg-slate-700/70 text-slate-200';
}

export default function StaffSupportTicketPage() {
  const params = useParams<{ ticketId: string }>();
  const pathname = usePathname();
  const ticketId = Array.isArray(params?.ticketId) ? params.ticketId[0] : params?.ticketId;
  const supportBasePath = (pathname ?? '').startsWith('/agency')
    ? '/agency/support'
    : '/staff/support';
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [resolution, setResolution] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTicket() {
    if (!ticketId) {
      setError('Missing support ticket id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<SupportTicketDetail>(`/support/${ticketId}`);
      setTicket(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load support conversation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTicket();
  }, [ticketId]);

  useEffect(() => {
    setResolution(ticket?.resolution ?? '');
  }, [ticket?.resolution]);

  const nextStatusOptions = useMemo(
    () => ALLOWED_TRANSITIONS[ticket?.status ?? ''] ?? [],
    [ticket?.status],
  );

  useEffect(() => {
    setNextStatus((current) => (current && nextStatusOptions.includes(current) ? current : ''));
  }, [nextStatusOptions]);

  async function handleAssign() {
    if (!ticketId) return;

    setAssigning(true);
    setError(null);
    try {
      const response = await api.patch<SupportTicketDetail>(`/support/${ticketId}/assign`, {});
      setTicket(response);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to assign this ticket.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId || !reply.trim()) {
      return;
    }

    setSavingReply(true);
    setError(null);
    try {
      const response = await api.post<SupportTicketDetail>(`/support/${ticketId}/messages`, {
        message: reply.trim(),
        isInternal: internalNote,
      });
      setTicket(response);
      setReply('');
      setInternalNote(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to send the support reply.');
    } finally {
      setSavingReply(false);
    }
  }

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId || !nextStatus) {
      setError('Choose the next status before updating this ticket.');
      return;
    }

    setSavingStatus(true);
    setError(null);
    try {
      const response = await api.patch<SupportTicketDetail>(`/support/${ticketId}`, {
        status: nextStatus,
        resolution: resolution || undefined,
      });
      setTicket(response);
      setNextStatus('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to update the ticket lifecycle.');
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  if (!ticket) {
    return (
      <Alert title="Support thread unavailable" variant="danger">
        {error ?? 'The support conversation could not be found.'}
      </Alert>
    );
  }

  const closed = ticket.status === 'CLOSED';

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Support thread issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="rounded-[34px] border border-slate-800/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_40%),linear-gradient(145deg,#050816_0%,#081122_48%,#0c1831_100%)] p-6 shadow-[0_26px_72px_rgba(2,6,23,0.48)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={supportBasePath}
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to support queue
            </Link>
            <p className="mt-5 text-[11px] uppercase tracking-[0.32em] text-cyan-200/80">Support control</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {formatStatus(ticket.category)} conversation
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Review the full support history, see the autobot handoff, reply publicly or internally, and move the ticket through the correct lifecycle without losing context.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(ticket.status)}`}>
              {formatStatus(ticket.status)}
            </span>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityTone(ticket.priority)}`}>
              {formatStatus(ticket.priority)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[.84fr_1.16fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-800/80 bg-slate-950/60 p-5 shadow-[0_18px_48px_rgba(2,6,23,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-500/15 text-sky-200">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Ticket context</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Case summary</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-300">
              <div className="rounded-[22px] border border-slate-800 bg-slate-950/60 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Linked booking</p>
                <p className="mt-2 font-semibold text-slate-100">
                  {ticket.booking?.reference ?? ticket.bookingId ?? 'General support request'}
                </p>
                {ticket.booking?.status ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Booking status: {formatStatus(ticket.booking.status)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-800 bg-slate-950/60 px-4 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <UserRound className="h-4 w-4 text-cyan-200" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Requester</p>
                  </div>
                  <p className="mt-2 font-semibold text-slate-100">
                    {ticket.raiser?.fullName ?? 'Unknown user'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.raiser?.email ?? ticket.raiser?.phone ?? 'No direct contact'}
                  </p>
                </div>

                <div className="rounded-[22px] border border-slate-800 bg-slate-950/60 px-4 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <ClipboardCheck className="h-4 w-4 text-emerald-200" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Owner</p>
                  </div>
                  <p className="mt-2 font-semibold text-slate-100">
                    {ticket.handler?.fullName ?? 'Unassigned'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {ticket.handler?.email ?? ticket.handler?.phone ?? 'No owner attached yet'}
                  </p>
                </div>
              </div>

              {ticket.autobotSummary ? (
                <div className="rounded-[22px] border border-cyan-500/30 bg-cyan-500/10 px-4 py-4">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Bot className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.24em]">Autobot handoff</p>
                  </div>
                  <p className="mt-3 leading-6 text-slate-100">{ticket.autobotSummary}</p>
                  {ticket.autobotArticle ? (
                    <Link href="/guides/internal" className="mt-3 inline-flex text-sm font-medium text-cyan-200 hover:text-cyan-100">
                      Matched article: {ticket.autobotArticle}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {ticket.description ? (
                <div className="rounded-[22px] border border-slate-800 bg-slate-950/60 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Original request</p>
                  <p className="mt-2 leading-6 text-slate-200">{ticket.description}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-800/80 bg-slate-950/60 p-5 shadow-[0_18px_48px_rgba(2,6,23,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-violet-500/15 text-violet-200">
                <MessageSquareText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Reply</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Public or internal response</h2>
              </div>
            </div>

            {closed ? (
              <div className="mt-5 rounded-[22px] border border-slate-800 bg-slate-950/60 px-4 py-5 text-sm leading-6 text-slate-400">
                This ticket is closed. Use the lifecycle controls only if the policy allows reopening through a different workflow.
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleReply}>
                <Input
                  label={internalNote ? 'Internal note' : 'Reply to user'}
                  textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  help={
                    internalNote
                      ? 'Internal notes stay visible only to internal teams.'
                      : 'Public replies stay in the shared thread visible to the requester.'
                  }
                  required
                />
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    checked={internalNote}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                    onChange={(event) => setInternalNote(event.target.checked)}
                    type="checkbox"
                  />
                  Add as internal note only
                </label>
                <Button
                  disabled={savingReply || !reply.trim()}
                  type="submit"
                >
                  {savingReply ? 'Sending...' : internalNote ? 'Save internal note' : 'Send reply'}
                </Button>
              </form>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-800/80 bg-slate-950/60 p-5 shadow-[0_18px_48px_rgba(2,6,23,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Lifecycle controls</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Ownership and status</h2>
              </div>
              <span className="text-xs text-slate-500">
                Created {formatDateTime(ticket.createdAt)}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {!ticket.handler && ticket.status === 'OPEN' ? (
                <Button
                  disabled={assigning}
                  onClick={() => void handleAssign()}
                >
                  {assigning ? 'Assigning...' : 'Assign to me'}
                </Button>
              ) : null}

              <form className="space-y-4" onSubmit={handleStatusUpdate}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Next status</span>
                  <select
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-cyan-400/80 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    onChange={(event) => setNextStatus(event.target.value)}
                    value={nextStatus}
                  >
                    <option value="">Choose status</option>
                    {nextStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <Input
                  label="Resolution or handoff note"
                  textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  help="Use this when resolving, closing, or leaving a structured note for the next desk."
                />

                <Button
                  disabled={savingStatus || !nextStatus}
                  variant="secondary"
                  type="submit"
                >
                  {savingStatus ? 'Updating...' : 'Update ticket status'}
                </Button>
              </form>

              {ticket.resolution ? (
                <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">Stored resolution</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{ticket.resolution}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Conversation</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Thread history</h2>
          </div>
          <SupportMessageThread messages={ticket.messages} tone="dark" />
        </div>
      </section>
    </div>
  );
}
