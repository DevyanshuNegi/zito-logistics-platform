import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const STATUS_CONFIG = {
  pending:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Pending',     icon: '⏳' },
  assigned:    { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  label: 'Assigned',    icon: '✅' },
  in_transit:  { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)', label: 'In Transit',  icon: '🚛' },
  completed:   { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  label: 'Completed',   icon: '✓'  },
  cancelled:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  label: 'Cancelled',   icon: '✕'  },
};

const FILTER_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'assigned',   label: 'Assigned' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'completed',  label: 'Completed' },
];

export default function Assignments() {
  const [bookings,     setBookings]     = useState([]);
  const [vehicles,     setVehicles]     = useState([]);
  const [drivers,      setDrivers]      = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [search,       setSearch]       = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [assignForm,   setAssignForm]   = useState({ vehicle_id: '', driver_id: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [b, v, d, t] = await Promise.all([
        api.get('/api/v1/bookings'),
        api.get('/api/v1/vehicles'),
        api.get('/api/v1/users?role=driver'),
        api.get('/api/v1/users?role=transporter'),
      ]);
      setBookings(b.data.data     || b.data     || []);
      setVehicles(v.data.data     || v.data     || []);
      setDrivers(d.data.data      || d.data     || []);
      setTransporters(t.data.data || t.data     || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Enrich vehicles with transporter info
  const vehicleMap = {};
  vehicles.forEach(v => {
    const transporter = v.transporter_id
      ? transporters.find(t => t.id === v.transporter_id)
      : null;
    vehicleMap[v.id] = { ...v, transporter };
  });

  const driverMap = {};
  drivers.forEach(d => { driverMap[d.id] = d; });

  const filtered = bookings
    .filter(b => filter === 'all' || b.status === filter)
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.id?.toString().includes(q) ||
        b.customer_name?.toLowerCase().includes(q) ||
        b.pickup_location?.toLowerCase().includes(q) ||
        b.dropoff_location?.toLowerCase().includes(q) ||
        vehicleMap[b.vehicle_id]?.plate_number?.toLowerCase().includes(q) ||
        driverMap[b.driver_id]?.full_name?.toLowerCase().includes(q)
      );
    });

  // Stats
  const stats = {
    total:      bookings.length,
    pending:    bookings.filter(b => b.status === 'pending').length,
    in_transit: bookings.filter(b => b.status === 'in_transit').length,
    completed:  bookings.filter(b => b.status === 'completed').length,
  };

  const openAssign = (booking) => {
    setSelected(booking);
    setAssignForm({ vehicle_id: booking.vehicle_id || '', driver_id: booking.driver_id || '' });
    setShowModal(true);
  };

  const handleAssign = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/bookings/${selected.id}`, {
        vehicle_id: assignForm.vehicle_id || null,
        driver_id:  assignForm.driver_id  || null,
        status: (assignForm.vehicle_id && assignForm.driver_id) ? 'assigned' : selected.status,
      });
      await fetchAll();
      setShowModal(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await api.put(`/api/v1/bookings/${bookingId}`, { status: newStatus });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    } catch (err) { console.error(err); }
  };

  const fmt      = d => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtTime  = d => d ? new Date(d).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '';
  const ksh      = n => n ? `KES ${Number(n).toLocaleString()}` : '—';

  // Available vehicles (not currently assigned to an in-transit booking)
  const busyVehicleIds = new Set(
    bookings.filter(b => b.status === 'in_transit').map(b => b.vehicle_id).filter(Boolean)
  );
  const availableVehicles = vehicles.filter(v => !busyVehicleIds.has(v.id));

  return (
    <Layout>
      {/* Header */}
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Trip Assignments</div>
          <div style={s.sectionSub}>Assign drivers & vehicles to bookings</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input style={s.search} placeholder="Search bookings, plates, drivers..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Stat cards */}
      <div style={s.statsGrid}>
        {[
          { label: 'Total Trips',  value: stats.total,      color: '#e8a020', icon: '📋' },
          { label: 'Pending',      value: stats.pending,    color: '#f59e0b', icon: '⏳' },
          { label: 'In Transit',   value: stats.in_transit, color: '#2dd4bf', icon: '🚛' },
          { label: 'Completed',    value: stats.completed,  color: '#22c55e', icon: '✓'  },
        ].map(c => (
          <div key={c.label} style={s.statCard}>
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#8892a4', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div style={s.tabs}>
            {FILTER_TABS.map(t => {
              const cnt = t.key === 'all' ? bookings.length : bookings.filter(b => b.status === t.key).length;
              const cfg = STATUS_CONFIG[t.key];
              return (
                <button key={t.key}
                  style={{ ...s.tab, ...(filter === t.key ? { ...s.tabActive, borderColor: cfg?.color || '#e8a020', color: cfg?.color || '#e8a020' } : {}) }}
                  onClick={() => setFilter(t.key)}>
                  {t.label}
                  <span style={{ ...s.tabBadge, ...(filter === t.key ? { background: cfg?.color || '#e8a020', color: '#000' } : {}) }}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>BOOKING</th>
                <th style={s.th}>CUSTOMER</th>
                <th style={s.th}>ROUTE</th>
                <th style={s.th}>VEHICLE</th>
                <th style={s.th}>DRIVER</th>
                <th style={s.th}>TRANSPORTER</th>
                <th style={s.th}>DATE</th>
                <th style={s.th}>AMOUNT</th>
                <th style={s.th}>STATUS</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={s.emptyCell}>Loading assignments...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={s.emptyCell}>
                  <div style={s.emptyState}>
                    <div style={{ fontSize: 40, opacity: 0.25 }}>📋</div>
                    <div style={{ fontSize: 14, color: '#8892a4' }}>No {filter !== 'all' ? filter.replace('_', ' ') : ''} bookings found</div>
                  </div>
                </td></tr>
              ) : filtered.map(b => {
                const vehicle     = vehicleMap[b.vehicle_id];
                const driver      = driverMap[b.driver_id];
                const transporter = vehicle?.transporter;
                const cfg         = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                const needsAssign = !b.vehicle_id || !b.driver_id;

                return (
                  <tr key={b.id} style={{ ...s.tr, ...(needsAssign && b.status === 'pending' ? { background: 'rgba(245,158,11,0.03)' } : {}) }}>

                    {/* Booking ID */}
                    <td style={s.td}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#e8a020', fontFamily: 'monospace' }}>
                        #{String(b.id).padStart(4, '0')}
                      </div>
                      {b.booking_type && <div style={{ fontSize: 10, color: '#545f73', textTransform: 'uppercase', letterSpacing: 0.5 }}>{b.booking_type}</div>}
                    </td>

                    {/* Customer */}
                    <td style={s.td}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: '#e8eaf2' }}>{b.customer_name || b.customer?.full_name || '—'}</div>
                      {b.customer?.phone && <div style={{ fontSize: 11, color: '#545f73' }}>{b.customer.phone}</div>}
                    </td>

                    {/* Route */}
                    <td style={{ ...s.td, maxWidth: 180 }}>
                      <div style={{ fontSize: 12, color: '#e8eaf2' }}>
                        <span style={{ color: '#22c55e' }}>▲</span> {b.pickup_location || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8892a4', marginTop: 2 }}>
                        <span style={{ color: '#ef4444' }}>▼</span> {b.dropoff_location || '—'}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td style={s.td}>
                      {vehicle ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf2', fontFamily: 'monospace', letterSpacing: 1 }}>
                            {vehicle.plate_number}
                          </div>
                          <div style={{ fontSize: 11, color: '#545f73' }}>{vehicle.make} {vehicle.model}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ Unassigned</span>
                      )}
                    </td>

                    {/* Driver */}
                    <td style={s.td}>
                      {driver ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, color: '#e8eaf2' }}>{driver.full_name}</div>
                          <div style={{ fontSize: 11, color: '#545f73' }}>{driver.phone}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ Unassigned</span>
                      )}
                    </td>

                    {/* Transporter — KEY NEW COLUMN */}
                    <td style={s.td}>
                      {transporter ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>🏭</span>
                            <div style={{ fontWeight: 600, fontSize: 12, color: '#2dd4bf' }}>
                              {transporter.company_name || transporter.full_name}
                            </div>
                          </div>
                          {transporter.phone && <div style={{ fontSize: 11, color: '#545f73', marginTop: 2 }}>{transporter.phone}</div>}
                        </div>
                      ) : vehicle?.ownership_type === 'vg_owned' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11 }}>🏢</span>
                          <span style={{ fontSize: 11, color: '#e8a020', fontWeight: 600 }}>VG Owned</span>
                        </div>
                      ) : b.vehicle_id ? (
                        <span style={{ fontSize: 11, color: '#545f73' }}>—</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#545f73' }}>—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ ...s.td, fontSize: 12 }}>
                      <div style={{ color: '#e8eaf2' }}>{fmt(b.pickup_date || b.created_at)}</div>
                      <div style={{ color: '#545f73' }}>{fmtTime(b.pickup_date || b.created_at)}</div>
                    </td>

                    {/* Amount */}
                    <td style={{ ...s.td, fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                      {ksh(b.amount || b.total_amount)}
                    </td>

                    {/* Status */}
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: cfg.bg, color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={s.td}>
                      <div style={s.actionBtns}>
                        <button style={{ ...s.btnSm, color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)' }}
                          onClick={() => openAssign(b)}>
                          {needsAssign ? '⚡ Assign' : '✏ Edit'}
                        </button>
                        {b.status === 'assigned' && (
                          <button style={{ ...s.btnSm, color: '#2dd4bf', borderColor: 'rgba(45,212,191,0.3)' }}
                            onClick={() => handleStatusChange(b.id, 'in_transit')}>
                            ▶ Start
                          </button>
                        )}
                        {b.status === 'in_transit' && (
                          <button style={{ ...s.btnSm, color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}
                            onClick={() => handleStatusChange(b.id, 'completed')}>
                            ✓ Done
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
      </div>

      {/* ── ASSIGN MODAL ───────────────────────────────────────── */}
      {showModal && selected && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>⚡ Assign Trip #{String(selected.id).padStart(4, '0')}</span>
              <button style={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>

              {/* Route summary */}
              <div style={s.routeCard}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 3 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <div style={{ width: 2, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e8eaf2', fontWeight: 500 }}>{selected.pickup_location || 'Pickup TBD'}</div>
                    <div style={{ height: 16 }} />
                    <div style={{ fontSize: 13, color: '#e8eaf2', fontWeight: 500 }}>{selected.dropoff_location || 'Dropoff TBD'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{ksh(selected.amount || selected.total_amount)}</div>
                    <div style={{ fontSize: 11, color: '#545f73' }}>{fmt(selected.pickup_date)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#8892a4' }}>
                  Customer: <span style={{ color: '#e8eaf2', fontWeight: 500 }}>{selected.customer_name || selected.customer?.full_name || '—'}</span>
                </div>
              </div>

              {/* Vehicle select */}
              <div style={s.formGroup}>
                <label style={s.label}>Vehicle</label>
                <select style={s.input} value={assignForm.vehicle_id}
                  onChange={e => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}>
                  <option value="">— Select vehicle —</option>
                  {availableVehicles.map(v => {
                    const tp = transporters.find(t => t.id === v.transporter_id);
                    const owner = v.ownership_type === 'vg_owned'
                      ? '🏢 VG Owned'
                      : tp ? `🏭 ${tp.company_name || tp.full_name}` : '🔧 Contracted';
                    return (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} — {v.make} {v.model} ({owner})
                      </option>
                    );
                  })}
                </select>
                {assignForm.vehicle_id && (() => {
                  const v = vehicleMap[assignForm.vehicle_id];
                  const tp = v?.transporter;
                  if (!v) return null;
                  return (
                    <div style={s.vehiclePreview}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#e8a020', fontWeight: 700, fontFamily: 'monospace' }}>{v.plate_number}</span>
                        <span style={{ color: '#8892a4', fontSize: 11 }}>{v.make} {v.model}</span>
                      </div>
                      {tp && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>🏭</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#2dd4bf' }}>{tp.company_name || tp.full_name}</div>
                            <div style={{ fontSize: 11, color: '#545f73' }}>Transporter · {tp.phone || 'No phone'}</div>
                          </div>
                        </div>
                      )}
                      {v.ownership_type === 'vg_owned' && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#e8a020', fontWeight: 600 }}>🏢 VG Global Owned Vehicle</div>
                      )}
                      <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 11, color: '#545f73' }}>
                        <span>GVW: {v.gvw || '—'} kg</span>
                        <span>Type: {v.vehicle_type || '—'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Driver select */}
              <div style={s.formGroup}>
                <label style={s.label}>Driver</label>
                <select style={s.input} value={assignForm.driver_id}
                  onChange={e => setAssignForm({ ...assignForm, driver_id: e.target.value })}>
                  <option value="">— Select driver —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} {d.phone ? `— ${d.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={s.formRow}>
                <button style={s.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
                <button style={s.btnConfirm} disabled={saving} onClick={handleAssign}>
                  {saving ? 'Saving...' : '✓ Confirm Assignment'}
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
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontWeight: 700, fontSize: 18, color: '#e8eaf2', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#8892a4' },
  search: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 12px', color: '#e8eaf2', fontSize: 13, width: 260, outline: 'none' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  panel: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  tabs: { display: 'flex', gap: 4 },
  tab: { background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '5px 12px', color: '#8892a4', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  tabActive: { background: '#1f2840' },
  tabBadge: { background: '#181e2d', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: '#545f73' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', fontSize: 11, color: '#545f73', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600, whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  emptyCell: { padding: '48px', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  actionBtns: { display: 'flex', gap: 5, flexWrap: 'nowrap' },
  btnSm: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#8892a4', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, width: '95%', maxWidth: 460 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  modalTitle: { fontWeight: 600, fontSize: 15, color: '#e8eaf2' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: 20 },
  routeCard: { background: '#0a0d14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 18 },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '9px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  vehiclePreview: { marginTop: 8, background: '#0a0d14', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, padding: '10px 12px' },
  btnCancel: { padding: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 11, background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};