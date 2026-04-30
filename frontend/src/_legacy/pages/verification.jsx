import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const ROLE_COLORS = {
  driver:      { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  transporter: { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc' },
  agent:       { bg: 'rgba(234,179,8,0.12)',   text: '#facc15' },
  customer:    { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80' },
};

const ROLE_ICONS = {
  driver: '🚛', transporter: '🏭', agent: '🤝', customer: '👤',
};

export default function Verification() {

  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [toast, setToast]           = useState(null);       // { msg, type }
  const [expanded, setExpanded]     = useState(null);       // expanded card id
  const [rejectId, setRejectId]     = useState(null);       // id being rejected
  const [rejectReason, setRejectReason] = useState('');

  // ─── Fetch ────────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/users?verification_status=pending');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Verification fetch error:', err);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Approve ──────────────────────────────────────────────────────────────────
  const approveUser = async (id, name) => {
    try {
      await api.put(`/api/v1/users/${id}`, { is_verified: true, is_active: true });
      showToast(`✅ ${name} approved successfully`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('Failed to approve user', 'error');
    }
  };

  // ─── Reject ───────────────────────────────────────────────────────────────────
  const confirmReject = async () => {
    if (!rejectId) return;
    const user = users.find(u => u.id === rejectId);
    try {
      await api.put(`/api/v1/users/${rejectId}`, {
        is_verified: false,
        is_active: false,
        ...(rejectReason && { rejection_reason: rejectReason }),
      });
      showToast(`❌ ${user?.full_name} rejected`);
      setRejectId(null);
      setRejectReason('');
      fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('Failed to reject user', 'error');
    }
  };

  // ─── Filtered list ────────────────────────────────────────────────────────────
  const filtered = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);

  const counts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // ─── Field row helper ─────────────────────────────────────────────────────────
  const Field = ({ label, value }) => value ? (
    <div style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      <span style={S.fieldValue}>{value}</span>
    </div>
  ) : null;

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const S = {
    wrapper:    { maxWidth: 900, margin: '0 auto' },
    header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title:      { fontSize: 20, fontWeight: 700, color: '#e8eaf2', margin: 0 },
    refreshBtn: { background: '#1f2840', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13 },

    // Filter tabs
    filters:    { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    filterBtn: (active) => ({
      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: active ? '1.5px solid #e8a020' : '1px solid rgba(255,255,255,0.08)',
      background: active ? 'rgba(232,160,32,0.1)' : '#111621',
      color: active ? '#e8a020' : '#8892a4',
    }),

    loading:    { textAlign: 'center', padding: 40, color: '#545f73' },
    list:       { display: 'flex', flexDirection: 'column', gap: 12 },

    // Card
    card: {
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden',
    },
    cardMain: {
      padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    cardLeft:   { display: 'flex', flexDirection: 'column', gap: 5 },
    nameRow:    { display: 'flex', alignItems: 'center', gap: 10 },
    name:       { fontWeight: 700, fontSize: 15, color: '#e8eaf2' },
    roleBadge: (role) => ({
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: ROLE_COLORS[role]?.bg || 'rgba(255,255,255,0.08)',
      color: ROLE_COLORS[role]?.text || '#fff',
    }),
    meta:       { fontSize: 13, color: '#8892a4' },
    date:       { fontSize: 11, color: '#545f73' },

    cardRight:  { display: 'flex', alignItems: 'center', gap: 8 },
    expandBtn: {
      background: 'none', border: '1px solid rgba(255,255,255,0.08)',
      color: '#8892a4', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
    },
    approveBtn: { background: '#16a34a', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
    rejectBtn:  { background: '#dc2626', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

    // Expanded details
    details: {
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px', background: 'rgba(255,255,255,0.02)',
    },
    detailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
    field:       { display: 'flex', flexDirection: 'column', gap: 2 },
    fieldLabel:  { fontSize: 10, color: '#545f73', textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldValue:  { fontSize: 13, color: '#e8eaf2' },

    // Reject modal
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modal: {
      background: '#181e2d', borderRadius: 14, padding: 28, width: '100%', maxWidth: 400,
      border: '1px solid rgba(255,255,255,0.1)',
    },
    modalTitle: { fontSize: 16, fontWeight: 700, color: '#e8eaf2', marginBottom: 8 },
    modalSub:   { fontSize: 13, color: '#8892a4', marginBottom: 16 },
    textarea: {
      width: '100%', padding: '10px 12px', background: '#111621',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
      color: '#e8eaf2', fontSize: 13, resize: 'vertical', minHeight: 80,
      boxSizing: 'border-box', marginBottom: 16,
    },
    modalBtns:   { display: 'flex', gap: 8, justifyContent: 'flex-end' },
    cancelBtn: {
      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
      color: '#8892a4', padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
    },
    confirmRejectBtn: {
      background: '#dc2626', border: 'none', color: '#fff',
      padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
    },

    // Toast
    toast: (type) => ({
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: type === 'error' ? '#dc2626' : '#16a34a',
      color: '#fff', padding: '12px 20px', borderRadius: 10,
      fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }),

    emptyBox: {
      textAlign: 'center', padding: 60,
      background: '#111621', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
    },
    emptyIcon:  { fontSize: 36, marginBottom: 12 },
    emptyText:  { color: '#545f73', fontSize: 14 },
  };

  // ─── UI output ────────────────────────────────────────────────────────────────
  return (
    <Layout title="Verification">

      {/* Toast */}
      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}

      {/* Reject modal */}
      {rejectId && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalTitle}>Reject User</div>
            <div style={S.modalSub}>
              Rejecting <strong style={{ color: '#e8eaf2' }}>{users.find(u => u.id === rejectId)?.full_name}</strong>.
              Optionally provide a reason:
            </div>
            <textarea
              style={S.textarea}
              placeholder="e.g. Incomplete documents, Invalid licence number..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</button>
              <button style={S.confirmRejectBtn} onClick={confirmReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.wrapper}>

        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>
            Verification Queue
            {users.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 400, color: '#8892a4', marginLeft: 10 }}>
                {users.length} pending
              </span>
            )}
          </h2>
          <button style={S.refreshBtn} onClick={fetchUsers}>🔄 Refresh</button>
        </div>

        {/* Role filters */}
        <div style={S.filters}>
          {['all', 'driver', 'transporter', 'agent', 'customer'].map(r => (
            <button key={r} style={S.filterBtn(filterRole === r)} onClick={() => setFilterRole(r)}>
              {r === 'all' ? `All (${users.length})` : `${ROLE_ICONS[r]} ${r} (${counts[r] || 0})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={S.loading}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={S.emptyBox}>
            <div style={S.emptyIcon}>✅</div>
            <div style={S.emptyText}>
              {users.length === 0 ? 'No pending verifications' : `No pending ${filterRole}s`}
            </div>
          </div>
        ) : (
          <div style={S.list}>
            {filtered.map(u => (
              <div key={u.id} style={S.card}>

                {/* Main row */}
                <div style={S.cardMain}>
                  <div style={S.cardLeft}>
                    <div style={S.nameRow}>
                      <span style={S.name}>{u.full_name}</span>
                      <span style={S.roleBadge(u.role)}>
                        {ROLE_ICONS[u.role]} {u.role}
                      </span>
                    </div>
                    <div style={S.meta}>{u.email}</div>
                    <div style={S.meta}>{u.phone}</div>
                    <div style={S.date}>
                      Registered: {u.created_at ? new Date(u.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </div>

                  <div style={S.cardRight}>
                    <button style={S.expandBtn} onClick={() => setExpanded(expanded === u.id ? null : u.id)}>
                      {expanded === u.id ? '▲ Less' : '▼ Details'}
                    </button>
                    <button style={S.rejectBtn} onClick={() => setRejectId(u.id)}>Reject</button>
                    <button style={S.approveBtn} onClick={() => approveUser(u.id, u.full_name)}>Approve</button>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === u.id && (
                  <div style={S.details}>
                    <div style={S.detailsGrid}>
                      <Field label="National ID"         value={u.national_id} />
                      <Field label="Country"             value={u.country} />
                      <Field label="County"              value={u.county} />
                      <Field label="Company Name"        value={u.company_name} />
                      <Field label="Business Reg No."    value={u.business_reg_no} />
                      <Field label="KRA PIN"             value={u.kra_pin} />
                      <Field label="Driving Licence No." value={u.license_number} />
                      <Field label="Licence Class"       value={u.license_class} />
                      <Field label="Licence Expiry"      value={u.license_expiry} />
                      <Field label="Agency Type"         value={u.agency_type} />
                      <Field label="Emergency Contact"   value={u.emergency_contact} />
                      <Field label="Account Type"        value={u.account_type} />
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}
