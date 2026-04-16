import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const TABS = [
  { key: 'customer',    label: 'Customer Payments',     icon: '💳', color: '#e8a020' },
  { key: 'transporter', label: 'Transporter Settlements', icon: '🏭', color: '#2dd4bf' },
  { key: 'invoices',    label: 'Invoices',               icon: '📄', color: '#6366f1' },
];

const PAY_STATUS = {
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Pending'   },
  confirmed: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'Confirmed' },
  failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Failed'    },
  refunded:  { color: '#6366f1', bg: 'rgba(99,102,241,0.15)', label: 'Refunded'  },
  paid:      { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'Paid'      },
  unpaid:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Unpaid'    },
  overdue:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Overdue'   },
};

const PAY_METHODS = {
  mpesa:  { icon: '📱', label: 'M-Pesa' },
  credit: { icon: '🏦', label: 'Bank Transfer' },
};

export default function Payments() {
  const [activeTab,    setActiveTab]    = useState('customer');
  const [payments,     setPayments]     = useState([]);
  const [invoices,     setInvoices]     = useState([]);
  const [bookings,     setBookings]     = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [vehicles,     setVehicles]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedTransporter, setSelectedTransporter] = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [search,       setSearch]       = useState('');
  const [form, setForm] = useState({ booking_id: '', method: 'mpesa', amount: '', mpesa_ref: '', notes: '' });
  const [settleForm, setSettleForm] = useState({ amount: '', method: 'mpesa', mpesa_ref: '', notes: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, inv, b, t, v] = await Promise.all([
        api.get('/api/v1/payments'),
        api.get('/api/v1/invoices').catch(() => ({ data: { data: [] } })),
        api.get('/api/v1/bookings'),
        api.get('/api/v1/users?role=transporter'),
        api.get('/api/v1/vehicles'),
      ]);
      setPayments(p.data.data     || p.data     || []);
      setInvoices(inv.data.data   || inv.data   || []);
      setBookings(b.data.data     || b.data     || []);
      setTransporters(t.data.data || t.data     || []);
      setVehicles(v.data.data     || v.data     || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Build transporter settlement summaries
  const transporterSummaries = transporters.map(tp => {
    const tpVehicles  = vehicles.filter(v => v.transporter_id === tp.id);
    const tpVehicleIds = new Set(tpVehicles.map(v => v.id));
    const tpBookings  = bookings.filter(b => tpVehicleIds.has(b.vehicle_id) && b.status === 'completed');
    const totalEarned = tpBookings.reduce((sum, b) => sum + (parseFloat(b.amount || b.total_amount) || 0), 0);
    // settlements already paid (from payments table with transporter marker or notes)
    const settled     = payments.filter(p => p.transporter_id === tp.id || (p.notes || '').toLowerCase().includes(tp.id));
    const totalPaid   = settled.reduce((sum, p) => sum + (parseFloat(p.amount_kes) || 0), 0);
    const outstanding = totalEarned - totalPaid;
    return { ...tp, tpVehicles, tpBookings, totalEarned, totalPaid, outstanding };
  }).filter(tp => tp.tpVehicles.length > 0 || tp.tpBookings.length > 0);

  // Stats
  const totalReceived  = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + (parseFloat(p.amount_kes) || 0), 0);
  const totalPending   = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (parseFloat(p.amount_kes) || 0), 0);
  const totalOutstanding = transporterSummaries.reduce((s, tp) => s + Math.max(0, tp.outstanding), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue').length;

  const ksh = n => `KES ${Number(n || 0).toLocaleString()}`;
  const fmt = d => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const filteredPayments = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.mpesa_ref?.toLowerCase().includes(q) ||
      p.mpesa_receipt?.toLowerCase().includes(q) ||
      p.booking_id?.toString().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  });

  const handleAddPayment = async () => {
    setSaving(true);
    try {
      await api.post('/api/v1/payments', {
        booking_id: form.booking_id,
        method: form.method,
        amount_kes: parseFloat(form.amount),
        mpesa_ref: form.mpesa_ref,
        notes: form.notes,
        status: 'confirmed',
      });
      await fetchAll();
      setShowModal(false);
      setForm({ booking_id: '', method: 'mpesa', amount: '', mpesa_ref: '', notes: '' });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleSettle = async () => {
    setSaving(true);
    try {
      await api.post('/api/v1/payments', {
        transporter_id: selectedTransporter.id,
        method: settleForm.method,
        amount_kes: parseFloat(settleForm.amount),
        mpesa_ref: settleForm.mpesa_ref,
        notes: settleForm.notes || `Settlement for ${selectedTransporter.company_name || selectedTransporter.full_name}`,
        payment_type: 'transporter_settlement',
        status: 'confirmed',
      });
      await fetchAll();
      setShowSettleModal(false);
      setSettleForm({ amount: '', method: 'mpesa', mpesa_ref: '', notes: '' });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const completedBookings = bookings.filter(b => b.status === 'completed');

  return (
    <Layout>
      {/* Header */}
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Payments & Finance</div>
          <div style={s.sectionSub}>Customer payments · Transporter settlements · Invoices</div>
        </div>
        {activeTab === 'customer' && (
          <button style={s.btnPrimary} onClick={() => setShowModal(true)}>+ Record Payment</button>
        )}
      </div>

      {/* Summary cards */}
      <div style={s.statsGrid}>
        {[
          { label: 'Total Received',       value: ksh(totalReceived),   color: '#22c55e', icon: '💰', sub: 'Confirmed payments' },
          { label: 'Pending Payments',     value: ksh(totalPending),    color: '#f59e0b', icon: '⏳', sub: 'Awaiting confirmation' },
          { label: 'Transporter Owed',     value: ksh(totalOutstanding),color: '#2dd4bf', icon: '🏭', sub: 'Outstanding settlements' },
          { label: 'Overdue Invoices',     value: overdueInvoices,      color: '#ef4444', icon: '📄', sub: 'Need immediate attention' },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 24 }}>{c.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: c.color }}>{c.value}</div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf2', marginTop: 8 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: '#545f73', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div style={s.panel}>
        {/* Tabs */}
        <div style={s.panelHeader}>
          <div style={s.tabs}>
            {TABS.map(t => (
              <button key={t.key}
                style={{ ...s.tab, ...(activeTab === t.key ? { ...s.tabActive, borderColor: t.color, color: t.color } : {}) }}
                onClick={() => { setActiveTab(t.key); setSearch(''); }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {activeTab !== 'transporter' && (
            <input style={s.search} placeholder="Search payments..."
              value={search} onChange={e => setSearch(e.target.value)} />
          )}
        </div>

        {/* ── CUSTOMER PAYMENTS TAB ── */}
        {activeTab === 'customer' && (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>REF</th>
                <th style={s.th}>BOOKING</th>
                <th style={s.th}>METHOD</th>
                <th style={s.th}>AMOUNT</th>
                <th style={s.th}>M-PESA REF</th>
                <th style={s.th}>DATE</th>
                <th style={s.th}>STATUS</th>
                <th style={s.th}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={s.emptyCell}>Loading payments...</td></tr>
              ) : filteredPayments.length === 0 ? (
                <tr><td colSpan={8} style={s.emptyCell}>
                  <div style={s.emptyState}><div style={{ fontSize: 36, opacity: 0.25 }}>💳</div><div style={{ color: '#8892a4' }}>No payments recorded yet</div></div>
                </td></tr>
              ) : filteredPayments.map(p => {
                const cfg = PAY_STATUS[p.status] || PAY_STATUS.pending;
                const mth = PAY_METHODS[p.method] || { icon: '💵', label: p.method };
                return (
                  <tr key={p.id} style={s.tr}>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', color: '#e8a020', fontSize: 12 }}>#{String(p.id).slice(-6).toUpperCase()}</span></td>
                    <td style={s.td}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#8892a4' }}>#{String(p.booking_id).padStart(4, '0')}</span></td>
                    <td style={s.td}><span style={{ fontSize: 13 }}>{mth.icon} {mth.label}</span></td>
                    <td style={{ ...s.td, fontWeight: 700, color: '#22c55e', fontSize: 14 }}>{ksh(p.amount_kes)}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, color: '#8892a4' }}>{p.mpesa_ref || p.mpesa_receipt || '—'}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#8892a4' }}>{fmt(p.confirmed_at || p.created_at)}</td>
                    <td style={s.td}><span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                    <td style={{ ...s.td, fontSize: 12, color: '#545f73', maxWidth: 160 }}>{p.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* ── TRANSPORTER SETTLEMENTS TAB ── */}
        {activeTab === 'transporter' && (
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={s.emptyCell}>Loading transporter data...</div>
            ) : transporterSummaries.length === 0 ? (
              <div style={{ ...s.emptyCell, padding: 48 }}>
                <div style={s.emptyState}><div style={{ fontSize: 36, opacity: 0.25 }}>🏭</div><div style={{ color: '#8892a4' }}>No contracted transporters with completed trips</div></div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transporterSummaries.map(tp => {
                  const pct = tp.totalEarned > 0 ? Math.min(100, (tp.totalPaid / tp.totalEarned) * 100) : 0;
                  const isOwed = tp.outstanding > 0;
                  return (
                    <div key={tp.id} style={{ ...s.settlementCard, ...(isOwed ? { borderColor: 'rgba(45,212,191,0.2)' } : {}) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        {/* Transporter info */}
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={s.tpAvatar}>🏭</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#e8eaf2' }}>
                              {tp.company_name || tp.full_name}
                            </div>
                            <div style={{ fontSize: 12, color: '#545f73', marginTop: 2 }}>{tp.phone || tp.email || '—'}</div>
                            {tp.mpesa_number && <div style={{ fontSize: 12, color: '#2dd4bf', marginTop: 2 }}>M-Pesa: {tp.mpesa_number}</div>}
                            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                              <span style={{ fontSize: 11, color: '#545f73' }}>🚛 {tp.tpVehicles.length} vehicle{tp.tpVehicles.length !== 1 ? 's' : ''}</span>
                              <span style={{ fontSize: 11, color: '#545f73' }}>✓ {tp.tpBookings.length} completed trip{tp.tpBookings.length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financials */}
                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={s.finBox}>
                            <div style={s.finLabel}>Total Earned</div>
                            <div style={{ ...s.finValue, color: '#e8eaf2' }}>{ksh(tp.totalEarned)}</div>
                          </div>
                          <div style={s.finBox}>
                            <div style={s.finLabel}>Paid Out</div>
                            <div style={{ ...s.finValue, color: '#22c55e' }}>{ksh(tp.totalPaid)}</div>
                          </div>
                          <div style={s.finBox}>
                            <div style={s.finLabel}>Outstanding</div>
                            <div style={{ ...s.finValue, color: isOwed ? '#2dd4bf' : '#545f73' }}>{ksh(Math.max(0, tp.outstanding))}</div>
                          </div>
                          {isOwed && (
                            <button style={s.btnSettle}
                              onClick={() => { setSelectedTransporter(tp); setSettleForm({ amount: Math.max(0, tp.outstanding).toFixed(2), method: 'mpesa', mpesa_ref: '', notes: '' }); setShowSettleModal(true); }}>
                              💸 Settle
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {tp.totalEarned > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: '#545f73' }}>Settlement progress</span>
                            <span style={{ fontSize: 11, color: pct >= 100 ? '#22c55e' : '#2dd4bf', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                          </div>
                          <div style={s.progressBg}>
                            <div style={{ ...s.progressFill, width: `${pct}%`, background: pct >= 100 ? '#22c55e' : '#2dd4bf' }} />
                          </div>
                        </div>
                      )}

                      {/* Vehicle list */}
                      {tp.tpVehicles.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {tp.tpVehicles.map(v => (
                            <span key={v.id} style={s.plateChip}>{v.plate_number}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── INVOICES TAB ── */}
        {activeTab === 'invoices' && (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>INVOICE #</th>
                <th style={s.th}>CUSTOMER</th>
                <th style={s.th}>PERIOD</th>
                <th style={s.th}>SUBTOTAL</th>
                <th style={s.th}>VAT 16%</th>
                <th style={s.th}>TOTAL</th>
                <th style={s.th}>DUE DATE</th>
                <th style={s.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={s.emptyCell}>Loading invoices...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} style={s.emptyCell}>
                  <div style={s.emptyState}><div style={{ fontSize: 36, opacity: 0.25 }}>📄</div><div style={{ color: '#8892a4' }}>No invoices yet</div></div>
                </td></tr>
              ) : invoices.filter(i => {
                if (!search) return true;
                const q = search.toLowerCase();
                return i.invoice_number?.toLowerCase().includes(q);
              }).map(inv => {
                const cfg = PAY_STATUS[inv.status] || PAY_STATUS.pending;
                return (
                  <tr key={inv.id} style={s.tr}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{inv.invoice_number}</td>
                    <td style={{ ...s.td, fontSize: 13 }}>{inv.customer?.full_name || inv.customer_id}</td>
                    <td style={{ ...s.td, fontSize: 12, color: '#8892a4' }}>{fmt(inv.period_start)} – {fmt(inv.period_end)}</td>
                    <td style={{ ...s.td, fontSize: 13 }}>{ksh(inv.subtotal_kes)}</td>
                    <td style={{ ...s.td, fontSize: 13, color: '#f59e0b' }}>{ksh(inv.vat_kes)}</td>
                    <td style={{ ...s.td, fontSize: 14, fontWeight: 700, color: '#e8eaf2' }}>{ksh(inv.total_kes)}</td>
                    <td style={{ ...s.td, fontSize: 12, color: inv.status === 'overdue' ? '#ef4444' : '#8892a4' }}>{fmt(inv.due_date)}</td>
                    <td style={s.td}><span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>{cfg.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── RECORD PAYMENT MODAL ── */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>💳 Record Payment</span>
              <button style={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.formGroup}>
                <label style={s.label}>Booking</label>
                <select style={s.input} value={form.booking_id} onChange={e => setForm({ ...form, booking_id: e.target.value })}>
                  <option value="">— Select booking —</option>
                  {completedBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      #{String(b.id).padStart(4, '0')} — {b.pickup_location} → {b.dropoff_location} ({ksh(b.amount || b.total_amount)})
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Payment Method</label>
                  <select style={s.input} value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                    <option value="mpesa">📱 M-Pesa</option>
                    <option value="credit">🏦 Bank Transfer</option>
                  </select>
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Amount (KES)</label>
                  <input style={s.input} placeholder="0.00" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              {form.method === 'mpesa' && (
                <div style={s.formGroup}>
                  <label style={s.label}>M-Pesa Reference</label>
                  <input style={{ ...s.input, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    placeholder="e.g. QHX7ABCD12" value={form.mpesa_ref}
                    onChange={e => setForm({ ...form, mpesa_ref: e.target.value.toUpperCase() })} />
                </div>
              )}
              <div style={s.formGroup}>
                <label style={s.label}>Notes (optional)</label>
                <input style={s.input} placeholder="Any additional notes..." value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={s.formRow}>
                <button style={s.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
                <button style={{ ...s.btnConfirm, background: '#e8a020' }} disabled={saving} onClick={handleAddPayment}>
                  {saving ? 'Saving...' : '✓ Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTLE TRANSPORTER MODAL ── */}
      {showSettleModal && selectedTransporter && (
        <div style={s.overlay} onClick={() => setShowSettleModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>💸 Settle Transporter</span>
              <button style={s.modalClose} onClick={() => setShowSettleModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {/* Transporter summary */}
              <div style={{ background: '#0a0d14', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf2' }}>{selectedTransporter.company_name || selectedTransporter.full_name}</div>
                    {selectedTransporter.mpesa_number && (
                      <div style={{ fontSize: 12, color: '#2dd4bf', marginTop: 3 }}>📱 {selectedTransporter.mpesa_number}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#545f73' }}>Outstanding</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#2dd4bf' }}>{ksh(Math.max(0, selectedTransporter.outstanding))}</div>
                  </div>
                </div>
              </div>

              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Payment Method</label>
                  <select style={s.input} value={settleForm.method} onChange={e => setSettleForm({ ...settleForm, method: e.target.value })}>
                    <option value="mpesa">📱 M-Pesa</option>
                    <option value="credit">🏦 Bank Transfer</option>
                  </select>
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Amount (KES)</label>
                  <input style={s.input} value={settleForm.amount}
                    onChange={e => setSettleForm({ ...settleForm, amount: e.target.value })} />
                </div>
              </div>
              {settleForm.method === 'mpesa' && (
                <div style={s.formGroup}>
                  <label style={s.label}>M-Pesa Reference</label>
                  <input style={{ ...s.input, fontFamily: 'monospace', textTransform: 'uppercase' }}
                    placeholder="e.g. QHX7ABCD12" value={settleForm.mpesa_ref}
                    onChange={e => setSettleForm({ ...settleForm, mpesa_ref: e.target.value.toUpperCase() })} />
                </div>
              )}
              <div style={s.formGroup}>
                <label style={s.label}>Notes (optional)</label>
                <input style={s.input} placeholder="Settlement note..." value={settleForm.notes}
                  onChange={e => setSettleForm({ ...settleForm, notes: e.target.value })} />
              </div>
              <div style={s.formRow}>
                <button style={s.btnCancel} onClick={() => setShowSettleModal(false)}>Cancel</button>
                <button style={{ ...s.btnConfirm, background: '#2dd4bf', color: '#000' }} disabled={saving} onClick={handleSettle}>
                  {saving ? 'Processing...' : '✓ Confirm Settlement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const s = {
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sectionTitle: { fontWeight: 700, fontSize: 18, color: '#e8eaf2', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#8892a4' },
  btnPrimary: { background: '#e8a020', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' },
  panel: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap', gap: 8 },
  tabs: { display: 'flex', gap: 4 },
  tab: { background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '6px 14px', color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  tabActive: { background: '#1f2840' },
  search: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px', color: '#e8eaf2', fontSize: 13, width: 220, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', fontSize: 11, color: '#545f73', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 14px', verticalAlign: 'middle' },
  emptyCell: { padding: '48px', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  settlementCard: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' },
  tpAvatar: { width: 44, height: 44, borderRadius: 10, background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  finBox: { textAlign: 'right' },
  finLabel: { fontSize: 11, color: '#545f73', marginBottom: 3 },
  finValue: { fontWeight: 700, fontSize: 16 },
  btnSettle: { background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  progressBg: { height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
  plateChip: { background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', color: '#e8a020', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, width: '95%', maxWidth: 460 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  modalTitle: { fontWeight: 600, fontSize: 15, color: '#e8eaf2' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: 20 },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '9px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  btnCancel: { padding: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 11, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};