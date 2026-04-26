import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const VERIFY_TABS = [
  { key: 'all',      label: 'All Drivers',  color: '#e8a020' },
  { key: 'pending',  label: 'Pending',      color: '#f59e0b' },
  { key: 'approved', label: 'Approved',     color: '#22c55e' },
  { key: 'rejected', label: 'Rejected',     color: '#ef4444' },
];

const TYPE_ICONS = { motorcycle: '🏍️', van: '🚐', pickup: '🛻', truck: '🚛', articulated: '🚚' };

function verifyStatus(driver) {
  if (driver.is_verified === true  || driver.is_verified === 1)  return 'approved';
  if (driver.is_verified === false && driver.reject_reason)       return 'rejected';
  return 'pending';
}

function VerifyBadge({ status }) {
  const cfg = {
    approved: { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: '✓ Approved' },
    rejected: { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: '✕ Rejected' },
    pending:  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: '⏳ Pending'  },
  }[status] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: '— Unknown' };
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>;
}

function Stars({ rating }) {
  const r = parseFloat(rating) || 0;
  return (
    <span style={{ color: '#e8a020', fontSize: 12, letterSpacing: 0.5 }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ opacity: i <= Math.round(r) ? 1 : 0.2 }}>★</span>)}
      <span style={{ color: '#545f73', fontSize: 11, marginLeft: 4 }}>{r.toFixed(1)}</span>
    </span>
  );
}

