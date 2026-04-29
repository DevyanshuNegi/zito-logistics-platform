'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { StatCard } from '@/components/layout/StatCard';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatStatus } from '@/lib/format';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/phase-one';

type Ticket = {
  id: string;
  bookingId?: string | null;
  category: string;
  priority: string;
  status: string;
  description?: string | null;
  createdAt?: string;
};

type BookingListResponse = {
  bookings: Array<{
    id: string;
    reference: string;
  }>;
};

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [bookings, setBookings] = useState<BookingListResponse['bookings']>([]);
  const [bookingId, setBookingId] = useState('');
  const [category, setCategory] = useState('BOOKING');
  const [priority, setPriority] = useState('MEDIUM');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.post('/support', {
        bookingId: bookingId || undefined,
        category,
        priority,
        message,
      });

      setBookingId('');
      setCategory('BOOKING');
      setPriority('MEDIUM');
      setMessage('');
      await loadSupportData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create support ticket.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Tickets" value={String(tickets.length)} helper="Your support conversations." />
        <StatCard label="Open" value={String(tickets.filter((ticket) => ticket.status === 'OPEN').length)} helper="New tickets waiting for action." tone="warning" />
        <StatCard label="Resolved" value={String(tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED').length)} helper="Tickets already closed out." tone="success" />
      </div>

      {error ? (
        <Alert title="Support workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}

      <SurfaceCard title="Raise a ticket" description="Create a booking-linked or general support request.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Booking</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={bookingId}
              onChange={(event) => setBookingId(event.target.value)}
            >
              <option value="">General support request</option>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.reference}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Category</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {TICKET_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Priority</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {TICKET_PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2">
            <Input
              label="Message"
              textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button disabled={saving} type="submit">
              {saving ? 'Creating ticket...' : 'Create ticket'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard title="My tickets" description="Track the full lifecycle of your support requests.">
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={tickets}
            columns={[
              {
                key: 'ticket',
                header: 'Ticket',
                render: (ticket) => (
                  <div>
                    <p className="font-semibold text-white">{ticket.category}</p>
                    <p className="text-xs text-slate-400">{ticket.bookingId ?? 'General request'}</p>
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
                header: 'Status',
                render: (ticket) => formatStatus(ticket.status),
              },
              {
                key: 'description',
                header: 'Description',
                render: (ticket) => ticket.description ?? 'No description',
              },
              {
                key: 'created',
                header: 'Created',
                render: (ticket) => formatDateTime(ticket.createdAt),
              },
            ]}
          />
        )}
      </SurfaceCard>
    </div>
  );
}
