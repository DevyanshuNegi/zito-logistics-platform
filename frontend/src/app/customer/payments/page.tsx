'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Receipt,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { CustomerAiAssistant } from '@/components/support/CustomerAiAssistant';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
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

const paymentMethodMeta: Record<
  string,
  { label: string; note: string; icon: typeof Wallet; accent: string }
> = {
  MPESA: {
    label: 'M-Pesa',
    note: 'Primary mobile-money path for fast checkout.',
    icon: Wallet,
    accent: 'bg-[#eefbf4] text-[#157347]',
  },
  CARD: {
    label: 'Card',
    note: 'Use a debit or credit card for direct settlement.',
    icon: CreditCard,
    accent: 'bg-[#eef6ff] text-[#1b3f72]',
  },
  CASH: {
    label: 'Cash',
    note: 'Use only when your delivery workflow allows cash handoff.',
    icon: Receipt,
    accent: 'bg-[#fff8e8] text-[#b7791f]',
  },
  WALLET: {
    label: 'Wallet',
    note: 'Apply your wallet balance before other payment methods.',
    icon: Wallet,
    accent: 'bg-[#f1edff] text-[#6d28d9]',
  },
  BANK_TRANSFER: {
    label: 'Bank transfer',
    note: 'Best for scheduled B2B settlement and larger totals.',
    icon: Landmark,
    accent: 'bg-[#eef7f8] text-[#0f766e]',
  },
};

const paymentsAiQuickActions = [
  {
    label: 'Pay a booking',
    message: 'Show me the correct customer payment procedure for selecting a booking and choosing a payment method.',
  },
  {
    label: 'Explain this payment',
    message: 'Help me understand the payment status, receipt, or wallet movement for my booking.',
  },
  {
    label: 'Check invoice help',
    message: 'Explain the customer invoice and receipt flow after payment or delivery.',
  },
  {
    label: 'Need payment support',
    message: 'I need human support for a payment or invoice issue and want the clearest next step.',
  },
] as const;

function generateKey() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'SUCCESS') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (normalized === 'FAILED' || normalized === 'REVERSED' || normalized === 'REFUNDED') {
    return 'bg-rose-100 text-rose-700';
  }
  return 'bg-amber-100 text-amber-700';
}

