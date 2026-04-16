// driver-view.jsx — Admin "View as Driver" portal — PRD Section 5.4
import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

/* ─── colours ────────────────────────────────────────────────────────────── */
const C = {
  bg:'#0f121c', card:'#111621', card2:'#181e2d',
  border:'rgba(255,255,255,0.07)', borderHov:'rgba(255,255,255,0.13)',
  text:'#e8eaf2', muted:'#8892a4', faint:'#545f73',
  primary:'#e8a020', success:'#22c55e', danger:'#ef4444',
  warning:'#f59e0b', info:'#0ea5e9', teal:'#2dd4bf',
};

const STATUS = {
  pending:         { color:'#f59e0b', bg:'rgba(245,158,11,0.12)',  label:'Pending'         },
  broadcasted:     { color:'#8b5cf6', bg:'rgba(139,92,246,0.12)',  label:'Broadcasted'     },
  approved:        { color:'#0ea5e9', bg:'rgba(14,165,233,0.12)',  label:'Approved'        },
  assigned:        { color:'#6366f1', bg:'rgba(99,102,241,0.12)',  label:'Assigned'        },
  accepted:        { color:'#8b5cf6', bg:'rgba(139,92,246,0.12)',  label:'Accepted'        },
  picked_up:       { color:'#f97316', bg:'rgba(249,115,22,0.12)',  label:'Picked Up'       },
  in_transit:      { color:'#2dd4bf', bg:'rgba(45,212,191,0.12)', label:'In Transit'      },
  delivered:       { color:'#22c55e', bg:'rgba(34,197,94,0.12)',  label:'Delivered'       },
  payment_pending: { color:'#f59e0b', bg:'rgba(245,158,11,0.12)', label:'Payment Pending' },
  completed:       { color:'#22c55e', bg:'rgba(34,197,94,0.10)',  label:'Completed'       },
  cancelled:       { color:'#ef4444', bg:'rgba(239,68,68,0.12)',  label:'Cancelled'       },
  rejected:        { color:'#ef4444', bg:'rgba(239,68,68,0.10)',  label:'Rejected'        },
};

const NEXT_STATUS = {
  assigned:  { to:'accepted',   label:'Accept Trip',    color:C.success },
  accepted:  { to:'picked_up',  label:'Mark Picked Up', color:C.info    },
  picked_up: { to:'in_transit', label:'Start Transit',  color:C.teal    },
  in_transit:{ to:'delivered',  label:'Mark Delivered', color:C.success },
};

const EXPENSE_TYPES = ['toll','fuel','food','loading','unloading','waiting','emergency','other'];

const DOC_FIELDS = [
  { key:'license_verified',           label:'Driving License'      },
  { key:'kra_pin_verified',            label:'KRA PIN'              },
  { key:'police_clearance_verified',   label:'Police Clearance'     },
  { key:'medical_verified',            label:'Medical Certificate'  },
  { key:'ntsa_verified',               label:'NTSA Validation'      },
  { key:'contract_signed',             label:'Driver Contract'      },
  { key:'oath_signed',                 label:'Driver Oath'          },
  { key:'sop_signed',                  label:'SOP Agreement'        },
];

const fmt = v => Number(v||0).toLocaleString();

