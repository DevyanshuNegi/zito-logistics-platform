'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bot, MessageSquareText, Ticket } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import {
  SupportMessageThread,
  type SupportThreadMessage,
} from '@/components/support/SupportMessageThread';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';

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
  autobotConfidence?: string | null;
  autobotQuickAction?: string | null;
  autobotEscalationDesk?: string | null;
  autobotSuggestedReply?: string | null;
  createdAt?: string;
  updatedAt?: string;
  booking?: {
    id: string;
    reference?: string | null;
    status?: string | null;
  } | null;
  messages: SupportThreadMessage[];
};

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (normalized === 'ESCALATED') {
    return 'bg-rose-100 text-rose-700';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-amber-100 text-amber-700';
}

function priorityTone(priority: string) {
  const normalized = priority.toUpperCase();
  if (normalized === 'URGENT') {
    return 'bg-rose-100 text-rose-700';
  }
  if (normalized === 'HIGH') {
    return 'bg-amber-100 text-amber-700';
  }
  if (normalized === 'MEDIUM') {
    return 'bg-sky-100 text-sky-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function CustomerSupportTicketPage() {
  const params = useParams<{ ticketId: string }>();
  const ticketId = Array.isArray(params?.ticketId) ? params.ticketId[0] : params?.ticketId;
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticketId || !reply.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post<SupportTicketDetail>(`/support/${ticketId}/messages`, {
        message: reply.trim(),
      });
      setTicket(response);
      setReply('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to send your reply.');
    } finally {
      setSaving(false);
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

      <section className="rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#eef7ff_0%,#f6fbff_50%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/customer/support"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to support desk
            </Link>
            <p className="mt-5 text-[11px] uppercase tracking-[0.32em] text-sky-700">Support conversation</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              {formatStatus(ticket.category)} ticket
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Continue the same issue from one thread. Your previous autobot summary and human replies stay visible so you do not need to restart the case.
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

      <section className="grid gap-6 xl:grid-cols-[.88fr_1.12fr]">
        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-100 text-sky-700">
                <Ticket className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Ticket context</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Case summary</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Linked booking</p>
                <p className="mt-2 font-semibold text-slate-950">
                  {ticket.booking?.reference ?? ticket.bookingId ?? 'General support request'}
                </p>
                {ticket.booking?.status ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Booking status: {formatStatus(ticket.booking.status)}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Created</p>
                <p className="mt-2 font-semibold text-slate-950">{formatDateTime(ticket.createdAt)}</p>
                <p className="mt-1 text-xs text-slate-500">Last update: {formatDateTime(ticket.updatedAt)}</p>
              </div>

              {ticket.description ? (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Original request</p>
                  <p className="mt-2 leading-6 text-slate-700">{ticket.description}</p>
                </div>
              ) : null}

              {ticket.autobotSummary ? (
                <div className="rounded-[22px] border border-cyan-200 bg-cyan-50 px-4 py-4">
                  <div className="flex items-center gap-2 text-cyan-700">
                    <Bot className="h-4 w-4" />
                    <p className="text-xs uppercase tracking-[0.24em]">Autobot handoff</p>
                  </div>
                  <p className="mt-3 leading-6 text-slate-700">{ticket.autobotSummary}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {ticket.autobotConfidence ? (
                      <div className="rounded-[18px] border border-cyan-200/80 bg-white/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Confidence</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatStatus(ticket.autobotConfidence)}
                        </p>
                      </div>
                    ) : null}
                    {ticket.autobotEscalationDesk ? (
                      <div className="rounded-[18px] border border-cyan-200/80 bg-white/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Suggested desk</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {formatStatus(ticket.autobotEscalationDesk)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {ticket.autobotQuickAction ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Suggested workflow: <span className="font-medium text-slate-900">{ticket.autobotQuickAction}</span>
                    </p>
                  ) : null}
                  {ticket.autobotSuggestedReply ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Support handoff note: {ticket.autobotSuggestedReply}
                    </p>
                  ) : null}
                  {ticket.autobotArticle ? (
                    <Link href="/guides/service" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-800">
                      Matched article: {ticket.autobotArticle}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {ticket.resolution ? (
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">Resolution</p>
                  <p className="mt-2 leading-6 text-slate-700">{ticket.resolution}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-violet-100 text-violet-700">
                <MessageSquareText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Reply</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Continue this thread</h2>
              </div>
            </div>

            {closed ? (
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                This ticket is closed. Open a new request if a different issue comes up.
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleReply}>
                <Input
                  label="Your update"
                  textarea
                  tone="light"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  help="Add new information, confirm a fix, or tell support what still needs action."
                  required
                />
                <Button
                  className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]"
                  disabled={saving || !reply.trim()}
                  type="submit"
                >
                  {saving ? 'Sending update...' : 'Send update'}
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Conversation</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Message history</h2>
          </div>
          <SupportMessageThread messages={ticket.messages} tone="light" />
        </div>
      </section>
    </div>
  );
}
