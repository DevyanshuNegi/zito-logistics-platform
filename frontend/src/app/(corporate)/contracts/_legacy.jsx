import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const CONTRACT_TYPES = ['standard', 'exclusive', 'sla_premium', 'volume'];
const PAYMENT_DAYS = [7, 14, 30, 60, 90];

const typeColors = {
  standard:    { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  exclusive:   { bg: 'rgba(232,160,32,0.15)',  color: '#e8a020' },
  sla_premium: { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  volume:      { bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf' },
};

const statusColors = {
  draft:    { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  active:   { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  expiring: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  expired:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
};

const emptyForm = {
  customer_id: '', type: 'standard',
  rate_per_trip: '', discount_pct: '',
  credit_limit_kes: '', payment_days: 30,
  start_date: '', end_date: '',
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/contracts'),
      api.get('/api/v1/users?role=customer'),
    ]).then(([c, u]) => {
      setContracts(c.data.data || []);
      setCustomers(u.data.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: 'all',      label: 'All' },
    { key: 'active',   label: 'Active' },
    { key: 'expiring', label: 'Expiring Soon' },
    { key: 'draft',    label: 'Draft' },
    { key: 'expired',  label: 'Expired' },
  ];

  const filtered = contracts.filter(c =>
    activeTab === 'all' ? true : c.status === activeTab
  );

  // Contracts expiring within 30 days
  const expiringCount = contracts.filter(c => {
    if (!c.end_date) return false;
    const daysLeft = Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 30 && daysLeft > 0 && c.status === 'active';
  }).length;

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.customer_id || !form.start_date || !form.end_date) {
      setSubmitError('Customer, Start Date and End Date are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post('/api/v1/contracts', {
        customer_id:      form.customer_id,
        type:             form.type,
        rate_per_trip:    parseFloat(form.rate_per_trip) || null,
        discount_pct:     parseFloat(form.discount_pct) || null,
        credit_limit_kes: parseFloat(form.credit_limit_kes) || null,
        payment_days:     parseInt(form.payment_days),
        start_date:       form.start_date,
        end_date:         form.end_date,
        status:           'draft',
      });
      setContracts(prev => [res.data.data, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to create contract.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysLeft = (endDate) => {
    if (!endDate) return null;
    return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const typeDescriptions = {
    standard:    'Standard per-trip billing with no special terms',
    exclusive:   'Exclusive partnership with dedicated fleet allocation',
    sla_premium: 'Premium SLA with guaranteed response times',
    volume:      'Volume-based discount for high-frequency shippers',
  };

  return (
    <Layout title="Contracts">
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Contract Management</div>
          <div style={s.sectionSub}>Manage customer and agent contracts, rates and credit terms</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { setForm(emptyForm); setSubmitError(''); setShowModal(true); }}>
          + New Contract
        </button>
      </div>

      {/* STATS */}
      <div style={s.statGrid}>
        {[
          { label: 'TOTAL CONTRACTS', color: '#e8a020', icon: '📄', val: contracts.length },
          { label: 'ACTIVE',          color: '#22c55e', icon: '✅', val: contracts.filter(c => c.status === 'active').length },
          { label: 'EXPIRING SOON',   color: '#f59e0b', icon: '⚠️', val: expiringCount },
          { label: 'DRAFT',           color: '#94a3b8', icon: '📝', val: contracts.filter(c => c.status === 'draft').length },
          { label: 'EXPIRED',         color: '#ef4444', icon: '❌', val: contracts.filter(c => c.status === 'expired').length },
        ].map((stat, i) => (
          <div key={i} style={{ ...s.statCard, borderTop: `2px solid ${stat.color}` }}>
            <div style={s.statIcon}>{stat.icon}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={{ ...s.statValue, color: stat.color }}>{loading ? '—' : stat.val}</div>
          </div>
        ))}
      </div>

      {/* EXPIRING ALERT */}
      {expiringCount > 0 && (
        <div style={s.alertBanner}>
          ⚠️ <strong>{expiringCount} contract{expiringCount > 1 ? 's' : ''}</strong> expiring within 30 days — review and renew to avoid service disruption.
        </div>
      )}

      {/* CONTRACT TYPE LEGEND */}
      <div style={s.typeRow}>
        {CONTRACT_TYPES.map(type => {
          const tc = typeColors[type];
          return (
            <div key={type} style={{ ...s.typeCard, borderLeft: `3px solid ${tc.color}` }}>
              <span style={{ ...s.typeBadge, background: tc.bg, color: tc.color }}>{type}</span>
              <div style={{ fontSize: 11, color: '#8892a4', marginTop: 4 }}>{typeDescriptions[type]}</div>
            </div>
          );
        })}
      </div>

      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div style={s.tabs}>
            {tabs.map(t => (
              <button key={t.key}
                style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}
                onClick={() => setActiveTab(t.key)}>
                {t.label}
                <span style={{ ...s.tabCount, ...(activeTab === t.key ? s.tabCountActive : {}) }}>
                  {t.key === 'all' ? contracts.length : contracts.filter(c => c.status === t.key).length}
                </span>
              </button>
            ))}
          </div>
          <input style={s.search} placeholder="Search contracts..." />
        </div>

        <table style={s.table}>
          <thead>
            <tr>
              {['CUSTOMER', 'TYPE', 'RATE/TRIP', 'DISCOUNT', 'CREDIT LIMIT', 'PAYMENT TERMS', 'PERIOD', 'STATUS', 'ACTIONS'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={s.emptyCell}>Loading contracts...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={s.emptyCell}>
                <div style={s.emptyState}>
                  <div style={s.emptyIcon}>📄</div>
                  <div style={s.emptyTitle}>No contracts yet</div>
                  <div style={s.emptySub}>Click "+ New Contract" to create one</div>
                </div>
              </td></tr>
            ) : filtered.map(c => {
              const tc = typeColors[c.type] || typeColors.standard;
              const sc = statusColors[c.status] || statusColors.draft;
              const daysLeft = getDaysLeft(c.end_date);
              const customer = customers.find(u => u.id === c.customer_id);
              return (
                <tr key={c.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.userCard}>
                      <div style={s.avatar}>{(customer?.full_name || c.customer?.full_name || '?').charAt(0)}</div>
                      <div>
                        <div style={s.userName}>{customer?.full_name || c.customer?.full_name || '—'}</div>
                        <div style={s.userEmail}>{customer?.email || c.customer?.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: tc.bg, color: tc.color }}>{c.type}</span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 600, color: '#22c55e' }}>
                    {c.rate_per_trip ? `KES ${parseFloat(c.rate_per_trip).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ ...s.td, color: '#2dd4bf', fontWeight: 600 }}>
                    {c.discount_pct ? `${c.discount_pct}%` : '—'}
                  </td>
                  <td style={{ ...s.td, color: '#e8a020', fontWeight: 600 }}>
                    {c.credit_limit_kes ? `KES ${parseFloat(c.credit_limit_kes).toLocaleString()}` : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={s.termChip}>Net {c.payment_days || 30}</span>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontSize: 12 }}>
                      <div style={{ color: '#e8eaf2' }}>{c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}</div>
                      <div style={{ color: '#545f73' }}>→ {c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}</div>
                      {daysLeft !== null && daysLeft <= 30 && daysLeft > 0 && (
                        <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>{daysLeft}d left</div>
                      )}
                      {daysLeft !== null && daysLeft <= 0 && (
                        <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>Expired</div>
                      )}
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{c.status}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actionBtns}>
                      <button style={s.btnSm} onClick={() => { setSelected(c); setShowViewModal(true); }}>View</button>
                      {c.status === 'draft' && (
                        <button style={{ ...s.btnSm, color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}
                          onClick={async () => {
                            try {
                              await api.put(`/api/v1/contracts/${c.id}`, { status: 'active' });
                              setContracts(prev => prev.map(x => x.id === c.id ? { ...x, status: 'active' } : x));
                            } catch (err) { console.error(err); }
                          }}>
                          Activate
                        </button>
                      )}
                      {(c.status === 'active' || c.status === 'expiring') && (
                        <button style={{ ...s.btnSm, color: '#e8a020', borderColor: 'rgba(232,160,32,0.3)' }}>
                          Renew
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── VIEW CONTRACT MODAL ── */}
      {showViewModal && selected && (
        <div style={s.modalOverlay} onClick={() => setShowViewModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>Contract Details</div>
                <div style={s.modalSub}>ID: {selected.id?.slice(0, 16)}...</div>
              </div>
              <button style={s.modalClose} onClick={() => setShowViewModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              {(() => {
                const tc = typeColors[selected.type] || typeColors.standard;
                const sc = statusColors[selected.status] || statusColors.draft;
                const customer = customers.find(u => u.id === selected.customer_id);
                const daysLeft = getDaysLeft(selected.end_date);
                return (
                  <>
                    {/* CUSTOMER */}
                    <div style={s.viewSection}>
                      <div style={s.viewSectionTitle}>Customer</div>
                      <div style={s.customerRow}>
                        <div style={s.avatar}>{(customer?.full_name || '?').charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#e8eaf2' }}>{customer?.full_name || '—'}</div>
                          <div style={{ fontSize: 12, color: '#8892a4' }}>{customer?.email || '—'}</div>
                        </div>
                        <span style={{ ...s.badge, background: sc.bg, color: sc.color, marginLeft: 'auto' }}>{selected.status}</span>
                      </div>
                    </div>

                    {/* CONTRACT TYPE */}
                    <div style={s.viewSection}>
                      <div style={s.viewSectionTitle}>Contract Type</div>
                      <span style={{ ...s.badge, background: tc.bg, color: tc.color, fontSize: 13, padding: '5px 14px' }}>
                        {selected.type}
                      </span>
                      <div style={{ fontSize: 12, color: '#8892a4', marginTop: 6 }}>{typeDescriptions[selected.type]}</div>
                    </div>

                    {/* FINANCIAL TERMS */}
                    <div style={s.viewSection}>
                      <div style={s.viewSectionTitle}>Financial Terms</div>
                      <div style={s.termsGrid}>
                        <div style={s.termBox}>
                          <div style={s.termLabel}>Rate per Trip</div>
                          <div style={{ ...s.termValue, color: '#22c55e' }}>
                            {selected.rate_per_trip ? `KES ${parseFloat(selected.rate_per_trip).toLocaleString()}` : '—'}
                          </div>
                        </div>
                        <div style={s.termBox}>
                          <div style={s.termLabel}>Discount</div>
                          <div style={{ ...s.termValue, color: '#2dd4bf' }}>
                            {selected.discount_pct ? `${selected.discount_pct}%` : '—'}
                          </div>
                        </div>
                        <div style={s.termBox}>
                          <div style={s.termLabel}>Credit Limit</div>
                          <div style={{ ...s.termValue, color: '#e8a020' }}>
                            {selected.credit_limit_kes ? `KES ${parseFloat(selected.credit_limit_kes).toLocaleString()}` : '—'}
                          </div>
                        </div>
                        <div style={s.termBox}>
                          <div style={s.termLabel}>Payment Terms</div>
                          <div style={{ ...s.termValue, color: '#818cf8' }}>Net {selected.payment_days || 30}</div>
                        </div>
                      </div>
                    </div>

                    {/* DATES */}
                    <div style={s.viewSection}>
                      <div style={s.viewSectionTitle}>Contract Period</div>
                      <div style={s.datesRow}>
                        <div style={s.dateBox}>
                          <div style={s.termLabel}>Start Date</div>
                          <div style={{ fontWeight: 600, color: '#e8eaf2' }}>
                            {selected.start_date ? new Date(selected.start_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                          </div>
                        </div>
                        <div style={s.dateSep}>→</div>
                        <div style={s.dateBox}>
                          <div style={s.termLabel}>End Date</div>
                          <div style={{ fontWeight: 600, color: daysLeft !== null && daysLeft <= 30 ? '#f59e0b' : '#e8eaf2' }}>
                            {selected.end_date ? new Date(selected.end_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                          </div>
                          {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{daysLeft} days remaining</div>
                          )}
                          {daysLeft !== null && daysLeft <= 0 && (
                            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Expired</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={s.modalActions}>
                      <button style={s.btnCancel} onClick={() => setShowViewModal(false)}>Close</button>
                      {selected.status === 'draft' && (
                        <button style={s.btnConfirm}
                          onClick={async () => {
                            try {
                              await api.put(`/api/v1/contracts/${selected.id}`, { status: 'active' });
                              setContracts(prev => prev.map(x => x.id === selected.id ? { ...x, status: 'active' } : x));
                              setSelected(prev => ({ ...prev, status: 'active' }));
                            } catch (err) { console.error(err); }
                          }}>
                          ✓ Activate Contract
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── NEW CONTRACT MODAL ── */}
      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={{ ...s.modal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>New Contract</div>
                <div style={s.modalSub}>Define terms for a customer or agent</div>
              </div>
              <button style={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ ...s.modalBody, maxHeight: '75vh', overflowY: 'auto' }}>

              {/* CUSTOMER */}
              <div style={s.formGroup}>
                <label style={s.label}>Customer / Agent *</label>
                <select style={{ ...s.input, cursor: 'pointer' }}
                  value={form.customer_id} onChange={e => f('customer_id', e.target.value)}>
                  <option value="">— Select customer or agent —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} · {c.role} · {c.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* CONTRACT TYPE */}
              <div style={s.formGroup}>
                <label style={s.label}>Contract Type *</label>
                <div style={s.typeGrid}>
                  {CONTRACT_TYPES.map(type => {
                    const tc = typeColors[type];
                    return (
                      <button key={type}
                        style={{ ...s.typeOption, ...(form.type === type ? { ...s.typeOptionActive, borderColor: tc.color, color: tc.color } : {}) }}
                        onClick={() => f('type', type)}>
                        <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'capitalize', marginBottom: 3 }}>{type.replace('_', ' ')}</div>
                        <div style={{ fontSize: 10, color: form.type === type ? tc.color : '#545f73', lineHeight: 1.3 }}>{typeDescriptions[type]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FINANCIAL */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Rate per Trip (KES)</label>
                  <input style={s.input} type="number" placeholder="e.g. 5000"
                    value={form.rate_per_trip} onChange={e => f('rate_per_trip', e.target.value)} />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Discount %</label>
                  <input style={s.input} type="number" placeholder="e.g. 10"
                    value={form.discount_pct} onChange={e => f('discount_pct', e.target.value)} />
                </div>
              </div>

              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Credit Limit (KES)</label>
                  <input style={s.input} type="number" placeholder="e.g. 100000"
                    value={form.credit_limit_kes} onChange={e => f('credit_limit_kes', e.target.value)} />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Payment Terms (days)</label>
                  <select style={{ ...s.input, cursor: 'pointer' }}
                    value={form.payment_days} onChange={e => f('payment_days', e.target.value)}>
                    {PAYMENT_DAYS.map(d => (
                      <option key={d} value={d}>Net {d} days</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DATES */}
              <div style={s.formRow}>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>Start Date *</label>
                  <input style={s.input} type="date"
                    value={form.start_date} onChange={e => f('start_date', e.target.value)} />
                </div>
                <div style={{ ...s.formGroup, flex: 1 }}>
                  <label style={s.label}>End Date *</label>
                  <input style={s.input} type="date"
                    value={form.end_date} onChange={e => f('end_date', e.target.value)} />
                </div>
              </div>

              {submitError && (
                <div style={s.errorBox}>⚠️ {submitError}</div>
              )}

              <div style={s.modalActions}>
                <button style={s.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
                <button style={{ ...s.btnConfirm, opacity: submitting ? 0.6 : 1 }}
                  onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creating...' : '✓ Create Contract'}
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
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', position: 'relative', overflow: 'hidden' },
  statIcon: { position: 'absolute', right: 14, top: 14, fontSize: 22, opacity: 0.12 },
  statLabel: { fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  statValue: { fontWeight: 800, fontSize: 26 },
  alertBanner: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 },
  typeRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  typeCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px' },
  typeBadge: { borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  panel: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap', gap: 10 },
  tabs: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  tab: { background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '6px 12px', color: '#8892a4', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  tabActive: { background: '#1f2840', color: '#e8eaf2', borderColor: 'rgba(255,255,255,0.07)' },
  tabCount: { background: '#181e2d', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: '#545f73' },
  tabCountActive: { background: '#e8a020', color: '#000', fontWeight: 700 },
  search: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px', color: '#e8eaf2', fontSize: 13, width: 200, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 11, color: '#545f73', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 16px', fontSize: 13, color: '#e8eaf2' },
  emptyCell: { padding: '48px 16px', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 40, opacity: 0.3 },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: '#8892a4' },
  emptySub: { fontSize: 13, color: '#545f73' },
  userCard: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(232,160,32,0.2)', color: '#e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  userName: { fontWeight: 500, fontSize: 13 },
  userEmail: { fontSize: 11, color: '#8892a4' },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  termChip: { background: '#181e2d', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  actionBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnSm: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  // MODAL
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  modalTitle: { fontWeight: 700, fontSize: 16, color: '#e8eaf2', marginBottom: 2 },
  modalSub: { fontSize: 12, color: '#8892a4' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: 20 },
  viewSection: { marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.05)' },
  viewSectionTitle: { fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  customerRow: { display: 'flex', alignItems: 'center', gap: 12 },
  termsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  termBox: { background: '#181e2d', borderRadius: 8, padding: '10px 14px' },
  termLabel: { fontSize: 11, color: '#545f73', marginBottom: 4 },
  termValue: { fontWeight: 700, fontSize: 16 },
  datesRow: { display: 'flex', alignItems: 'center', gap: 12 },
  dateBox: { flex: 1, background: '#181e2d', borderRadius: 8, padding: '10px 14px' },
  dateSep: { color: '#545f73', fontSize: 16 },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '10px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  typeOption: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', color: '#8892a4' },
  typeOptionActive: { background: 'rgba(232,160,32,0.08)' },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  modalActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  btnCancel: { padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 12, background: '#e8a020', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};