function transactionTone(type: string) {
  return type.toUpperCase().includes('CREDIT')
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-slate-100 text-slate-700';
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

      if (!selectedBookingId && bookingsResponse.bookings[0]) {
        setSelectedBookingId(bookingsResponse.bookings[0].id);
        setAmount(String(bookingsResponse.bookings[0].totalPrice));
      }
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
    if (booking) {
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
  }, [bookings, selectedBookingId]);

  async function handleInitiate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBookingId) {
      setError('Select a booking before initiating payment.');
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
          `Payment ${response.reference} was created successfully.`,
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

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );
  const successfulPayments = useMemo(
    () => bookingPayments.filter((payment) => payment.status === 'SUCCESS').length,
    [bookingPayments],
  );

  return (
    <div className="space-y-6">
      {error ? (
        <Alert title="Payments issue" variant="danger">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert title="Payment initiated" variant="success">
          {success}
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,#eef7ff_0%,#f6fbff_50%,#ffffff_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-sky-700">Payments</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-slate-950">
              Pay, settle, and review wallet activity without leaving the customer service app.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              This screen follows the PRD payment pattern: clear totals, direct method choice, and live booking-linked payment visibility without table-heavy portal views.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/customer/bookings"
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
              >
                Back to bookings
              </Link>
              <Link
                href="/guides/service"
                className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
              >
                Open service guide
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              {
                label: 'Wallet balance',
                value: formatMoney(wallet?.balance, wallet?.currency ?? 'KES'),
                helper: 'Live balance available for wallet-first settlement.',
                tone: 'bg-white',
              },
              {
                label: 'Booking payments',
                value: loading ? '...' : String(bookingPayments.length),
                helper: 'Attempts linked to the booking you are working on.',
                tone: 'bg-[#eef6ff]',
              },
              {
                label: 'Ledger items',
                value: loading ? '...' : String(transactions.length),
                helper: 'Recent credits and debits recorded in your wallet feed.',
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

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-100 text-sky-700">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Checkout</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Pay for a booking</h2>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Choose the booking first, then use one of the supported payment cards. This keeps the flow closer to a service app and away from the old admin portal feel.
          </p>

          <form className="mt-5 space-y-5" onSubmit={handleInitiate}>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Select booking</p>
                {selectedBooking ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {selectedBooking.reference}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {bookings.slice(0, 6).map((booking) => {
                  const active = booking.id === selectedBookingId;
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelectedBookingId(booking.id)}
                      className={[
                        'rounded-[24px] border px-4 py-4 text-left transition',
                        active
                          ? 'border-[#1b3f72] bg-[#eef4ff] shadow-[0_16px_32px_rgba(27,63,114,0.10)]'
                          : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-white',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{booking.reference}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatStatus(booking.status)}</p>
                        </div>
                        <p className="text-sm font-semibold text-[#1b3f72]">
                          {formatMoney(booking.totalPrice)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!bookings.length && !loading ? (
                <div className="mt-3 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No bookings are available yet. Create a delivery first, then come back here to settle it.
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Choose payment method</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map((option) => {
                  const meta = paymentMethodMeta[option];
                  const Icon = meta.icon;
                  const active = method === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMethod(option)}
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

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Input
                label="Amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                tone="light"
                required
                help="The amount pre-fills from the selected booking total and can be adjusted when partial settlement is allowed."
              />
              <Button
                className="rounded-[16px] bg-[#1b3f72] px-5 py-3 text-white shadow-none hover:bg-[#163561]"
                disabled={submitting || loading || !selectedBookingId}
                type="submit"
              >
                {submitting ? 'Initiating...' : 'Initiate payment'}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <CustomerAiAssistant
            compact
            screenContext="CUSTOMER_PAYMENTS"
            bookings={bookings.map((booking) => ({ id: booking.id, reference: booking.reference }))}
            defaultBookingId={selectedBookingId || undefined}
            title="Need help with payment?"
            description="Ask about customer payment steps, receipts, invoice follow-up, wallet activity, or when a payment issue should go to support. Zito Assistant explains procedure only."
            quickActions={paymentsAiQuickActions}
            placeholder="Example: Why is this payment still pending, or what should I check before I pay this booking?"
            helpText="Ask about booking payments, receipts, invoices, wallet activity, or when to contact support."
          />

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Selected booking
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  {selectedBooking?.reference ?? 'Choose a booking'}
                </h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Status',
                  value: selectedBooking ? formatStatus(selectedBooking.status) : 'Not selected',
                },
                {
                  label: 'Booking total',
                  value: selectedBooking ? formatMoney(selectedBooking.totalPrice) : '--',
                },
                {
                  label: 'Successful payments',
                  value: String(successfulPayments),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Booking payments</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Payment timeline</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {bookingPayments.length} records
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? <Spinner /> : null}

              {!loading && !bookingPayments.length ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No payment records exist for this booking yet.
                </div>
              ) : null}

              {bookingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{payment.reference}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {payment.method} - {formatDateTime(payment.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#1b3f72]">
                        {formatMoney(payment.amount)}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(payment.status)}`}
                      >
                        {formatStatus(payment.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200/90 bg-white/94 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Wallet ledger</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Credits and debits</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {transactions.length} items
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {loading ? <Spinner /> : null}

          {!loading && !transactions.length ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 md:col-span-2">
              No wallet activity has been recorded yet.
            </div>
          ) : null}

          {transactions.map((transaction) => {
            const credit = transaction.type.toUpperCase().includes('CREDIT');
            const DirectionIcon = credit ? ArrowDownCircle : ArrowUpCircle;
            return (
              <div
                key={transaction.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] ${transactionTone(transaction.type)}`}
                  >
                    <DirectionIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatStatus(transaction.type)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transaction.description ?? 'Wallet movement'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#1b3f72]">
                          {formatMoney(transaction.amount)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Balance {formatMoney(transaction.balance)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
