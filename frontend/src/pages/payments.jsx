import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const TABS = [
  { key: 'customer', label: 'Customer Payments' },
  { key: 'transporter', label: 'Transporter Settlements' },
  { key: 'invoices', label: 'Invoices & Receipts' },
];

const STATUS_STYLES = {
  pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  held:     { color: '#6366f1', bg: 'rgba(99,102,241,0.14)' },
  paid:     { color: '#22c55e', bg: 'rgba(34,197,94,0.14)' },
  failed:   { color: '#ef4444', bg: 'rgba(239,68,68,0.14)' },
  refunded: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.14)' },
};

const formatKes = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export default function Payments() {
  const [activeTab, setActiveTab] = useState('customer');
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    booking_id: '',
    provider: 'bank',
    amount: '',
    status: 'paid',
    reference: '',
    notes: '',
  });

  const loadFinanceData = async () => {
    setLoading(true);
    setError('');

    try {
      const [paymentsResponse, bookingsResponse, transportersResponse] = await Promise.all([
        api.get('/api/v1/payments?limit=300'),
        api.get('/api/v1/bookings?limit=300'),
        api.get('/api/v1/users?role=transporter&limit=200'),
      ]);

      setPayments(paymentsResponse.data?.data?.payments || []);
      setBookings(bookingsResponse.data?.data || []);
      setTransporters(transportersResponse.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not load finance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  const completedBookings = useMemo(() => (
    bookings.filter((booking) => booking.status === 'completed')
  ), [bookings]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return payments;

    return payments.filter((payment) => [
      payment.reference,
      payment.provider,
      payment.booking?.reference,
      payment.metadata?.notes,
      payment.booking_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query));
  }, [payments, search]);

  const transporterSummaries = useMemo(() => {
    const grouped = new Map();

    completedBookings.forEach((booking) => {
      if (!booking.transporter_id) return;
      const current = grouped.get(booking.transporter_id) || {
        transporter_id: booking.transporter_id,
        bookings: [],
        total_hire_rate: 0,
        total_customer_rate: 0,
        total_profit: 0,
        outstanding: 0,
      };

      current.bookings.push(booking);
      current.total_hire_rate += Number(booking.hire_rate || 0);
      current.total_customer_rate += Number(booking.customer_rate || booking.final_fare || 0);
      current.total_profit += Number(booking.profit || 0);
      if (!['released', 'refunded'].includes(booking.payment_status)) {
        current.outstanding += Number(booking.hire_rate || 0);
      }
      grouped.set(booking.transporter_id, current);
    });

    return [...grouped.values()].map((summary) => ({
      ...summary,
      transporter: transporters.find((entry) => entry.id === summary.transporter_id) || null,
    }));
  }, [completedBookings, transporters]);

  const invoiceRows = useMemo(() => completedBookings.map((booking) => ({
    booking_id: booking.id,
    invoice_number: `INV-${String(booking.reference || booking.id).slice(-8).toUpperCase()}`,
    customer_name: booking.customer?.full_name || 'Customer',
    amount: Number(booking.customer_rate || booking.final_fare || 0),
    hire_rate: Number(booking.hire_rate || 0),
    issued_at: booking.completed_at || booking.updated_at || booking.created_at,
    due_date: booking.completed_at || booking.updated_at || booking.created_at,
    status: booking.payment_status === 'released' ? 'paid' : booking.payment_status || 'pending',
  })), [completedBookings]);

  const financeCards = useMemo(() => {
    const totalCollected = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pendingCollections = payments.filter((payment) => ['pending', 'held'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const outstandingReceipts = completedBookings
      .filter((booking) => !['released', 'refunded'].includes(booking.payment_status))
      .reduce((sum, booking) => sum + Number(booking.customer_rate || booking.final_fare || 0), 0);
    const settlementExposure = transporterSummaries.reduce((sum, summary) => sum + summary.outstanding, 0);

    return [
      { label: 'Collected', value: formatKes(totalCollected), sub: 'Recorded paid collections', color: '#22c55e' },
      { label: 'Pending Finance', value: formatKes(pendingCollections), sub: 'Held or pending payment entries', color: '#6366f1' },
      { label: 'Outstanding Receipts', value: formatKes(outstandingReceipts), sub: 'Completed trips still unpaid', color: '#ef4444' },
      { label: 'Transporter Exposure', value: formatKes(settlementExposure), sub: 'Manual payout review backlog', color: '#2dd4bf' },
    ];
  }, [completedBookings, payments, transporterSummaries]);

  const handleRecordPayment = async () => {
    setSaving(true);
    setError('');

    try {
      await api.post('/api/v1/payments', {
        booking_id: form.booking_id,
        provider: form.provider,
        amount_kes: Number(form.amount),
        status: form.status,
        reference: form.reference,
        notes: form.notes,
      });

      setShowModal(false);
      setForm({
        booking_id: '',
        provider: 'bank',
        amount: '',
        status: 'paid',
        reference: '',
        notes: '',
      });
      await loadFinanceData();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not record payment');
    } finally {
      setSaving(false);
    }
  };

  const downloadInvoice = async (bookingId, invoiceNumber) => {
    try {
      const response = await api.get(`/api/v1/payment/${bookingId}/invoice`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not download invoice');
    }
  };

  const exportSettlements = () => {
    const rows = [
      ['transporter', 'completed_trips', 'hire_rate_total', 'customer_rate_total', 'profit', 'outstanding_hire_rate'],
      ...transporterSummaries.map((summary) => [
        summary.transporter?.full_name || summary.transporter?.company_name || summary.transporter_id,
        summary.bookings.length,
        summary.total_hire_rate,
        summary.total_customer_rate,
        summary.total_profit,
        summary.outstanding,
      ]),
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transporter-settlements.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Payments">
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Payments & Finance</div>
          <div style={styles.subTitle}>
            Manual finance workflows are active now. Live M-Pesa charging and payout rails will plug in later once paid services are provisioned.
          </div>
        </div>

        <div style={styles.headerActions}>
          {activeTab === 'customer' && (
            <button type="button" style={styles.primaryBtn} onClick={() => setShowModal(true)}>
              Record Customer Payment
            </button>
          )}
          {activeTab === 'transporter' && (
            <button type="button" style={styles.secondaryBtn} onClick={exportSettlements}>
              Export Settlement Sheet
            </button>
          )}
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.cardGrid}>
        {financeCards.map((card) => (
          <div key={card.label} style={styles.metricCard}>
            <div style={styles.metricLabel}>{card.label}</div>
            <div style={{ ...styles.metricValue, color: card.color }}>{card.value}</div>
            <div style={styles.metricHint}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <div style={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                style={{ ...styles.tabBtn, ...(activeTab === tab.key ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab !== 'transporter' && (
            <input
              style={styles.search}
              placeholder="Search reference, booking, or notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </div>

        {activeTab === 'customer' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Booking</th>
                  <th style={styles.th}>Provider</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Recorded</th>
                  <th style={styles.th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={styles.emptyCell}>Loading payments...</td></tr>
                ) : filteredPayments.length === 0 ? (
                  <tr><td colSpan={7} style={styles.emptyCell}>No payment records match the current filter.</td></tr>
                ) : (
                  filteredPayments.map((payment) => {
                    const style = STATUS_STYLES[payment.status] || STATUS_STYLES.pending;
                    return (
                      <tr key={payment.id} style={styles.row}>
                        <td style={styles.td}>{payment.reference || payment.id}</td>
                        <td style={styles.td}>{payment.booking?.reference || payment.booking_id}</td>
                        <td style={{ ...styles.td, textTransform: 'capitalize' }}>{payment.provider}</td>
                        <td style={styles.td}>{formatKes(payment.amount)}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, color: style.color, background: style.bg }}>
                            {payment.status}
                          </span>
                        </td>
                        <td style={styles.td}>{formatDate(payment.created_at)}</td>
                        <td style={styles.detailsCell}>{payment.metadata?.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'transporter' && (
          <div style={styles.settlementList}>
            {loading ? (
              <div style={styles.emptyCell}>Loading transporter summaries...</div>
            ) : transporterSummaries.length === 0 ? (
              <div style={styles.emptyCell}>No completed transporter jobs available yet.</div>
            ) : (
              transporterSummaries.map((summary) => (
                <div key={summary.transporter_id} style={styles.settlementCard}>
                  <div style={styles.settlementTop}>
                    <div>
                      <div style={styles.settlementTitle}>
                        {summary.transporter?.company_name || summary.transporter?.full_name || summary.transporter_id}
                      </div>
                      <div style={styles.settlementMeta}>
                        {summary.bookings.length} completed trip{summary.bookings.length !== 1 ? 's' : ''} tracked
                      </div>
                    </div>
                    <span style={styles.settlementBadge}>Manual review</span>
                  </div>

                  <div style={styles.settlementStats}>
                    <div>
                      <div style={styles.statLabel}>Hire Rate Total</div>
                      <div style={styles.statValue}>{formatKes(summary.total_hire_rate)}</div>
                    </div>
                    <div>
                      <div style={styles.statLabel}>Customer Billing</div>
                      <div style={styles.statValue}>{formatKes(summary.total_customer_rate)}</div>
                    </div>
                    <div>
                      <div style={styles.statLabel}>Profit</div>
                      <div style={styles.statValue}>{formatKes(summary.total_profit)}</div>
                    </div>
                    <div>
                      <div style={styles.statLabel}>Outstanding</div>
                      <div style={{ ...styles.statValue, color: summary.outstanding > 0 ? '#ef4444' : '#22c55e' }}>
                        {formatKes(summary.outstanding)}
                      </div>
                    </div>
                  </div>

                  <div style={styles.settlementHint}>
                    Payout execution remains manual until live settlement rails are enabled. This summary is ready for finance review and export.
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Issued</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Download</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={styles.emptyCell}>Loading invoices...</td></tr>
                ) : invoiceRows.length === 0 ? (
                  <tr><td colSpan={6} style={styles.emptyCell}>No invoice-ready completed trips yet.</td></tr>
                ) : (
                  invoiceRows
                    .filter((invoice) => {
                      const query = search.trim().toLowerCase();
                      if (!query) return true;
                      return [invoice.invoice_number, invoice.customer_name]
                        .join(' ')
                        .toLowerCase()
                        .includes(query);
                    })
                    .map((invoice) => (
                      <tr key={invoice.booking_id} style={styles.row}>
                        <td style={styles.td}>{invoice.invoice_number}</td>
                        <td style={styles.td}>{invoice.customer_name}</td>
                        <td style={styles.td}>{formatDate(invoice.issued_at)}</td>
                        <td style={styles.td}>{formatKes(invoice.amount)}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, color: STATUS_STYLES[invoice.status]?.color || '#8892a4', background: STATUS_STYLES[invoice.status]?.bg || 'rgba(136,146,164,0.14)' }}>
                            {invoice.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            style={styles.secondaryBtn}
                            onClick={() => downloadInvoice(invoice.booking_id, invoice.invoice_number)}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalTitle}>Record Customer Payment</div>

            <div style={styles.formGrid}>
              <select
                style={styles.input}
                value={form.booking_id}
                onChange={(event) => setForm({ ...form, booking_id: event.target.value })}
              >
                <option value="">Select completed booking</option>
                {completedBookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.reference} · {formatKes(booking.customer_rate || booking.final_fare)}
                  </option>
                ))}
              </select>

              <div style={styles.inlineGrid}>
                <select
                  style={styles.input}
                  value={form.provider}
                  onChange={(event) => setForm({ ...form, provider: event.target.value })}
                >
                  <option value="bank">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa reference</option>
                  <option value="card">Card</option>
                </select>

                <input
                  style={styles.input}
                  placeholder="Amount (KES)"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
              </div>

              <div style={styles.inlineGrid}>
                <select
                  style={styles.input}
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="paid">Paid</option>
                  <option value="held">Held</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                </select>

                <input
                  style={styles.input}
                  placeholder="Reference"
                  value={form.reference}
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                />
              </div>

              <textarea
                style={styles.textarea}
                placeholder="Notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryBtn} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleRecordPayment}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#e8eaf2',
  },
  subTitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#8892a4',
    maxWidth: 740,
    lineHeight: 1.6,
  },
  headerActions: {
    display: 'flex',
    gap: 10,
  },
  primaryBtn: {
    border: 'none',
    background: '#e8a020',
    color: '#0f121c',
    borderRadius: 10,
    padding: '11px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#181e2d',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: 12,
    padding: '10px 12px',
    marginBottom: 16,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 18,
  },
  metricLabel: {
    color: '#8892a4',
    fontSize: 12,
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
  },
  metricHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#545f73',
    lineHeight: 1.5,
  },
  panel: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: 16,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  tabs: {
    display: 'flex',
    gap: 8,
  },
  tabBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#181e2d',
    color: '#8892a4',
    borderRadius: 999,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  tabBtnActive: {
    background: 'rgba(232,160,32,0.14)',
    borderColor: 'rgba(232,160,32,0.35)',
    color: '#e8a020',
  },
  search: {
    minWidth: 260,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 11,
    color: '#545f73',
    letterSpacing: 0.5,
  },
  row: {
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '12px 16px',
    color: '#e8eaf2',
    fontSize: 12,
    verticalAlign: 'top',
  },
  detailsCell: {
    padding: '12px 16px',
    color: '#8892a4',
    fontSize: 12,
    maxWidth: 260,
    lineHeight: 1.5,
  },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  emptyCell: {
    padding: 40,
    textAlign: 'center',
    color: '#8892a4',
  },
  settlementList: {
    display: 'grid',
    gap: 12,
    padding: 16,
  },
  settlementCard: {
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
  },
  settlementTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  settlementTitle: {
    color: '#e8eaf2',
    fontWeight: 700,
    fontSize: 15,
  },
  settlementMeta: {
    color: '#8892a4',
    fontSize: 12,
    marginTop: 4,
  },
  settlementBadge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    color: '#2dd4bf',
    background: 'rgba(45,212,191,0.14)',
  },
  settlementStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginTop: 16,
  },
  statLabel: {
    color: '#545f73',
    fontSize: 11,
  },
  statValue: {
    color: '#e8eaf2',
    fontSize: 15,
    fontWeight: 700,
    marginTop: 6,
  },
  settlementHint: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    color: '#a5b4fc',
    fontSize: 12,
    lineHeight: 1.6,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 540,
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 16,
  },
  formGrid: {
    display: 'grid',
    gap: 12,
  },
  inlineGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
  },
  textarea: {
    width: '100%',
    minHeight: 96,
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
    resize: 'vertical',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
};
