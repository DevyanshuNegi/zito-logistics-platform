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
import { formatDateTime, formatMoney, formatStatus } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/phase-one';

type Booking = {
  id: string;
  reference: string;
  totalPrice: number;
  status: string;
};

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description?: string | null;
  createdAt?: string;
};

type WalletResponse = {
  wallet: {
    balance: number;
    currency: string;
  };
  transactions: WalletTransaction[];
};

type Payment = {
  id: string;
  reference: string;
  amount: number;
  method: string;
  status: string;
  createdAt?: string;
};

type BookingPaymentsResponse = Payment[];

type BookingListResponse = {
  bookings: Booking[];
};

function generateKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CustomerPaymentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [wallet, setWallet] = useState<WalletResponse['wallet'] | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [bookingPayments, setBookingPayments] = useState<Payment[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('MPESA');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadBaseData() {
    setLoading(true);
    setError(null);

    try {
      const [walletResponse, bookingsResponse] = await Promise.all([
        api.get<WalletResponse>('/payments/wallet/me/transactions'),
        api.get<BookingListResponse>('/customer/bookings'),
      ]);

      setWallet(walletResponse.wallet);
      setTransactions(walletResponse.transactions);
      setBookings(bookingsResponse.bookings);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load payment data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedBookingId) {
      setBookingPayments([]);
      return;
    }

    const booking = bookings.find((item) => item.id === selectedBookingId);
    if (booking && !amount) {
      setAmount(String(booking.totalPrice));
    }

    void (async () => {
      try {
        const response = await api.get<BookingPaymentsResponse>(`/payments/booking/${selectedBookingId}`);
        setBookingPayments(response);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Unable to load booking payments.');
      }
    })();
  }, [amount, bookings, selectedBookingId]);

  async function handleInitiate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBookingId) {
      setError('Select a booking first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.post<{ reference: string; providerResponse?: { customerMessage?: string } }>(
        '/payments/initiate',
        {
          bookingId: selectedBookingId,
          amount: Number(amount),
          method,
        },
        {
          idempotencyKey: generateKey(),
        },
      );

      setSuccess(
        response.providerResponse?.customerMessage ??
          `Payment ${response.reference} created successfully.`,
      );
      await loadBaseData();
      const payments = await api.get<BookingPaymentsResponse>(`/payments/booking/${selectedBookingId}`);
      setBookingPayments(payments);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to initiate payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Wallet balance" value={formatMoney(wallet?.balance, wallet?.currency ?? 'KES')} helper="Live wallet view from the payments module." />
        <StatCard label="Ledger items" value={String(transactions.length)} helper="Recent wallet transactions." tone="info" />
        <StatCard label="Selected booking payments" value={String(bookingPayments.length)} helper="Payments linked to the active booking." tone="success" />
      </div>

      {error ? (
        <Alert title="Payments workflow error" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Payment initiated" variant="success">
          {success}
        </Alert>
      ) : null}

      <SurfaceCard title="Pay for a booking" description="Use the Phase 1 payment entry point with escrow-aware initiation.">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleInitiate}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Booking</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={selectedBookingId}
              onChange={(event) => {
                setSelectedBookingId(event.target.value);
                setAmount('');
              }}
            >
              <option value="">Choose booking</option>
              {bookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.reference} · {formatStatus(booking.status)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Method</span>
            <select
              className="w-full rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 focus:border-sky-400/70 focus:outline-none"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          <div className="flex items-end">
            <Button disabled={submitting || loading} type="submit">
              {submitting ? 'Initiating...' : 'Initiate payment'}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard title="Booking payment history" description="Payment attempts for the booking you selected above.">
          {loading ? (
            <Spinner />
          ) : (
            <Table
              rows={bookingPayments}
              columns={[
                {
                  key: 'reference',
                  header: 'Reference',
                  render: (payment) => payment.reference,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (payment) => formatStatus(payment.status),
                },
                {
                  key: 'method',
                  header: 'Method',
                  render: (payment) => payment.method,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (payment) => formatMoney(payment.amount),
                },
              ]}
            />
          )}
        </SurfaceCard>

        <SurfaceCard title="Wallet ledger" description="Credits and debits recorded for your wallet.">
          {loading ? (
            <Spinner />
          ) : (
            <Table
              rows={transactions}
              columns={[
                {
                  key: 'type',
                  header: 'Type',
                  render: (transaction) => transaction.type,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (transaction) => formatMoney(transaction.amount),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  render: (transaction) => formatMoney(transaction.balance),
                },
                {
                  key: 'description',
                  header: 'Description',
                  render: (transaction) => transaction.description ?? 'No description',
                },
                {
                  key: 'created',
                  header: 'Created',
                  render: (transaction) => formatDateTime(transaction.createdAt),
                },
              ]}
            />
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
