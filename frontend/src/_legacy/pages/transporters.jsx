import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const typeIcons = { motorcycle: '🏍️', van: '🚐', pickup: '🛻', truck: '🚛', articulated: '🚚' };

export default function Transporters() {
  const [transporters, setTransporters] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailView, setDetailView] = useState('fleet'); // 'fleet' | 'trips' | 'earnings'
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: 'Transporter@123', company_name: '', kra_pin: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/users?role=transporter'),
      api.get('/api/v1/vehicles'),
      api.get('/api/v1/bookings'),
    ]).then(([u, v, b]) => {
      setTransporters(u.data.data || []);
      setVehicles(v.data.data || []);
      setBookings(b.data.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const transporterVehicles = (id) => vehicles.filter(v => v.owner_user_id === id);
  const transporterTrips = (id) => {
    const vids = transporterVehicles(id).map(v => v.id);
    return bookings.filter(b => vids.includes(b.vehicle_id));
  };
  const transporterEarnings = (id) => {
    return transporterTrips(id)
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (parseFloat(b.final_fare) || 0), 0);
  };

  const totalFleet = vehicles.filter(v => v.ownership_type === 'contracted').length;
  const totalEarnings = transporters.reduce((sum, t) => sum + transporterEarnings(t.id), 0);

  const openDetail = (t) => {
    setSelected(t);
    setDetailView('fleet');
    setShowModal(true);
  };

  const handleAdd = async () => {
    if (!form.full_name || !form.email || !form.phone) {
      setSubmitError('Name, email and phone are required.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post('/api/v1/auth/register', {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: 'transporter',
      });
      setTransporters(prev => [res.data.data?.user || res.data.data, ...prev]);
      setShowAddModal(false);
      setForm({ full_name: '', email: '', phone: '', password: 'Transporter@123', company_name: '', kra_pin: '' });
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || 'Failed to register transporter.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    pending:    { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    assigned:   { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
    in_transit: { bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf' },
    completed:  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
    cancelled:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  };

  return (
    <Layout title="Transporters">
      <div style={s.header}>
        <div>
          <div style={s.title}>Transporters / Fleet Owners</div>
          <div style={s.sub}>Companies and individuals who provide contracted trucks to ZITO (VG Global Logistics)</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { setSubmitError(''); setShowAddModal(true); }}>
          + Register Transporter
        </button>
      </div>

      {/* STATS */}
      <div style={s.statGrid}>
        {[
          { label: 'TRANSPORTERS',    color: '#6366f1', icon: '🏭', val: transporters.length },
          { label: 'CONTRACTED FLEET', color: '#2dd4bf', icon: '🚛', val: totalFleet },
          { label: 'VERIFIED',         color: '#22c55e', icon: '✅', val: transporters.filter(t => t.is_verified).length },
          { label: 'TOTAL EARNINGS',   color: '#e8a020', icon: '💰', val: `KES ${totalEarnings.toLocaleString()}` },
        ].map((stat, i) => (
          <div key={i} style={{ ...s.statCard, borderTop: `2px solid ${stat.color}` }}>
            <div style={s.statIcon}>{stat.icon}</div>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={{ ...s.statVal, color: stat.color }}>{loading ? '—' : stat.val}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS BANNER */}
      <div style={s.infoBanner}>
        <div style={s.infoItem}>🚛 <strong>Transporter</strong> registers and provides trucks</div>
        <div style={s.infoArrow}>→</div>
        <div style={s.infoItem}>✅ <strong>Admin</strong> verifies and links vehicles to their account</div>
        <div style={s.infoArrow}>→</div>
        <div style={s.infoItem}>📋 <strong>VG</strong> assigns trips to their trucks</div>
        <div style={s.infoArrow}>→</div>
        <div style={s.infoItem}>💰 <strong>Transporter</strong> earns per completed trip</div>
      </div>

      {/* TRANSPORTERS GRID */}
      {loading ? (
        <div style={s.loadingBox}>Loading transporters...</div>
      ) : transporters.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#8892a4' }}>No transporters registered yet</div>
          <div style={{ fontSize: 13, color: '#545f73', marginTop: 6 }}>Click "+ Register Transporter" to add one</div>
        </div>
      ) : (
        <div style={s.grid}>
          {transporters.map(t => {
            const tvehicles = transporterVehicles(t.id);
            const ttrips = transporterTrips(t.id);
            const tearnings = transporterEarnings(t.id);
            const activeTrips = ttrips.filter(b => b.status === 'in_transit').length;
            const completedTrips = ttrips.filter(b => b.status === 'completed').length;

            // vehicle type breakdown
            const typeCount = {};
            tvehicles.forEach(v => { typeCount[v.vehicle_type] = (typeCount[v.vehicle_type] || 0) + 1; });

            return (
              <div key={t.id} style={s.card} onClick={() => openDetail(t)}>
                {/* CARD HEADER */}
                <div style={s.cardHeader}>
                  <div style={s.cardAvatar}>{t.full_name?.charAt(0) || '?'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.cardName}>{t.full_name}</div>
                    <div style={s.cardEmail}>{t.email}</div>
                    <div style={s.cardPhone}>{t.phone}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ ...s.badge, ...(t.is_verified ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' } : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }) }}>
                      {t.is_verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                    {!t.is_active && (
                      <span style={{ ...s.badge, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Inactive</span>
                    )}
                  </div>
                </div>

                {/* FLEET SUMMARY */}
                <div style={s.fleetRow}>
                  <div style={s.fleetStat}>
                    <div style={{ ...s.fleetNum, color: '#2dd4bf' }}>{tvehicles.length}</div>
                    <div style={s.fleetLabel}>Trucks</div>
                  </div>
                  <div style={s.fleetStat}>
                    <div style={{ ...s.fleetNum, color: '#818cf8' }}>{activeTrips}</div>
                    <div style={s.fleetLabel}>On Trip</div>
                  </div>
                  <div style={s.fleetStat}>
                    <div style={{ ...s.fleetNum, color: '#22c55e' }}>{completedTrips}</div>
                    <div style={s.fleetLabel}>Completed</div>
                  </div>
                  <div style={s.fleetStat}>
                    <div style={{ ...s.fleetNum, color: '#e8a020', fontSize: 13 }}>
                      {tearnings > 0 ? `${(tearnings / 1000).toFixed(0)}K` : '—'}
                    </div>
                    <div style={s.fleetLabel}>Earned</div>
                  </div>
                </div>

                {/* VEHICLE TYPES */}
                {Object.keys(typeCount).length > 0 && (
                  <div style={s.typeRow}>
                    {Object.entries(typeCount).map(([type, count]) => (
                      <div key={type} style={s.typeChip}>
                        {typeIcons[type] || '🚗'} {count} {type}
                      </div>
                    ))}
                  </div>
                )}

                <div style={s.cardFooter}>
                  <span style={{ fontSize: 11, color: '#545f73' }}>
                    Joined {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>View Details →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showModal && selected && (() => {
        const tvehicles = transporterVehicles(selected.id);
        const ttrips = transporterTrips(selected.id);
        const tearnings = transporterEarnings(selected.id);
        return (
          <div style={s.overlay} onClick={() => setShowModal(false)}>
            <div style={s.bigModal} onClick={e => e.stopPropagation()}>
              {/* MODAL HEADER */}
              <div style={s.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ ...s.cardAvatar, width: 48, height: 48, fontSize: 20 }}>{selected.full_name?.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17, color: '#e8eaf2' }}>{selected.full_name}</div>
                    <div style={{ fontSize: 12, color: '#8892a4' }}>{selected.email} · {selected.phone}</div>
                  </div>
                </div>
                <button style={s.closeBtn} onClick={() => setShowModal(false)}>✕</button>
              </div>

              {/* SUMMARY ROW */}
              <div style={s.summaryRow}>
                {[
                  { label: 'Total Trucks', val: tvehicles.length, color: '#2dd4bf' },
                  { label: 'Total Trips', val: ttrips.length, color: '#818cf8' },
                  { label: 'Completed', val: ttrips.filter(b => b.status === 'completed').length, color: '#22c55e' },
                  { label: 'Total Earned', val: `KES ${tearnings.toLocaleString()}`, color: '#e8a020' },
                ].map((s2, i) => (
                  <div key={i} style={s.summaryBox}>
                    <div style={{ fontSize: 11, color: '#545f73', marginBottom: 4 }}>{s2.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: s2.color }}>{s2.val}</div>
                  </div>
                ))}
              </div>

              {/* SUB TABS */}
              <div style={s.subTabs}>
                {['fleet', 'trips', 'earnings'].map(v => (
                  <button key={v} style={{ ...s.subTab, ...(detailView === v ? s.subTabActive : {}) }}
                    onClick={() => setDetailView(v)}>
                    {v === 'fleet' ? '🚛 Fleet' : v === 'trips' ? '📋 Trips' : '💰 Earnings'}
                  </button>
                ))}
              </div>

              <div style={s.modalBody}>
                {/* FLEET TAB */}
                {detailView === 'fleet' && (
                  tvehicles.length === 0 ? (
                    <div style={s.emptyTab}>No vehicles linked to this transporter yet.<br/>Go to Fleet page to assign vehicles.</div>
                  ) : (
                    <div style={s.vehicleGrid}>
                      {tvehicles.map(v => (
                        <div key={v.id} style={s.vehicleCard}>
                          <div style={s.vehicleIcon}>{typeIcons[v.vehicle_type] || '🚗'}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf2' }}>
                              {v.make} {v.model} {v.year}
                            </div>
                            <div style={{ fontSize: 11, color: '#8892a4', fontFamily: 'monospace' }}>{v.plate_number}</div>
                            <div style={{ fontSize: 11, color: '#545f73', textTransform: 'capitalize' }}>{v.vehicle_type}</div>
                          </div>
                          <span style={{
                            ...s.badge,
                            ...(v.is_active ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                              : { background: 'rgba(239,68,68,0.15)', color: '#ef4444' })
                          }}>
                            {v.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* TRIPS TAB */}
                {detailView === 'trips' && (
                  ttrips.length === 0 ? (
                    <div style={s.emptyTab}>No trips recorded for this transporter's vehicles.</div>
                  ) : (
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {['REF', 'PICKUP', 'DELIVERY', 'FARE', 'STATUS', 'DATE'].map(h => (
                            <th key={h} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ttrips.slice(0, 20).map(b => {
                          const sc = statusColors[b.status] || { bg: 'rgba(255,255,255,0.05)', color: '#8892a4' };
                          return (
                            <tr key={b.id} style={s.tr}>
                              <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11 }}>{b.reference}</td>
                              <td style={{ ...s.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.pickup_address}</td>
                              <td style={{ ...s.td, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.delivery_address}</td>
                              <td style={{ ...s.td, color: '#22c55e', fontWeight: 600 }}>
                                {b.final_fare ? `KES ${parseFloat(b.final_fare).toLocaleString()}` : b.estimated_fare ? `~KES ${parseFloat(b.estimated_fare).toLocaleString()}` : '—'}
                              </td>
                              <td style={s.td}><span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{b.status}</span></td>
                              <td style={{ ...s.td, fontSize: 11, color: '#8892a4' }}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                )}

                {/* EARNINGS TAB */}
                {detailView === 'earnings' && (
                  <div>
                    <div style={s.earningsGrid}>
                      {[
                        { label: 'Total Earned', val: `KES ${tearnings.toLocaleString()}`, color: '#e8a020', icon: '💰' },
                        { label: 'Completed Trips', val: ttrips.filter(b => b.status === 'completed').length, color: '#22c55e', icon: '✅' },
                        { label: 'Active Trucks', val: tvehicles.filter(v => v.is_active).length, color: '#2dd4bf', icon: '🚛' },
                        { label: 'Avg Per Trip', val: ttrips.filter(b => b.status === 'completed').length > 0 ? `KES ${Math.round(tearnings / ttrips.filter(b => b.status === 'completed').length).toLocaleString()}` : '—', color: '#818cf8', icon: '📊' },
                      ].map((e, i) => (
                        <div key={i} style={{ ...s.earningBox, borderTop: `2px solid ${e.color}` }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>{e.icon}</div>
                          <div style={{ fontSize: 11, color: '#545f73', marginBottom: 4 }}>{e.label}</div>
                          <div style={{ fontWeight: 700, fontSize: 20, color: e.color }}>{e.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '16px 20px', fontSize: 13, color: '#545f73', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8 }}>
                      💡 Earnings are calculated from completed trips assigned to this transporter's vehicles. Payment settlements are managed through the Payments page.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ADD TRANSPORTER MODAL ── */}
      {showAddModal && (
        <div style={s.overlay} onClick={() => setShowAddModal(false)}>
          <div style={{ ...s.bigModal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#e8eaf2' }}>Register Transporter</div>
                <div style={{ fontSize: 12, color: '#8892a4' }}>Add a new fleet owner / transport company</div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={s.infoNote}>
                🚛 Transporters only provide trucks — they don't book trips. After registration, link their vehicles in the Fleet page.
              </div>
              {[
                { label: 'Full Name / Company Name *', key: 'full_name', placeholder: 'e.g. Kamau Transport Ltd' },
                { label: 'Email Address *', key: 'email', placeholder: 'e.g. kamau@transport.co.ke' },
                { label: 'Phone Number *', key: 'phone', placeholder: 'e.g. +254712345678' },
                { label: 'KRA PIN', key: 'kra_pin', placeholder: 'e.g. A123456789B' },
                { label: 'Temporary Password', key: 'password', placeholder: 'Default: Transporter@123' },
              ].map(field => (
                <div key={field.key} style={s.formGroup}>
                  <label style={s.label}>{field.label}</label>
                  <input style={s.input} placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))} />
                </div>
              ))}
              {submitError && <div style={s.errorBox}>⚠️ {submitError}</div>}
              <div style={s.modalActions}>
                <button style={s.btnCancel} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button style={{ ...s.btnConfirm, opacity: submitting ? 0.6 : 1 }}
                  onClick={handleAdd} disabled={submitting}>
                  {submitting ? 'Registering...' : '✓ Register Transporter'}
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontWeight: 700, fontSize: 18, color: '#e8eaf2', marginBottom: 4 },
  sub: { fontSize: 13, color: '#8892a4' },
  btnPrimary: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', position: 'relative', overflow: 'hidden' },
  statIcon: { position: 'absolute', right: 14, top: 14, fontSize: 22, opacity: 0.12 },
  statLabel: { fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  statVal: { fontWeight: 800, fontSize: 24 },
  infoBanner: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  infoItem: { fontSize: 12, color: '#8892a4' },
  infoArrow: { color: '#545f73', fontSize: 14 },
  loadingBox: { textAlign: 'center', padding: 48, color: '#8892a4' },
  emptyBox: { textAlign: 'center', padding: 64, background: '#111621', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 },
  card: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', gap: 12 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  cardAvatar: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  cardName: { fontWeight: 600, fontSize: 14, color: '#e8eaf2', marginBottom: 2 },
  cardEmail: { fontSize: 11, color: '#8892a4' },
  cardPhone: { fontSize: 11, color: '#545f73' },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  fleetRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#181e2d', borderRadius: 8, padding: '10px 0' },
  fleetStat: { textAlign: 'center' },
  fleetNum: { fontWeight: 700, fontSize: 18 },
  fleetLabel: { fontSize: 10, color: '#545f73', marginTop: 2 },
  typeRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  typeChip: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#8892a4' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' },
  // MODAL
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  bigModal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  closeBtn: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  summaryBox: { background: '#111621', padding: '14px 18px', textAlign: 'center' },
  subTabs: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 },
  subTab: { flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '12px', color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  subTabActive: { color: '#e8eaf2', borderBottomColor: '#6366f1', fontWeight: 600 },
  modalBody: { flex: 1, overflowY: 'auto' },
  emptyTab: { padding: 40, textAlign: 'center', color: '#545f73', fontSize: 13, lineHeight: 1.8 },
  vehicleGrid: { display: 'flex', flexDirection: 'column', gap: 1 },
  vehicleCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
  vehicleIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 11, color: '#545f73', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '10px 16px', fontSize: 13, color: '#e8eaf2' },
  earningsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.05)' },
  earningBox: { background: '#111621', padding: '20px 16px', textAlign: 'center' },
  // FORM
  infoNote: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#8892a4', marginBottom: 16 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '10px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  modalActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  btnCancel: { padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 12, background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};