// ── DRIVER DETAIL MODAL ─────────────────────────────────────────────────────
function DriverDetailModal({ driver, vehicle, onClose, onApprove, onReject, onPushBack, saving }) {
  const [rejectReason,   setRejectReason]   = useState(driver.reject_reason || '');
  const [pushBackNote,   setPushBackNote]   = useState('');
  const [showRejectBox,  setShowRejectBox]  = useState(false);
  const [showPushBack,   setShowPushBack]   = useState(false);
  const status = verifyStatus(driver);
  const name   = driver.user?.full_name || driver.full_name || 'Unknown';
  const email  = driver.user?.email     || driver.email     || '—';
  const phone  = driver.user?.phone     || driver.phone     || '—';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

  const docRows = [
    { label: 'NTSA Driving Licence',    url: driver.license_url,       expiry: driver.license_expiry },
    { label: 'Medical Fitness Cert',    url: driver.medical_cert_url,  expiry: driver.medical_expiry },
    { label: 'National ID / Passport',  url: driver.id_doc_url,        expiry: null },
    { label: 'Profile Photo',           url: driver.user?.profile_photo || driver.profile_photo, expiry: null },
    { label: 'CRB Background Check',    url: driver.crb_cert_url,      expiry: null },
  ];

  const daysLeft = (date) => {
    if (!date) return null;
    const diff = Math.ceil((new Date(date) - Date.now()) / 86400000);
    return diff;
  };

  const expiryColor = (days) => {
    if (days === null) return '#545f73';
    if (days < 0)   return '#ef4444';
    if (days < 30)  return '#f59e0b';
    return '#22c55e';
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Driver Profile</span>
          <button style={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={{ maxHeight: '82vh', overflowY: 'auto', padding: 20 }}>

          {/* Avatar + basic info */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#181e2d', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, flexShrink: 0, border: '2px solid rgba(45,212,191,0.3)' }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#e8eaf2' }}>{name}</div>
              <div style={{ fontSize: 12, color: '#545f73', marginTop: 2 }}>{email}</div>
              <div style={{ fontSize: 12, color: '#8892a4', marginTop: 2 }}>{phone}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <VerifyBadge status={status} />
                <Stars rating={driver.avg_rating} />
                <span style={{ fontSize: 11, color: '#545f73' }}>{driver.total_trips || 0} trips</span>
              </div>
            </div>
          </div>

          {/* Reject reason banner */}
          {status === 'rejected' && driver.reject_reason && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>✕ REJECTION REASON</div>
              <div style={{ fontSize: 13, color: '#fca5a5' }}>{driver.reject_reason}</div>
            </div>
          )}

          {/* Push-back note banner */}
          {status === 'pending' && driver.push_back_note && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 4 }}>📋 PENDING — ACTION REQUIRED</div>
              <div style={{ fontSize: 13, color: '#fde68a' }}>{driver.push_back_note}</div>
            </div>
          )}

          {/* Licence details */}
          <div style={s.section}>
            <div style={s.sectionLabel}>🪪 LICENCE DETAILS</div>
            <div style={s.infoGrid}>
              {[
                ['Licence Number', driver.license_number],
                ['Licence Class',  driver.license_class],
                ['Licence Expiry', driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                ['Medical Expiry', driver.medical_expiry ? new Date(driver.medical_expiry).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
                ['National ID',    driver.user?.national_id || driver.national_id],
                ['KRA PIN',        driver.user?.kra_pin     || driver.kra_pin],
                ['Background Chk', driver.background_check ? '✓ Passed' : '✕ Not done'],
                ['Probation End',  driver.probation_end ? new Date(driver.probation_end).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={s.infoCell}>
                  <div style={s.infoCellLabel}>{label}</div>
                  <div style={s.infoCellValue}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div style={s.section}>
            <div style={s.sectionLabel}>📁 SUBMITTED DOCUMENTS</div>
            {docRows.map(doc => {
              const days = daysLeft(doc.expiry);
              return (
                <div key={doc.label} style={s.docRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e8eaf2', fontWeight: 500 }}>{doc.label}</div>
                    {doc.expiry && (
                      <div style={{ fontSize: 11, color: expiryColor(days), marginTop: 2 }}>
                        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d`}
                      </div>
                    )}
                  </div>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" style={s.viewDocBtn}>View ↗</a>
                  ) : (
                    <span style={{ fontSize: 11, color: '#545f73', fontStyle: 'italic' }}>Not uploaded</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Assigned vehicle */}
          {vehicle && (
            <div style={s.section}>
              <div style={s.sectionLabel}>🚛 ASSIGNED VEHICLE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#181e2d', borderRadius: 10 }}>
                <span style={{ fontSize: 24 }}>{TYPE_ICONS[vehicle.vehicle_type] || '🚛'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e8eaf2' }}>{vehicle.make} {vehicle.model}</div>
                  <div style={{ fontSize: 12, color: '#8892a4', fontFamily: 'monospace' }}>{vehicle.plate_number} · {vehicle.year}</div>
                </div>
              </div>
            </div>
          )}

          {/* Admin actions */}
          <div style={{ marginTop: 16 }}>
            <div style={s.sectionLabel}>⚙ ADMIN ACTIONS</div>

            {status !== 'approved' && (
              <button style={{ ...s.actionBtn, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', marginBottom: 8 }}
                onClick={() => onApprove(driver)} disabled={saving}>
                {saving ? 'Saving...' : '✓ Approve Driver'}
              </button>
            )}

            {/* Push back — send back to driver with note */}
            {status === 'pending' && (
              <>
                <button style={{ ...s.actionBtn, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 8 }}
                  onClick={() => { setShowPushBack(v => !v); setShowRejectBox(false); }}>
                  📋 Push Back (Request More Info)
                </button>
                {showPushBack && (
                  <div style={{ marginBottom: 10 }}>
                    <textarea
                      style={{ ...s.textarea, borderColor: 'rgba(245,158,11,0.3)' }}
                      placeholder="Tell the driver what's missing or needs fixing (e.g. 'Upload a clearer photo of your NTSA licence')..."
                      value={pushBackNote} onChange={e => setPushBackNote(e.target.value)} rows={3} />
                    <button style={{ ...s.actionBtn, background: '#f59e0b', color: '#000', border: 'none' }}
                      onClick={() => onPushBack(driver, pushBackNote)} disabled={saving || !pushBackNote.trim()}>
                      {saving ? 'Sending...' : '📤 Send to Driver'}
                    </button>
                  </div>
                )}
              </>
            )}

            {status !== 'rejected' && (
              <>
                <button style={{ ...s.actionBtn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                  onClick={() => { setShowRejectBox(v => !v); setShowPushBack(false); }}>
                  ✕ Reject Driver
                </button>
                {showRejectBox && (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      style={{ ...s.textarea, borderColor: 'rgba(239,68,68,0.3)' }}
                      placeholder="Reason for rejection (will be shown to driver)..."
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
                    <button style={{ ...s.actionBtn, background: '#ef4444', color: '#fff', border: 'none', marginTop: 8 }}
                      onClick={() => onReject(driver, rejectReason)} disabled={saving || !rejectReason.trim()}>
                      {saving ? 'Saving...' : '✕ Confirm Rejection'}
                    </button>
                  </div>
                )}
              </>
            )}

            {status === 'rejected' && (
              <button style={{ ...s.actionBtn, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
                onClick={() => onPushBack(driver, 'Please resubmit your documents for re-review.')} disabled={saving}>
                ↩ Reset to Pending
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function Drivers() {
  const [drivers,        setDrivers]        = useState([]);
  const [vehicles,       setVehicles]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [verifyTab,      setVerifyTab]      = useState('all');
  const [tripTab,        setTripTab]        = useState('all');   // all / available / busy
  const [search,         setSearch]         = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showAssign,     setShowAssign]     = useState(false);
  const [assignVehicle,  setAssignVehicle]  = useState('');
  const [saving,         setSaving]         = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([
        api.get('/api/v1/drivers'),
        api.get('/api/v1/vehicles'),
      ]);
      setDrivers(d.data.data || d.data || []);
      setVehicles(v.data.data || v.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const getVehicle = (driverUserId) => vehicles.find(v => v.current_driver_id === driverUserId) || null;

  // Filter chain
  const filtered = drivers
    .filter(d => {
      if (verifyTab === 'all') return true;
      return verifyStatus(d) === verifyTab;
    })
    .filter(d => {
      if (tripTab === 'available') return d.is_available;
      if (tripTab === 'busy')      return !d.is_available;
      return true;
    })
    .filter(d => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name  = (d.user?.full_name || d.full_name || '').toLowerCase();
      const email = (d.user?.email || d.email || '').toLowerCase();
      const phone = (d.user?.phone || d.phone || '').toLowerCase();
      const lic   = (d.license_number || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || lic.includes(q);
    });

  // Counts
  const counts = {
    all:      drivers.length,
    pending:  drivers.filter(d => verifyStatus(d) === 'pending').length,
    approved: drivers.filter(d => verifyStatus(d) === 'approved').length,
    rejected: drivers.filter(d => verifyStatus(d) === 'rejected').length,
  };

  // Admin actions
  const handleApprove = async (driver) => {
    setSaving(true);
    try {
      await api.put(`/api/v1/users/${driver.user_id}`, { is_verified: true, reject_reason: null, push_back_note: null });
      setDrivers(prev => prev.map(d => d.user_id === driver.user_id ? { ...d, is_verified: true, reject_reason: null } : d));
      setSelectedDriver(d => d ? { ...d, is_verified: true, reject_reason: null } : null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleReject = async (driver, reason) => {
    setSaving(true);
    try {
      await api.put(`/api/v1/users/${driver.user_id}`, { is_verified: false, reject_reason: reason });
      setDrivers(prev => prev.map(d => d.user_id === driver.user_id ? { ...d, is_verified: false, reject_reason: reason } : d));
      setSelectedDriver(d => d ? { ...d, is_verified: false, reject_reason: reason } : null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handlePushBack = async (driver, note) => {
    setSaving(true);
    try {
      await api.put(`/api/v1/users/${driver.user_id}`, { is_verified: false, push_back_note: note, reject_reason: null });
      setDrivers(prev => prev.map(d => d.user_id === driver.user_id ? { ...d, is_verified: false, push_back_note: note, reject_reason: null } : d));
      setSelectedDriver(d => d ? { ...d, is_verified: false, push_back_note: note, reject_reason: null } : null);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAssignVehicleConfirm = async () => {
    if (!selectedDriver) return;
    setSaving(true);
    try {
      const current = getVehicle(selectedDriver.user_id);
      if (current && current.id !== assignVehicle) {
        await api.put(`/api/v1/vehicles/${current.id}`, { current_driver_id: null });
      }
      if (assignVehicle) {
        await api.put(`/api/v1/vehicles/${assignVehicle}`, { current_driver_id: selectedDriver.user_id });
      }
      await fetchAll();
      setShowAssign(false);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <Layout>
      {/* Header */}
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Driver Management</div>
          <div style={s.sectionSub}>Verification status · Licence details · Vehicle assignments</div>
        </div>
      </div>

      {/* Verification stat cards */}
      <div style={s.statGrid}>
        {VERIFY_TABS.map(t => (
          <div key={t.key} style={{ ...s.statCard, borderTop: `3px solid ${t.color}`, cursor: 'pointer', ...(verifyTab === t.key ? { background: t.color + '0d' } : {}) }}
            onClick={() => setVerifyTab(t.key)}>
            <div style={{ fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontWeight: 800, fontSize: 30, color: t.color }}>{counts[t.key]}</div>
            <div style={{ fontSize: 11, color: '#545f73', marginTop: 4 }}>
              {t.key === 'all' ? 'Registered drivers' : t.key === 'pending' ? 'Awaiting review' : t.key === 'approved' ? 'Cleared to operate' : 'Verification failed'}
            </div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Verify filter tabs */}
            <div style={s.tabs}>
              {VERIFY_TABS.map(t => (
                <button key={t.key}
                  style={{ ...s.tab, ...(verifyTab === t.key ? { ...s.tabActive, borderColor: t.color, color: t.color } : {}) }}
                  onClick={() => setVerifyTab(t.key)}>
                  {t.label}
                  <span style={{ ...s.tabCount, ...(verifyTab === t.key ? { background: t.color, color: '#000' } : {}) }}>{counts[t.key]}</span>
                </button>
              ))}
            </div>
            {/* Availability filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ key: 'all', label: 'All' }, { key: 'available', label: '✓ Free' }, { key: 'busy', label: '🚛 On Trip' }].map(t => (
                <button key={t.key}
                  style={{ ...s.tab, fontSize: 11, padding: '4px 10px', ...(tripTab === t.key ? { background: '#1f2840', borderColor: 'rgba(255,255,255,0.15)', color: '#e8eaf2' } : {}) }}
                  onClick={() => setTripTab(t.key)}>{t.label}</button>
              ))}
            </div>
          </div>
          <input style={s.search} placeholder="Search by name, email, licence..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>DRIVER</th>
              <th style={s.th}>LICENCE</th>
              <th style={s.th}>PHONE</th>
              <th style={s.th}>RATING</th>
              <th style={s.th}>TRIPS</th>
              <th style={s.th}>VEHICLE</th>
              <th style={s.th}>AVAILABILITY</th>
              <th style={s.th}>VERIFICATION</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={s.emptyCell}>Loading drivers...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={s.emptyCell}>
                <div style={s.emptyState}>
                  <div style={{ fontSize: 40, opacity: 0.25 }}>👤</div>
                  <div style={{ fontSize: 14, color: '#8892a4' }}>No {verifyTab !== 'all' ? verifyTab : ''} drivers found</div>
                </div>
              </td></tr>
            ) : filtered.map(d => {
              const name    = d.user?.full_name || d.full_name || 'Unknown';
              const email   = d.user?.email     || d.email     || '—';
              const phone   = d.user?.phone     || d.phone     || '—';
              const vehicle = getVehicle(d.user_id);
              const vstatus = verifyStatus(d);
              const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
              const hasPushBack = vstatus === 'pending' && d.push_back_note;

              return (
                <tr key={d.user_id} style={s.tr}>
                  {/* Driver */}
                  <td style={s.td}>
                    <div style={s.nameCell}>
                      <div style={{ ...s.avatar, ...(vstatus === 'approved' ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' } : vstatus === 'rejected' ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444' } : { background: 'rgba(45,212,191,0.15)', color: '#2dd4bf' }) }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf2' }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#545f73' }}>{email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Licence */}
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>
                    <div style={{ color: '#e8eaf2' }}>{d.license_number || '—'}</div>
                    {d.license_class && <div style={{ fontSize: 10, color: '#545f73' }}>Class {d.license_class}</div>}
                    {d.license_expiry && (() => {
                      const days = Math.ceil((new Date(d.license_expiry) - Date.now()) / 86400000);
                      return <div style={{ fontSize: 10, color: days < 30 ? '#f59e0b' : '#22c55e' }}>Exp {new Date(d.license_expiry).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: '2-digit' })}</div>;
                    })()}
                  </td>

                  {/* Phone */}
                  <td style={{ ...s.td, fontSize: 13 }}>{phone}</td>

                  {/* Rating */}
                  <td style={s.td}><Stars rating={d.avg_rating} /></td>

                  {/* Trips */}
                  <td style={{ ...s.td, fontWeight: 700, color: '#2dd4bf', fontSize: 14 }}>{d.total_trips || 0}</td>

                  {/* Vehicle */}
                  <td style={s.td}>
                    {vehicle ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{TYPE_ICONS[vehicle.vehicle_type] || '🚛'}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf2' }}>{vehicle.make} {vehicle.model}</div>
                          <div style={{ fontSize: 11, color: '#8892a4', fontFamily: 'monospace' }}>{vehicle.plate_number}</div>
                        </div>
                      </div>
                    ) : <span style={{ fontSize: 11, color: '#545f73', fontStyle: 'italic' }}>Unassigned</span>}
                  </td>

                  {/* Availability */}
                  <td style={s.td}>
                    <span style={{ background: d.is_available ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', color: d.is_available ? '#22c55e' : '#818cf8', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                      {d.is_available ? '✓ Available' : '🚛 On Trip'}
                    </span>
                  </td>

                  {/* Verification */}
                  <td style={s.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <VerifyBadge status={vstatus} />
                      {hasPushBack && <span style={{ fontSize: 10, color: '#f59e0b' }}>📋 Action needed</span>}
                      {vstatus === 'rejected' && <span style={{ fontSize: 10, color: '#ef4444', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.reject_reason}</span>}
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={s.td}>
                    <div style={s.actionBtns}>
                      <button style={{ ...s.btnSm, color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)' }}
                        onClick={() => setSelectedDriver(d)}>
                        View
                      </button>
                      <button style={{ ...s.btnSm, color: '#e8a020', borderColor: 'rgba(232,160,32,0.3)' }}
                        onClick={() => { setSelectedDriver(d); setAssignVehicle(vehicle?.id || ''); setShowAssign(true); }}>
                        {vehicle ? '🔄 Vehicle' : '🚛 Assign'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── DRIVER DETAIL MODAL ── */}
      {selectedDriver && !showAssign && (
        <DriverDetailModal
          driver={selectedDriver}
          vehicle={getVehicle(selectedDriver.user_id)}
          onClose={() => setSelectedDriver(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onPushBack={handlePushBack}
          saving={saving}
        />
      )}

      {/* ── ASSIGN VEHICLE MODAL ── */}
      {showAssign && selectedDriver && (
        <div style={s.overlay} onClick={() => setShowAssign(false)}>
          <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>🚛 Assign Vehicle</span>
              <button style={s.modalClose} onClick={() => setShowAssign(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#e8eaf2', marginBottom: 4 }}>
                {selectedDriver.user?.full_name || selectedDriver.full_name}
              </div>
              <div style={{ fontSize: 12, color: '#545f73', marginBottom: 16 }}>
                Licence: {selectedDriver.license_number || '—'} · Class {selectedDriver.license_class || '—'}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.formLabel}>Select Vehicle</label>
                <select style={s.input} value={assignVehicle} onChange={e => setAssignVehicle(e.target.value)}>
                  <option value="">— Unassign (no vehicle) —</option>
                  {vehicles.map(v => {
                    const taken = v.current_driver_id && v.current_driver_id !== selectedDriver.user_id;
                    return (
                      <option key={v.id} value={v.id} disabled={taken}>
                        {TYPE_ICONS[v.vehicle_type] || '🚛'} {v.make} {v.model} · {v.plate_number}
                        {taken ? ' (assigned)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button style={s.btnCancel} onClick={() => setShowAssign(false)}>Cancel</button>
                <button style={s.btnConfirm} onClick={handleAssignVehicleConfirm} disabled={saving}>
                  {saving ? 'Saving...' : '✓ Confirm'}
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
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'background 0.15s' },
  panel: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap', gap: 10 },
  tabs: { display: 'flex', gap: 4 },
  tab: { background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '5px 12px', color: '#8892a4', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  tabActive: { background: '#1f2840' },
  tabCount: { background: '#181e2d', borderRadius: 10, padding: '1px 6px', fontSize: 11, color: '#545f73' },
  search: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px', color: '#e8eaf2', fontSize: 13, width: 240, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', fontSize: 11, color: '#545f73', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  emptyCell: { padding: '48px', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  actionBtns: { display: 'flex', gap: 6 },
  btnSm: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#8892a4' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, width: '95%', maxWidth: 520 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  modalTitle: { fontWeight: 600, fontSize: 15, color: '#e8eaf2' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, color: '#545f73', fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  infoCell: { background: '#181e2d', borderRadius: 8, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.05)' },
  infoCellLabel: { fontSize: 10, color: '#545f73', marginBottom: 3 },
  infoCellValue: { fontSize: 12, fontWeight: 600, color: '#e8eaf2' },
  docRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#181e2d', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)' },
  viewDocBtn: { fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 600, padding: '3px 10px', background: 'rgba(99,102,241,0.1)', borderRadius: 6 },
  actionBtn: { width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 0, display: 'block', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginTop: 8 },
  formLabel: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '9px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  btnCancel: { padding: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 11, background: '#e8a020', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};