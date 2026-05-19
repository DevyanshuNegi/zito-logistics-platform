'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  CircleAlert,
  CreditCard,
  Headset,
  MapPinned,
  MessageSquareText,
  PackageSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { CustomerAiAssistant } from '@/components/support/CustomerAiAssistant';
import { ApiError, api } from '@/lib/api';
import type { CustomerAiDraft } from '@/lib/ai-support';
import { formatDateTime, formatStatus } from '@/lib/format';
import {
  APP_HELP_CENTERS,
  getHelpCenterSuggestion,
} from '@/lib/help-center';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/phase-one';

type TicketMessagePreview = {
  id: string;
  actorType: string;
  message: string;
  createdAt?: string;
  isInternal?: boolean;
};

type Ticket = {
  id: string;
  bookingId?: string | null;
  category: string;
  priority: string;
  status: string;
  description?: string | null;
  createdAt?: string;
  messages?: TicketMessagePreview[];
};

type BookingListResponse = {
  bookings: Array<{
    id: string;
    reference: string;
  }>;
};

const categoryMeta: Record<
  string,
  { label: string; note: string; icon: typeof PackageSearch; accent: string }
> = {
  BOOKING: {
    label: 'Booking issue',
    note: 'Route, trip execution, cancellation, or delivery concerns.',
    icon: PackageSearch,
    accent: 'bg-[#eef6ff] text-[#1b3f72]',
  },
  PAYMENT: {
    label: 'Payment issue',
    note: 'Settlement, wallet, invoice, or payment status questions.',
    icon: CreditCard,
    accent: 'bg-[#fff8e8] text-[#b7791f]',
  },
  DRIVER: {
    label: 'Driver issue',
    note: 'Partner arrival, conduct, communication, or handoff issues.',
    icon: MapPinned,
    accent: 'bg-[#eefbf4] text-[#157347]',
  },
  GENERAL: {
    label: 'General help',
    note: 'Anything outside a specific trip or payment workflow.',
    icon: Headset,
    accent: 'bg-[#f1edff] text-[#6d28d9]',
  },
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

function formatDeskLabel(value?: string | null) {
  return value ? formatStatus(value) : 'Customer care';
}

export default function CustomerSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bookings, setBookings] = useState<BookingListResponse['bookings']>([]);
  const [bookingId, setBookingId] = useState('');
  const [category, setCategory] = useState('BOOKING');
  const [priority, setPriority] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);

  async function loadSupportData() {
    setLoading(true);
    setError(null);

    try {
      const [ticketResponse, bookingsResponse] = await Promise.all([
        api.get<Ticket[]>('/support/my'),
        api.get<BookingListResponse>('/customer/bookings'),
      ]);

      setTickets(ticketResponse);
      setBookings(bookingsResponse.bookings);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load support data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSupportData();
  }, []);

  const autobotSuggestion = useMemo(
    () => getHelpCenterSuggestion(APP_HELP_CENTERS.service, message, category),
    [message, category],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const created = await api.post<Ticket>('/support', {
        bookingId: bookingId || undefined,
        sourceContextType: bookingId ? 'BOOKING' : undefined,
        sourceContextId: bookingId || undefined,
        category,
        priority,
        message,
        autobotSummary: autobotSuggestion?.summary,
        autobotArticle: autobotSuggestion?.article?.title ?? undefined,
        autobotConfidence: autobotSuggestion?.confidence ?? undefined,
        autobotQuickAction: autobotSuggestion?.quickAction?.title ?? undefined,
        autobotEscalationDesk: autobotSuggestion?.escalationDesk ?? undefined,
        autobotSuggestedReply: autobotSuggestion?.suggestedReply ?? undefined,
      });

      setBookingId('');
      setCategory('BOOKING');
      setPriority('MEDIUM');
      setMessage('');
      await loadSupportData();
      router.push(`/customer/support/${created.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create support ticket.');
    } finally {
      setSaving(false);
    }
  }

  const bookingLookup = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking.reference])),
    [bookings],
  );
  const openCount = tickets.filter((ticket) => ticket.status === 'OPEN').length;
  const inProgressCount = tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED',
  ).length;

  function handleUseAssistantDraft(draft: CustomerAiDraft) {
    setBookingId(draft.bookingId ?? '');
    setCategory(draft.category);
    setPriority(draft.priority);
    setMessage(draft.message);
    setAssistantNotice(
      'Zito Assistant prepared a support draft below. Review it and create the ticket when ready.',
    );
  }

  return (
    <div className="space-y-6">
      {assistantNotice ? (
        <Alert title="Assistant draft ready" variant="success">
          {assistantNotice}
        </Alert>
      ) : null}

      {error ? (
        <Alert title="Support issue" variant="danger">
          {error}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#eef7ff_0%,#f6fbff_50%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-sky-700">Support</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-slate-950">
              Raise a booking or payment issue through a clean customer help desk, not an internal ops table.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Start with Help Center logic, let Autobot suggest the best article, then move into a threaded support conversation only when human action is actually needed.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/customer/tracking"
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
              >
                Open tracking
              </Link>
              <Link
                href="/guides/service"
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
              >
                Open Help Center
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: 'Tickets',
                value: loading ? '...' : String(tickets.length),
                helper: 'All customer support requests raised from this workspace.',
                tone: 'bg-white',
              },
              {
                label: 'Open',
                value: loading ? '...' : String(openCount + inProgressCount),
                helper: 'Conversations that still need an action or reply.',
                tone: 'bg-[#eef6ff]',
              },
              {
                label: 'Resolved',
                value: loading ? '...' : String(resolvedCount),
                helper: 'Closed issues that have already been completed.',
                tone: 'bg-[#eefbf4]',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-[28px] border border-slate-200/90 ${item.tone} p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]`}
              >
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_.92fr]">
        <div className="space-y-6">
          <CustomerAiAssistant bookings={bookings} onUseDraft={handleUseAssistantDraft} />

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-100 text-sky-700">
                <MessageSquareText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">New ticket</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Raise support cleanly</h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Pick the issue type first, attach a booking only when needed, then describe the problem once. If Autobot finds a matching article, its summary goes into the ticket so the human desk can continue without asking you to repeat yourself.
            </p>

            <form className="mt-5 space-y-5" onSubmit={handleCreate}>
              <div>
                <p className="text-sm font-semibold text-slate-900">Issue category</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {TICKET_CATEGORIES.map((option) => {
                    const meta = categoryMeta[option];
                    const Icon = meta.icon;
                    const active = category === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCategory(option)}
                        className={[
                          'rounded-[24px] border px-4 py-4 text-left transition',
                          active
                            ? 'border-[#1b3f72] bg-[#eef4ff] shadow-[0_16px_32px_rgba(27,63,114,0.10)]'
                            : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${meta.accent}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">{meta.label}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{meta.note}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Linked booking</p>
                  <span className="text-xs text-slate-500">Optional for general help</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBookingId('')}
                    className={[
                      'rounded-[24px] border px-4 py-4 text-left transition',
                      bookingId === ''
                        ? 'border-[#1b3f72] bg-[#eef4ff] shadow-[0_16px_32px_rgba(27,63,114,0.10)]'
                        : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                    ].join(' ')}
                  >
                    <p className="text-sm font-semibold text-slate-950">General support</p>
                    <p className="mt-1 text-xs text-slate-500">Use this when the issue is not tied to one booking.</p>
                  </button>

                  {bookings.slice(0, 5).map((booking) => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setBookingId(booking.id)}
                      className={[
                        'rounded-[24px] border px-4 py-4 text-left transition',
                        bookingId === booking.id
                          ? 'border-[#1b3f72] bg-[#eef4ff] shadow-[0_16px_32px_rgba(27,63,114,0.10)]'
                          : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                      ].join(' ')}
                    >
                      <p className="text-sm font-semibold text-slate-950">{booking.reference}</p>
                      <p className="mt-1 text-xs text-slate-500">Attach this booking to the ticket.</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Priority</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {TICKET_PRIORITIES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPriority(option)}
                      className={[
                        'rounded-full px-4 py-2 text-sm font-medium transition',
                        priority === option
                          ? 'bg-[#1b3f72] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                      ].join(' ')}
                    >
                      {formatStatus(option)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="What happened?"
                textarea
                tone="light"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                help="Describe the issue clearly. Autobot will only suggest approved Help Center guidance from this message."
                required
              />

              <Button
                className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Creating ticket...' : 'Create ticket'}
              </Button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-violet-100 text-violet-700">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Autobot</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Suggested help path</h2>
              </div>
            </div>

            {!autobotSuggestion ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                Describe the issue above and Autobot will suggest the best Help Center article and next action before you submit the ticket.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {autobotSuggestion.article?.title ?? 'Support triage ready'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Confidence: {formatStatus(autobotSuggestion.confidence)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Help Center backed
                  </span>
                </div>

                <div className="rounded-[24px] border border-violet-100 bg-violet-50 px-4 py-4">
                  <p className="text-sm leading-6 text-slate-700">{autobotSuggestion.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Suggested desk</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {formatDeskLabel(autobotSuggestion.escalationDesk)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Ticket metadata will route the issue toward the right internal desk after creation.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Suggested reply posture</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {autobotSuggestion.suggestedReply}
                    </p>
                  </div>
                </div>

                {autobotSuggestion.article?.items.length ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Key steps from the matched article</p>
                    <div className="mt-3 space-y-2">
                      {autobotSuggestion.article.items.slice(0, 3).map((item) => (
                        <p key={item} className="text-sm leading-6 text-slate-600">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={autobotSuggestion.quickAction?.href ?? '/guides/service'}
                    className="inline-flex items-center justify-center rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                  >
                    {autobotSuggestion.quickAction?.ctaLabel ?? 'Open Help Center'}
                  </Link>
                  <Link
                    href="/guides/service"
                    className="inline-flex items-center justify-center rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                  >
                    Browse all help
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Help workflow</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">What happens next</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                'Autobot checks approved Help Center content before the ticket is created.',
                'If you submit the ticket, the support desk receives the autobot summary, your message, and the linked booking context together.',
                'Continue the issue from one threaded conversation instead of opening duplicate tickets.',
                'Resolved tickets can still reopen if you reply with a new update.',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">My tickets</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Ticket feed</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {tickets.length} records
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? <Spinner /> : null}

              {!loading && !tickets.length ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No tickets yet. If you need help, raise a request above and it will appear here.
                </div>
              ) : null}

              {tickets.map((ticket) => {
                const latestMessage = ticket.messages?.[0]?.message ?? ticket.description;
                return (
                  <Link
                    key={ticket.id}
                    href={`/customer/support/${ticket.id}`}
                    className="block rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-200 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {formatStatus(ticket.category)}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(ticket.status)}`}
                          >
                            {formatStatus(ticket.status)}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${priorityTone(ticket.priority)}`}
                          >
                            {formatStatus(ticket.priority)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {ticket.bookingId ? bookingLookup.get(ticket.bookingId) ?? ticket.bookingId : 'General request'}
                        </p>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                          {latestMessage ?? 'No description provided.'}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                          <CircleAlert className="h-3.5 w-3.5" />
                          {formatDateTime(ticket.messages?.[0]?.createdAt ?? ticket.createdAt)}
                        </div>
                        <p className="mt-3 text-xs font-medium text-sky-700">Open conversation</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