/* ─── StatusBadge ─────────────────────────────────────────────────────────── */
function Badge({ status }){
  const cfg = STATUS[status] || { color:C.muted, bg:'rgba(148,163,184,0.1)', label: status||'—' };
  return (
    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
      letterSpacing:0.3, backgroundColor:cfg.bg, color:cfg.color, whiteSpace:'nowrap' }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

/* ─── Driver Picker ───────────────────────────────────────────────────────── */
function DriverPicker({ onSelect }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get('/api/v1/users?role=driver&limit=200')
      .then(r => setDrivers(r.data?.data || r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.full_name||'').toLowerCase().includes(q) ||
           (d.email||'').toLowerCase().includes(q) ||
           (d.phone||'').toLowerCase().includes(q);
  });

  return (
    <div style={{ display:'flex', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:480, background:C.card, borderRadius:20,
        padding:24, border:`1px solid ${C.border}` }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'rgba(45,212,191,0.12)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:32, margin:'0 auto 12px' }}>🚛</div>
          <div style={{ fontWeight:800, fontSize:20, color:C.text }}>View as Driver</div>
          <div style={{ fontSize:12, color:C.faint, marginTop:4 }}>
            Select a driver to preview their portal
          </div>
        </div>
        <input
          style={{ width:'100%', padding:'10px 14px', background:C.card2, border:`1px solid ${C.border}`,
            borderRadius:10, color:C.text, fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:12 }}
          placeholder="Search by name, email or phone…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div style={{ maxHeight:480, overflowY:'auto' }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:32, color:C.faint }}>Loading drivers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:C.faint }}>No drivers found</div>
          ) : filtered.map(d => {
            const compliance = d.driverProfile?.compliance_status || 'pending';
            const cc = compliance==='approved' ? C.success : compliance==='rejected' ? C.danger : C.warning;
            const initials = (d.full_name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            return (
              <div key={d.id} onClick={() => onSelect(d)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:12,
                  borderRadius:10, background:C.card2, marginBottom:6,
                  cursor:'pointer', border:`1px solid ${C.border}`,
                  transition:'border-color 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.borderHov}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >
                <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(45,212,191,0.1)',
                  color:C.teal, display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:800, fontSize:15, flexShrink:0 }}>{initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.text }}>{d.full_name}</div>
                  <div style={{ fontSize:11, color:C.faint, marginTop:1 }}>{d.email} · {d.phone}</div>
                </div>
                <div style={{ padding:'3px 8px', borderRadius:12, fontSize:10, fontWeight:700,
                  background: cc+'18', color: cc, border:`1px solid ${cc}44` }}>
                  {compliance.replace('_',' ').toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Driver Portal ─────────────────────────────────────────────────── */
function DriverPortal({ driver, onSwitch }) {

  const [tab, setTab]               = useState('trips');
  const [bookings, setBookings]     = useState([]);
  const [profile,  setProfile]      = useState(null);
  const [loading,  setLoading]      = useState(true);
  const [filter,   setFilter]       = useState('active');
  const [detailBk, setDetailBk]     = useState(null);
  const [expModal,  setExpModal]    = useState(false);
  const [expense,   setExpense]     = useState({ type:'toll', amount:'', description:'' });
  const [saving,    setSaving]      = useState(false);
  const [toast,     setToast]       = useState(null);

  const showToast = (msg, ok=true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        api.get(`/api/v1/admin/bookings?driver_id=${driver.id}&limit=100`).catch(() =>
          api.get(`/api/v1/bookings?assigned_driver_id=${driver.id}`)
        ),
        api.get(`/api/v1/driver/profile?userId=${driver.id}`).catch(() =>
          api.get(`/api/v1/drivers/user/${driver.id}`).catch(() => null)
        ),
      ]);
      setBookings(bRes.data?.data || bRes.data || []);
      setProfile(pRes?.data?.data || pRes?.data || null);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (driver?.id) load(); }, [driver]);

  const updateStatus = async (booking, newStatus) => {
    if (booking.sos_freeze) { showToast('Booking is SOS-frozen. Contact admin.', false); return; }
    setSaving(true);
    try {
      await api.patch(`/api/v1/admin/bookings/${booking.id}/status`, { status: newStatus });
      showToast(`Status updated → ${newStatus.replace(/_/g,' ')}`);
      load();
      setDetailBk(prev => prev?.id === booking.id ? { ...prev, status: newStatus } : prev);
    } catch(e){ showToast(e.response?.data?.error?.message || e.message, false); }
    finally { setSaving(false); }
  };

  const submitExpense = async () => {
    if (!expense.amount || !detailBk) return;
    setSaving(true);
    try {
      await api.post('/api/v1/trip-charges', {
        trip_id: detailBk.id, charge_type: expense.type,
        amount: parseFloat(expense.amount), description: expense.description,
      });
      showToast('Expense submitted for admin approval.');
      setExpModal(false);
      setExpense({ type:'toll', amount:'', description:'' });
    } catch(e){ showToast(e.response?.data?.error?.message || e.message, false); }
    finally { setSaving(false); }
  };

  /* ── derived data ── */
  const ACTIVE = ['assigned','accepted','picked_up','in_transit'];
  const active  = bookings.filter(b => ACTIVE.includes(b.status));
  const history = bookings.filter(b => ['delivered','completed','cancelled','rejected'].includes(b.status));
  const displayed = filter === 'active' ? active : history;

  const completed = bookings.filter(b => b.status === 'completed');
  const totalEarnings = completed.reduce((s,b) => s + parseFloat(b.hire_rate||0), 0);
  const now = new Date();
  const thisMonthEarnings = completed
    .filter(b => { const d=new Date(b.created_at); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); })
    .reduce((s,b) => s + parseFloat(b.hire_rate||0), 0);
  const thisWeekEarnings = completed
    .filter(b => (now - new Date(b.created_at)) <= 7*86400000)
    .reduce((s,b) => s + parseFloat(b.hire_rate||0), 0);

  const dr = profile?.driver || profile;
  const compliance = dr?.compliance_status || 'pending';
  const compColor  = compliance==='approved' ? C.success : compliance==='rejected' ? C.danger : C.warning;

  const TABS = [
    { key:'trips',    label:'📋 Trips',    count: active.length },
    { key:'earnings', label:'💰 Earnings' },
    { key:'profile',  label:'👤 Profile'  },
  ];

  return (
    <div style={{ position:'relative' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:24, zIndex:9999,
          background: toast.ok ? C.success : C.danger,
          color:'#fff', padding:'10px 18px', borderRadius:10,
          fontWeight:600, fontSize:13, boxShadow:'0 4px 16px rgba(0,0,0,0.4)' }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Admin Preview Banner */}
      <div style={{ background:'rgba(45,212,191,0.06)', border:'1px solid rgba(45,212,191,0.2)',
        borderRadius:10, padding:'10px 16px', marginBottom:20,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:13, color:C.teal }}>
          👁 Viewing as <strong>{driver.full_name}</strong>
          <span style={{ color:C.faint, marginLeft:8 }}>{driver.email}</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load}
            style={{ background:'transparent', border:`1px solid rgba(45,212,191,0.3)`,
              color:C.teal, borderRadius:8, padding:'4px 14px', cursor:'pointer', fontSize:12 }}>
            ↻ Refresh
          </button>
          <button onClick={onSwitch}
            style={{ background:'transparent', border:`1px solid rgba(45,212,191,0.3)`,
              color:C.teal, borderRadius:8, padding:'4px 14px', cursor:'pointer', fontSize:12 }}>
            ⇄ Switch Driver
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 18px', borderRadius:10, fontSize:13, fontWeight:600,
              cursor:'pointer', border:'none',
              background: tab===t.key ? C.primary : C.card2,
              color: tab===t.key ? C.bg : C.muted }}>
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:40, color:C.faint }}>Loading…</div>}

      {/* ══════════════ TRIPS TAB ══════════════ */}
      {!loading && tab === 'trips' && (
        <div>
          {/* Sub-filter */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {[['active',`Active (${active.length})`],['history',`History (${history.length})`]].map(([k,l]) => (
              <button key={k} onClick={()=>setFilter(k)}
                style={{ padding:'7px 18px', borderRadius:20, fontSize:12, fontWeight:600,
                  cursor:'pointer', border:`1px solid ${filter===k ? C.primary : C.border}`,
                  background: filter===k ? 'rgba(232,160,32,0.12)' : 'transparent',
                  color: filter===k ? C.primary : C.muted }}>
                {l}
              </button>
            ))}
          </div>

          {displayed.length === 0 && (
            <div style={{ textAlign:'center', padding:60, color:C.faint, fontSize:15 }}>
              No {filter} trips
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {displayed.map(bk => (
              <div key={bk.id}
                style={{ background:C.card, borderRadius:14, padding:18,
                  border:`1px solid ${C.border}`, cursor:'pointer' }}
                onClick={() => setDetailBk(bk)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={{ fontWeight:700, fontSize:14, color:C.text }}>{bk.reference}</span>
                  <Badge status={bk.status} />
                </div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:3 }}>
                  📍 {bk.pickup_address}
                </div>
                <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>
                  🏁 {bk.delivery_address}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, color:C.faint }}>
                    {bk.cargo_type||'General'} · {bk.cargo_weight_kg||'?'} kg · {bk.vehicle_type||''}
                  </span>
                  {bk.hire_rate > 0 && (
                    <span style={{ fontWeight:800, fontSize:14, color:C.success }}>
                      KES {fmt(bk.hire_rate)}
                    </span>
                  )}
                </div>
                {bk.sos_freeze && (
                  <div style={{ marginTop:8, padding:'6px 10px', background:'rgba(239,68,68,0.1)',
                    border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, fontSize:12, color:C.danger }}>
                    🆘 SOS Freeze Active
                  </div>
                )}
                {NEXT_STATUS[bk.status] && (
                  <button
                    onClick={e => { e.stopPropagation(); updateStatus(bk, NEXT_STATUS[bk.status].to); }}
                    disabled={saving}
                    style={{ marginTop:12, width:'100%', padding:10, border:'none',
                      borderRadius:8, background:NEXT_STATUS[bk.status].color,
                      color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    {saving ? 'Updating…' : NEXT_STATUS[bk.status].label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ EARNINGS TAB ══════════════ */}
      {!loading && tab === 'earnings' && (
        <div>
          {/* Wallet card */}
          <div style={{ background:C.card, borderRadius:16, padding:24, marginBottom:20,
            border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>Total Earnings</div>
            <div style={{ fontSize:34, fontWeight:900, color:C.primary, marginBottom:18 }}>
              KES {fmt(totalEarnings)}
            </div>
            <div style={{ display:'flex', gap:16 }}>
              {[
                { label:'This Month', val:thisMonthEarnings, color:C.success },
                { label:'This Week',  val:thisWeekEarnings,  color:C.info    },
                { label:'Completed',  val:completed.length,  color:C.teal, prefix:'', suffix:' trips' },
              ].map(({ label,val,color,prefix='KES ',suffix='' }) => (
                <div key={label} style={{ flex:1, background:C.card2, borderRadius:12, padding:'12px 14px',
                  border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, color:C.faint, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color }}>
                    {prefix}{typeof val === 'number' ? fmt(val) : val}{suffix}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, fontSize:12, color:C.faint }}>
              💡 Payouts are released after Admin settlement approval.
            </div>
          </div>

          {/* Per-trip breakdown */}
          <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:12 }}>
            Trip Breakdown
          </div>
          {completed.length === 0 && (
            <div style={{ textAlign:'center', color:C.faint, padding:32 }}>
              No completed trips yet
            </div>
          )}
          {completed.map(b => (
            <div key={b.id} style={{ background:C.card, borderRadius:12, padding:14,
              marginBottom:8, border:`1px solid ${C.border}`,
              display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{b.reference}</div>
                <div style={{ fontSize:11, color:C.faint, marginTop:2 }} >
                  {b.pickup_address?.slice(0,40)}… → {b.delivery_address?.slice(0,30)}…
                </div>
                <div style={{ fontSize:11, color:C.faint, marginTop:2 }}>
                  {new Date(b.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ fontWeight:800, fontSize:15, color:C.success }}>
                KES {fmt(b.hire_rate)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════ PROFILE TAB ══════════════ */}
      {!loading && tab === 'profile' && (
        <div>
          {/* Profile card */}
          <div style={{ background:C.card, borderRadius:16, padding:24, marginBottom:16,
            border:`1px solid ${C.border}`, textAlign:'center' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:C.primary+'20',
              color:C.primary, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:26, fontWeight:800, margin:'0 auto 12px' }}>
              {(driver.full_name||'D').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:C.text }}>{driver.full_name}</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>{driver.email}</div>
            <div style={{ fontSize:13, color:C.muted, marginTop:2 }}>{driver.phone}</div>
            <div style={{ marginTop:12, display:'inline-block', padding:'6px 16px',
              borderRadius:20, border:`1px solid ${compColor}`,
              background:compColor+'18', color:compColor, fontSize:12, fontWeight:700 }}>
              {compliance.replace(/_/g,' ').toUpperCase()}
            </div>
          </div>

          {/* Stats row */}
          {dr && (
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              {[
                { label:'Total Trips', val: dr.total_trips||0 },
                { label:'Avg Rating',  val: `⭐ ${Number(dr.avg_rating||0).toFixed(1)}` },
                { label:'License Class', val: dr.license_class||'—' },
                { label:'Available',   val: dr.is_available ? '✅ Yes' : '🔴 No' },
              ].map(({ label, val }) => (
                <div key={label} style={{ flex:1, background:C.card, borderRadius:12, padding:12,
                  textAlign:'center', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{val}</div>
                  <div style={{ fontSize:10, color:C.faint, marginTop:4 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Compliance Documents */}
          <div style={{ fontWeight:700, fontSize:14, color:C.text, marginBottom:12 }}>
            Compliance Documents — PRD 14.1
          </div>
          <div style={{ background:C.card, borderRadius:14, padding:16,
            border:`1px solid ${C.border}`, marginBottom:16 }}>
            {DOC_FIELDS.map(doc => (
              <div key={doc.key} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'11px 0',
                borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.text }}>{doc.label}</span>
                <span style={{ fontSize:12, fontWeight:700,
                  color: dr?.[doc.key] ? C.success : C.warning }}>
                  {dr?.[doc.key] ? '✅ Verified' : '⏳ Pending'}
                </span>
              </div>
            ))}
          </div>

          {/* Can assign? Blacklist? */}
          {dr && (
            <div style={{ background:C.card, borderRadius:14, padding:16,
              border:`1px solid ${C.border}` }}>
              <div style={{ fontWeight:700, fontSize:13, color:C.text, marginBottom:12 }}>
                Assignment Control — PRD 17.1
              </div>
              {[
                { label:'Can Receive Assignments', val: dr.can_receive_assignments },
                { label:'Is Blacklisted',          val: dr.is_blacklisted, danger:true },
              ].map(({ label, val, danger }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between',
                  padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.muted }}>{label}</span>
                  <span style={{ fontSize:13, fontWeight:700,
                    color: danger ? (val ? C.danger : C.success) : (val ? C.success : C.faint) }}>
                    {danger ? (val ? '🚫 Yes' : '✅ No') : (val ? '✅ Yes' : '🔴 No')}
                  </span>
                </div>
              ))}
              {dr.blacklist_reason && (
                <div style={{ marginTop:10, padding:10, background:'rgba(239,68,68,0.08)',
                  borderRadius:8, fontSize:12, color:C.danger }}>
                  Reason: {dr.blacklist_reason}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TRIP DETAIL MODAL ══════════════ */}
      {detailBk && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
          zIndex:1000, padding:16 }}
          onClick={() => setDetailBk(null)}>
          <div style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:24,
            width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:17, color:C.text }}>Trip Detail</div>
              <button onClick={() => setDetailBk(null)}
                style={{ background:'transparent', border:'none', color:C.muted, fontSize:22, cursor:'pointer' }}>✕</button>
            </div>

            {[
              ['Reference', detailBk.reference],
              ['Status',    null],
              ['Pickup',    detailBk.pickup_address],
              ['Delivery',  detailBk.delivery_address],
              ['Cargo',     `${detailBk.cargo_type||'General'} · ${detailBk.cargo_weight_kg||'?'} kg`],
              ['Vehicle',   detailBk.vehicle_type],
              ['Hire Rate', `KES ${fmt(detailBk.hire_rate)}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'flex-start', padding:'11px 0', borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, color:C.muted, flexShrink:0, marginRight:16 }}>{label}</span>
                {label === 'Status'
                  ? <Badge status={detailBk.status} />
                  : <span style={{ fontSize:13, color:C.text, textAlign:'right' }}>{val}</span>
                }
              </div>
            ))}

            {detailBk.special_instructions && (
              <div style={{ marginTop:12, padding:12, background:C.card2, borderRadius:10,
                fontSize:12, color:C.muted }}>
                📝 {detailBk.special_instructions}
              </div>
            )}

            {/* Action buttons */}
            {NEXT_STATUS[detailBk.status] && (
              <button
                onClick={() => updateStatus(detailBk, NEXT_STATUS[detailBk.status].to)}
                disabled={saving}
                style={{ marginTop:16, width:'100%', padding:14, border:'none',
                  borderRadius:10, background:NEXT_STATUS[detailBk.status].color,
                  color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                {saving ? 'Updating…' : NEXT_STATUS[detailBk.status].label}
              </button>
            )}

            {/* Submit Expense button */}
            {['accepted','picked_up','in_transit'].includes(detailBk.status) && (
              <button onClick={() => setExpModal(true)}
                style={{ marginTop:10, width:'100%', padding:12, border:`1px solid ${C.border}`,
                  borderRadius:10, background:'transparent', color:C.text,
                  fontWeight:600, fontSize:13, cursor:'pointer' }}>
                + Submit Expense
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ EXPENSE MODAL ══════════════ */}
      {expModal && detailBk && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1100, padding:16 }}
          onClick={() => setExpModal(false)}>
          <div style={{ background:C.card, borderRadius:16, padding:24, width:'100%',
            maxWidth:420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:16, color:C.text }}>Submit Expense</div>
              <button onClick={() => setExpModal(false)}
                style={{ background:'transparent', border:'none', color:C.muted, fontSize:20, cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>Expense Type</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
              {EXPENSE_TYPES.map(t => (
                <button key={t} onClick={() => setExpense(e => ({ ...e, type:t }))}
                  style={{ padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:600,
                    cursor:'pointer', border:`1px solid ${expense.type===t ? C.primary : C.border}`,
                    background: expense.type===t ? 'rgba(232,160,32,0.12)' : 'transparent',
                    color: expense.type===t ? C.primary : C.muted, textTransform:'capitalize' }}>
                  {t.replace('_',' ')}
                </button>
              ))}
            </div>

            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>Amount (KES)</div>
            <input
              style={{ width:'100%', padding:'11px 14px', background:C.card2,
                border:`1px solid ${C.border}`, borderRadius:10, color:C.text,
                fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:14 }}
              type="number" placeholder="0" value={expense.amount}
              onChange={e => setExpense(x => ({ ...x, amount:e.target.value }))}
            />

            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>Note (optional)</div>
            <textarea
              style={{ width:'100%', padding:'11px 14px', background:C.card2,
                border:`1px solid ${C.border}`, borderRadius:10, color:C.text,
                fontSize:13, outline:'none', boxSizing:'border-box', height:70, resize:'none' }}
              placeholder="Description…" value={expense.description}
              onChange={e => setExpense(x => ({ ...x, description:e.target.value }))}
            />

            <button onClick={submitExpense} disabled={!expense.amount || saving}
              style={{ marginTop:16, width:'100%', padding:13, border:'none',
                borderRadius:10, background: (!expense.amount||saving) ? C.faint : C.primary,
                color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
              {saving ? 'Submitting…' : 'Submit for Admin Approval'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────────────────────── */
export default function DriverView() {
  const navigate  = useNavigate();
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId) {
      api.get(`/api/v1/users/${userId}`)
        .then(r => setDriver(r.data?.data || r.data))
        .catch(console.error);
    }
  }, []);

  return (
    <Layout title="Driver Portal">
      <div style={{ marginBottom:16 }}>
        <button onClick={() => navigate('/')}
          style={{ background:'#1f2840', border:'1px solid rgba(255,255,255,0.1)',
            color:'#e8eaf2', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
          ← Back to Dashboard
        </button>
      </div>
      {!driver
        ? <DriverPicker onSelect={setDriver} />
        : <DriverPortal driver={driver} onSwitch={() => setDriver(null)} />
      }
    </Layout>
  );
}
