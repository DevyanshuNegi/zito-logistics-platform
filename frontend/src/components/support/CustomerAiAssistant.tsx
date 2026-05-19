'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Bot, LifeBuoy, Search, Sparkles, Truck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError, api } from '@/lib/api';
import type { CustomerAiDraft, CustomerAiSupportResponse } from '@/lib/ai-support';

type CustomerAiQuickAction = {
  label: string;
  message: string;
};

type CustomerAiAssistantProps = {
  bookings?: Array<{
    id: string;
    reference: string;
  }>;
  onUseDraft?: (draft: CustomerAiDraft) => void;
  screenContext?: string;
  title?: string;
  description?: string;
  quickActions?: readonly CustomerAiQuickAction[];
  defaultBookingId?: string;
  compact?: boolean;
  placeholder?: string;
  helpText?: string;
  className?: string;
};

const defaultQuickActions = [
  { label: 'Track my booking', message: 'Help me understand the tracking or status of my booking.' },
  { label: 'Help me book', message: 'Show me the correct customer booking procedure for pickup, drop-off, route, and vehicle selection.' },
  { label: 'Explain a payment', message: 'Help me understand a payment, receipt, or invoice issue.' },
  { label: 'Help with my fleet', message: 'Help me manage my customer-owned fleet, link drivers from the Zito Partners driver app, and complete verification steps.' },
  { label: 'I need human support', message: 'I need human support and want to prepare a clean support draft.' },
] as const;

function sourceTone(source: CustomerAiSupportResponse['source']) {
  if (source === 'OPENAI') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (source === 'POLICY') {
    return 'bg-amber-100 text-amber-700';
  }
  return 'bg-sky-100 text-sky-700';
}

export function CustomerAiAssistant({
  bookings = [],
  onUseDraft,
  screenContext = 'CUSTOMER_SUPPORT',
  title = 'Ask for customer procedure help',
  description = 'Zito Assistant helps with booking, tracking, payments, support procedure, and your customer-owned fleet. It does not expose internal pricing logic or admin economics.',
  quickActions = defaultQuickActions,
  defaultBookingId,
  compact = false,
  placeholder = 'Example: Why is my booking still pending? or Help me with my own fleet verification.',
  helpText = 'Ask about booking procedure, tracking, payments, support, or your owned fleet.',
  className = '',
}: CustomerAiAssistantProps) {
  const [bookingId, setBookingId] = useState(defaultBookingId ?? '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<CustomerAiSupportResponse | null>(null);

  useEffect(() => {
    setBookingId(defaultBookingId ?? '');
  }, [defaultBookingId]);

  async function runAssistant(nextMessage?: string) {
    const draftMessage = (nextMessage ?? message).trim();
    if (!draftMessage) {
      setError('Describe the booking, payment, tracking, or fleet question first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.post<CustomerAiSupportResponse>('/ai-support/chat', {
        bookingId: bookingId || undefined,
        screenContext,
        message: draftMessage,
      });
      setMessage(draftMessage);
      setResponse(result);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Zito Assistant is unavailable right now.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={[
        'rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            'flex items-center justify-center rounded-[18px] bg-violet-100 text-violet-700',
            compact ? 'h-10 w-10' : 'h-12 w-12',
          ].join(' ')}
        >
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Zito Assistant</p>
          <h2
            className={[
              'mt-1 font-semibold text-slate-950',
              compact ? 'text-xl' : 'text-2xl',
            ].join(' ')}
          >
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {quickActions.map((item) => (
          <button
            key={item.label}
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
            onClick={() => void runAssistant(item.message)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {bookings.length ? (
          <div>
            <p className="text-sm font-semibold text-slate-900">Linked booking</p>
            <select
              className="mt-3 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
            >
              <option value="">General customer support</option>
              {bookings.slice(0, 8).map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.reference}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Input
          label="Ask Zito Assistant"
          textarea
          tone="light"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={placeholder}
          help={helpText}
        />

        {error ? (
          <Alert title="Assistant issue" variant="danger">
            {error}
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]"
            disabled={loading}
            onClick={() => void runAssistant()}
          >
            {loading ? 'Thinking...' : 'Ask assistant'}
          </Button>
          <Link
            href="/guides/service"
            className="inline-flex items-center justify-center rounded-[16px] border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
          >
            Open Help Center
          </Link>
        </div>
      </div>

      {response ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sourceTone(response.source)}`}>
                {response.source === 'OPENAI'
                  ? 'AI assisted'
                  : response.source === 'POLICY'
                    ? 'Policy protected'
                    : 'Fallback guided'}
              </span>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Confidence: {response.confidence}
              </span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              {response.escalationDesk}
            </span>
          </div>

          <div className="rounded-[24px] border border-violet-100 bg-violet-50 px-4 py-4">
            <p className="text-sm leading-6 text-slate-700">{response.reply}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {response.actions.map((action) => (
              <Link
                key={`${action.kind}-${action.href}`}
                href={action.href}
                className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-white"
              >
                <span className="flex items-center gap-2">
                  {action.kind === 'OPEN_FLEET' ? <Truck className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  {action.label}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>

          {onUseDraft ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Need human action?</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Turn this into a support draft without repeating the whole issue.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-none hover:bg-sky-50"
                  onClick={() =>
                    onUseDraft({
                      bookingId: response.bookingId ?? bookingId ?? undefined,
                      category: response.category,
                      priority: response.priority,
                      message: response.ticketDraftMessage,
                    })
                  }
                >
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Use as support draft
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
