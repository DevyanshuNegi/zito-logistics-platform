import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

const KE_DOCS = [
  { key: 'ntsa_inspection',    label: 'NTSA Inspection Certificate' },
  { key: 'insurance',          label: 'Insurance Certificate (PSV/Goods)' },
  { key: 'logbook',            label: 'Logbook (NTSA Logbook)' },
  { key: 'good_transport_lic', label: 'Good Transport License (NCA)' },
  { key: 'road_service_levy',  label: 'Road Service Levy Receipt' },
  { key: 'axle_load_cert',     label: 'Axle Load / Overload Permit' },
  { key: 'fire_extinguisher',  label: 'Fire Extinguisher Certificate' },
];

const TRUCK_VIEWS = [
  { key: 'photo_front', label: 'Front View',  icon: '⬆️' },
  { key: 'photo_rear',  label: 'Rear View',   icon: '⬇️' },
  { key: 'photo_left',  label: 'Left Side',   icon: '⬅️' },
  { key: 'photo_right', label: 'Right Side',  icon: '➡️' },
];

function CameraCapture({ label, icon, value, onChange, onClear }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permission.');
    }
  };

  const stopStream = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.8);
    onChange(dataUrl);
    stopStream();
  };

  return (
    <div style={cs.camBox}>
      <div style={cs.camLabel}>{icon} {label}</div>
      {!value && !streaming && (
        <button style={cs.camTrigger} onClick={startCamera}>📷 Take Photo</button>
      )}
      {streaming && (
        <div style={cs.camLive}>
          <video ref={videoRef} style={cs.video} autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={cs.camControls}>
            <button style={cs.btnCapture} onClick={capture}>⚡ Capture</button>
            <button style={cs.btnCancelCam} onClick={stopStream}>✕ Cancel</button>
          </div>
        </div>
      )}
      {value && !streaming && (
        <div style={cs.camPreview}>
          <img src={value} alt={label} style={cs.previewImg} />
          <button style={cs.btnRetake} onClick={() => { onClear(); startCamera(); }}>🔄 Retake</button>
        </div>
      )}
      {error && <div style={cs.camError}>{error}</div>}
    </div>
  );
}

export default function Fleet() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [ownershipType, setOwnershipType] = useState('vg_owned');
  const [addStep, setAddStep] = useState(1);

  const emptyForm = {
    plate_number: '', make: '', manufacturer: '', model: '', model_number: '', year: '',
    vehicle_type: 'truck', cargo_capacity_kg: '', gvw_kg: '', company_name: '',
    owner_user_id: '', owner_name: '', owner_phone: '', owner_mpesa: '',
    payment_structure: 'commission', rate: '',
    engine_number: '', chassis_number: '', logbook_number: '', color: '',
    body_type: '', axles: '', tare_weight_kg: '',
    // Compliance expiries (persisted fields)
    insurance_expiry: '', ntsa_expiry: '', inspection_expiry: '',
    // Extra reminders (not yet persisted but kept for UX parity)
    road_service_levy_expiry: '', fire_extinguisher_expiry: '', axle_load_cert_expiry: '',
  };
  const emptyPhotos = { photo_front: '', photo_rear: '', photo_left: '', photo_right: '', driver_photo: '' };
  const emptyDocs = { ntsa_inspection: null, insurance: null, logbook: null, good_transport_lic: null, road_service_levy: null, axle_load_cert: null, fire_extinguisher: null };

  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState(emptyPhotos);
  const [docs, setDocs] = useState(emptyDocs);
  const [expiring, setExpiring] = useState([]);
  const [complianceEdit, setComplianceEdit] = useState({});
  const isAdminRole = ['super_admin','operations_admin','finance_admin'].includes(user?.role);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/vehicles'),
      api.get('/api/v1/drivers'),
      api.get('/api/v1/users?role=transporter'),
    ]).then(([v, d, t]) => {
      setVehicles(v.data.data || []);
      setDrivers(d.data.data || []);
      setTransporters(t.data.data || []);
    }).catch(console.error).finally(() => setLoading(false));
    if (isAdminRole) fetchExpiring();
  }, []);

  useEffect(() => {
    if (!selectedVehicle) return;
    setComplianceEdit({
      insurance_expiry: selectedVehicle.insurance_expiry ? selectedVehicle.insurance_expiry.slice(0, 10) : '',
      ntsa_expiry: (selectedVehicle.ntsa_expiry || selectedVehicle.ntsa_inspection_expiry || '').slice(0, 10),
      inspection_expiry: (selectedVehicle.inspection_expiry || selectedVehicle.good_transport_lic_expiry || '').slice(0, 10),
      is_assignment_blocked: !!selectedVehicle.is_assignment_blocked,
      block_reason: selectedVehicle.block_reason || '',
    });
  }, [selectedVehicle]);

  const fetchExpiring = async () => {
    try {
      const res = await api.get('/api/v1/vehicle/expiring/list', { params: { days: 30 } });
      setExpiring(res.data?.data?.vehicles || res.data?.vehicles || []);
    } catch (err) {
      console.error('expiring fetch failed');
    }
  };

  const tabs = [
    { key: 'all', label: 'All Fleet' },
    { key: 'vg_owned', label: 'VG-Owned' },
    { key: 'contracted', label: 'Contracted' },
  ];

  const filtered = vehicles.filter(v => activeTab === 'all' ? true : v.ownership_type === activeTab);
  const typeIcons = { motorcycle: '🏍️', van: '🚐', pickup: '🛻', truck: '🚛', articulated: '🚚' };

  const getTransporterName = (id) => {
    const t = transporters.find(t => t.id === id);
    return t ? t.full_name : null;
  };

  const handleTransporterSelect = (id) => {
    const t = transporters.find(t => t.id === id);
    setForm(prev => ({ ...prev, owner_user_id: id, owner_name: t?.full_name || '', owner_phone: t?.phone || '', owner_mpesa: t?.mpesa_number || '' }));
  };

  const resetAdd = () => { setAddStep(1); setOwnershipType('vg_owned'); setForm(emptyForm); setPhotos(emptyPhotos); setDocs(emptyDocs); };

  const handleAssignDriver = async () => {
    if (!selectedVehicle) return;
    try {
      await api.put(`/api/v1/vehicles/${selectedVehicle.id}`, { current_driver_id: selectedDriver || null });
      setVehicles(prev => prev.map(v => v.id === selectedVehicle.id
        ? { ...v, current_driver_id: selectedDriver || null, current_driver: drivers.find(d => d.user_id === selectedDriver) }
        : v
      ));
      setShowDriverModal(false); setSelectedVehicle(null); setSelectedDriver('');
    } catch (err) { console.error(err); }
  };

  const handleAddVehicle = async () => {
    try {
      const hasFiles = Object.values(docs).some(Boolean);
      let res;
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
        fd.append('ownership_type', ownershipType);
        Object.entries(photos).forEach(([k, v]) => { if (v) fd.append(k, v); });
        Object.entries(docs).forEach(([k, f]) => { if (f) fd.append(k, f); });
        res = await api.post('/api/v1/vehicles', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const payload = { ...form, ownership_type: ownershipType, ...Object.fromEntries(Object.entries(photos).filter(([,v]) => v)) };
        res = await api.post('/api/v1/vehicles', payload);
      }
      setVehicles(prev => [...prev, res.data.data]);
      setShowAddModal(false); resetAdd();
    } catch (err) { console.error(err); }
  };

  const saveCompliance = async () => {
    if (!selectedVehicle) return;
    try {
      await api.post(`/api/v1/vehicle/${selectedVehicle.id}/documents`, complianceEdit);
      const v = await api.get('/api/v1/vehicles');
      setVehicles(v.data.data || []);
      if (isAdminRole) fetchExpiring();
      setShowViewModal(false);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update compliance');
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const expColor = (d) => {
    if (!d) return '#545f73';
    const diff = (new Date(d) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return '#ef4444';
    if (diff <= 30) return '#f59e0b';
    return '#22c55e';
  };

  const getComplianceStatus = (v) => {
    const today = new Date();
    const fields = [
      v.insurance_expiry,
      v.ntsa_expiry || v.ntsa_inspection_expiry,
      v.inspection_expiry || v.good_transport_lic_expiry,
    ].filter(Boolean);
    const expired = fields.some(date => new Date(date) < today);
    const soon = fields.some(date => {
      const diff = (new Date(date) - today) / 86400000;
      return diff >= 0 && diff <= 30;
    });
    if (expired) return { label: 'Docs Expired', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
    if (soon) return { label: 'Expiring Soon', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
    return null;
  };

  const statusColors = {
    active: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    idle:   { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  };

  return (
    <Layout>
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Fleet Management</div>
          <div style={s.sectionSub}>Kenya-Compliant Vehicle Registry · {vehicles.length} vehicles</div>
        </div>
        <button style={s.btnPrimary} onClick={() => { resetAdd(); setShowAddModal(true); }}>+ Register Vehicle</button>
      </div>

      <div style={s.statGrid}>
        {[
          { label: 'Total Fleet', value: vehicles.length, icon: '🚛', color: '#e8a020' },
          { label: 'VG-Owned', value: vehicles.filter(v => v.ownership_type === 'vg_owned').length, icon: '🏢', color: '#6366f1' },
          { label: 'Contracted', value: vehicles.filter(v => v.ownership_type === 'contracted').length, icon: '🤝', color: '#2dd4bf' },
          { label: 'Docs Expiring', value: vehicles.filter(v => getComplianceStatus(v)).length, icon: '⚠️', color: '#f59e0b' },
        ].map(st => (
          <div key={st.label} style={s.statCard}>
            <div style={s.statIcon}>{st.icon}</div>
            <div style={s.statLabel}>{st.label}</div>
            <div style={{ ...s.statValue, color: st.color }}>{st.value}</div>
          </div>
        ))}
      </div>

      {isAdminRole && expiring.length > 0 && (
        <div style={{ ...s.panel, marginBottom: 16 }}>
          <div style={s.panelHeader}>
            <div>
              <div style={s.sectionTitle}>Expiring in 30 days</div>
              <div style={s.sectionSub}>Insurance / NTSA / Inspection</div>
            </div>
            <button style={s.btnSm} onClick={fetchExpiring}>Refresh</button>
          </div>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {expiring.map(ev => (
              <div key={ev.id} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, background: '#181e2d' }}>
                <div style={{ fontWeight: 700, color: '#e8a020', marginBottom: 4 }}>{ev.plate_number}</div>
                <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 8 }}>{ev.vehicle_type?.toUpperCase() || 'Vehicle'}</div>
                <div style={{ fontSize: 12, color: expColor(ev.insurance_expiry), marginBottom: 4 }}>🛡️ Insurance: {fmt(ev.insurance_expiry)}</div>
                <div style={{ fontSize: 12, color: expColor(ev.ntsa_expiry), marginBottom: 4 }}>🔍 NTSA: {fmt(ev.ntsa_expiry)}</div>
                <div style={{ fontSize: 12, color: expColor(ev.inspection_expiry) }}>📋 Inspection: {fmt(ev.inspection_expiry)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div style={s.tabs}>
            {tabs.map(t => (
              <button key={t.key} style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }} onClick={() => setActiveTab(t.key)}>
                {t.label}
                <span style={{ ...s.tabCount, ...(activeTab === t.key ? s.tabCountActive : {}) }}>
                  {t.key === 'all' ? vehicles.length : vehicles.filter(v => v.ownership_type === t.key).length}
                </span>
              </button>
            ))}
          </div>
          <input style={s.search} placeholder="Search plate / make / model..." />
        </div>

        <table style={s.table}>
          <thead>
            <tr>
              {['VEHICLE', 'PLATE · ENGINE · CHASSIS', 'GVW / CARGO', 'OWNERSHIP', 'COMPLIANCE', 'DRIVER', 'STATUS', ''].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={s.emptyCell}>Loading fleet...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={s.emptyCell}>
                <div style={s.emptyState}>
                  <div style={s.emptyIcon}>🚛</div>
                  <div style={s.emptyTitle}>No vehicles registered</div>
                  <div style={s.emptySub}>Register your first vehicle to get started</div>
                </div>
              </td></tr>
            ) : filtered.map(v => {
              const sc = statusColors[v.is_active ? 'active' : 'idle'];
              const isOwned = v.ownership_type === 'vg_owned';
              const driverName = v.current_driver?.user?.full_name || v.current_driver?.full_name || null;
              const transName = getTransporterName(v.owner_user_id);
              const compliance = getComplianceStatus(v);
              return (
                <tr key={v.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.vehicleCell}>
                      <div style={s.vehicleIconBox}>{typeIcons[v.vehicle_type] || '🚛'}</div>
                      <div>
                        <div style={s.vehicleName}>{v.make} {v.model}</div>
                        <div style={{ fontSize: 11, color: '#8892a4' }}>
                          {v.manufacturer && <span style={{ color: '#6366f1' }}>{v.manufacturer}</span>}
                          {v.manufacturer && v.model_number && ' · '}
                          {v.model_number && <span style={{ color: '#545f73' }}>#{v.model_number}</span>}
                          {v.year && <span> · {v.year}</span>}
                        </div>
                        {v.company_name && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 1 }}>{v.company_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...s.td, fontSize: 12 }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#e8a020' }}>{v.plate_number}</div>
                    {v.engine_number && <div style={{ color: '#545f73' }}>ENG: {v.engine_number}</div>}
                    {v.chassis_number && <div style={{ color: '#545f73' }}>CHS: {v.chassis_number}</div>}
                    {v.logbook_number && <div style={{ color: '#545f73' }}>LOG: {v.logbook_number}</div>}
                  </td>
                  <td style={{ ...s.td, fontSize: 12 }}>
                    {v.gvw_kg ? (
                      <>
                        <div style={{ color: '#e8eaf2', fontWeight: 600 }}>{v.gvw_kg.toLocaleString()} kg GVW</div>
                        {v.cargo_capacity_kg && <div style={{ color: '#8892a4', fontSize: 11 }}>Cargo: {v.cargo_capacity_kg.toLocaleString()} kg</div>}
                        {v.tare_weight_kg && <div style={{ color: '#545f73', fontSize: 11 }}>Tare: {v.tare_weight_kg.toLocaleString()} kg</div>}
                      </>
                    ) : v.cargo_capacity_kg ? `${v.cargo_capacity_kg.toLocaleString()} kg` : '—'}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: isOwned ? 'rgba(99,102,241,0.15)' : 'rgba(45,212,191,0.15)', color: isOwned ? '#818cf8' : '#2dd4bf' }}>
                      {isOwned ? '🏢 VG-Owned' : '🤝 Contracted'}
                    </span>
                    {!isOwned && (transName || v.owner_name) && (
                      <div style={{ fontSize: 11, color: '#2dd4bf', marginTop: 4 }}>🏭 {transName || v.owner_name}</div>
                    )}
                  </td>
                  <td style={{ ...s.td, fontSize: 11 }}>
                    {compliance && <div style={{ ...s.badge, background: compliance.bg, color: compliance.color, marginBottom: 6 }}>⚠️ {compliance.label}</div>}
                    {v.insurance_expiry && <div style={{ color: expColor(v.insurance_expiry), marginBottom: 2 }}>🛡️ Ins: {fmt(v.insurance_expiry)}</div>}
                    {(v.ntsa_expiry || v.ntsa_inspection_expiry) && (
                      <div style={{ color: expColor(v.ntsa_expiry || v.ntsa_inspection_expiry), marginBottom: 2 }}>
                        🔍 NTSA: {fmt(v.ntsa_expiry || v.ntsa_inspection_expiry)}
                      </div>
                    )}
                    {(v.inspection_expiry || v.good_transport_lic_expiry) && (
                      <div style={{ color: expColor(v.inspection_expiry || v.good_transport_lic_expiry) }}>
                        📋 Inspection: {fmt(v.inspection_expiry || v.good_transport_lic_expiry)}
                      </div>
                    )}
                    {!v.insurance_expiry && !v.ntsa_expiry && !v.ntsa_inspection_expiry && !v.inspection_expiry && <span style={{ color: '#545f73' }}>No dates set</span>}
                  </td>
                  <td style={s.td}>
                    {driverName ? (
                      <div style={s.driverCell}>
                        <div style={s.driverAvatar}>{driverName.charAt(0)}</div>
                        <span style={{ fontSize: 13 }}>{driverName}</span>
                      </div>
                    ) : <span style={s.unassigned}>Unassigned</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>{v.is_active ? 'Active' : 'Idle'}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actionBtns}>
                      <button style={s.btnSm} onClick={() => { setSelectedVehicle(v); setShowViewModal(true); }}>View</button>
                      <button style={{ ...s.btnSm, color: '#e8a020', borderColor: 'rgba(232,160,32,0.3)' }}
                        onClick={() => { setSelectedVehicle(v); setSelectedDriver(v.current_driver_id || ''); setShowDriverModal(true); }}>
                        {driverName ? '🔄' : '👤'} Driver
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* VIEW MODAL */}
      {showViewModal && selectedVehicle && (
        <div style={s.modalOverlay} onClick={() => setShowViewModal(false)}>
          <div style={{ ...s.modal, maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{typeIcons[selectedVehicle.vehicle_type]} {selectedVehicle.make} {selectedVehicle.model} — {selectedVehicle.plate_number}</span>
              <button style={s.modalClose} onClick={() => setShowViewModal(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {(selectedVehicle.photo_front || selectedVehicle.photo_rear || selectedVehicle.photo_left || selectedVehicle.photo_right) && (
                <div style={{ marginBottom: 20 }}>
                  <div style={s.sectionLabel}>🚛 Vehicle Photos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {TRUCK_VIEWS.map(view => selectedVehicle[view.key] && (
                      <div key={view.key} style={{ position: 'relative' }}>
                        <img src={selectedVehicle[view.key]} alt={view.label} style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 150 }} />
                        <div style={s.photoLabel}>{view.icon} {view.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedVehicle.driver_photo && (
                <div style={{ marginBottom: 20 }}>
                  <div style={s.sectionLabel}>👤 Driver Photo at Registration</div>
                  <img src={selectedVehicle.driver_photo} alt="Driver" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(45,212,191,0.3)' }} />
                </div>
              )}
              <div style={s.sectionLabel}>📋 Vehicle Identifiers</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  ['Plate Number', selectedVehicle.plate_number],
                  ['Manufacturer', selectedVehicle.manufacturer],
                  ['Model Number', selectedVehicle.model_number],
                  ['Engine No.', selectedVehicle.engine_number],
                  ['Chassis No.', selectedVehicle.chassis_number],
                  ['Logbook No.', selectedVehicle.logbook_number],
                  ['Colour', selectedVehicle.color],
                  ['Body Type', selectedVehicle.body_type],
                  ['Axles', selectedVehicle.axles],
                  ['GVW (kg)', selectedVehicle.gvw_kg?.toLocaleString()],
                  ['Tare Weight', selectedVehicle.tare_weight_kg?.toLocaleString()],
                  ['Cargo Cap.', selectedVehicle.cargo_capacity_kg?.toLocaleString()],
                ].filter(([,v]) => v).map(([lbl, val]) => (
                  <div key={lbl} style={s.infoCell}>
                    <div style={s.infoCellLabel}>{lbl}</div>
                    <div style={s.infoCellValue}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={s.sectionLabel}>Kenya Compliance Dates</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Insurance Expiry', selectedVehicle.insurance_expiry],
                  ['NTSA Inspection Expiry', selectedVehicle.ntsa_expiry || selectedVehicle.ntsa_inspection_expiry],
                  ['Inspection Expiry', selectedVehicle.inspection_expiry || selectedVehicle.good_transport_lic_expiry],
                  ['Road Service Levy', selectedVehicle.road_service_levy_expiry],
                  ['Axle Load Cert', selectedVehicle.axle_load_cert_expiry],
                  ['Fire Extinguisher', selectedVehicle.fire_extinguisher_expiry],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={s.infoCell}>
                    <div style={s.infoCellLabel}>{lbl}</div>
                    <div style={{ ...s.infoCellValue, color: expColor(val) }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
              {isAdminRole && (
                <div style={{ marginTop: 16, background: '#181e2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                  <div style={{ ...s.sectionLabel, marginBottom: 8 }}>Admin Compliance Controls</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={s.formGroup}>
                      <label style={s.label}>Insurance Expiry</label>
                      <input type="date" style={s.input} value={complianceEdit.insurance_expiry || ''} onChange={e => setComplianceEdit(prev => ({ ...prev, insurance_expiry: e.target.value }))} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>NTSA Expiry</label>
                      <input type="date" style={s.input} value={complianceEdit.ntsa_expiry || ''} onChange={e => setComplianceEdit(prev => ({ ...prev, ntsa_expiry: e.target.value }))} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>Inspection Expiry</label>
                      <input type="date" style={s.input} value={complianceEdit.inspection_expiry || ''} onChange={e => setComplianceEdit(prev => ({ ...prev, inspection_expiry: e.target.value }))} />
                    </div>
                    <div style={{ ...s.formGroup, alignSelf: 'end' }}>
                      <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={!!complianceEdit.is_assignment_blocked} onChange={e => setComplianceEdit(prev => ({ ...prev, is_assignment_blocked: e.target.checked }))} />
                        Block assignment until re-verified
                      </label>
                    </div>
                  </div>
                  <div style={s.formGroup}>
                    <label style={s.label}>Block / Note Reason (optional)</label>
                    <textarea style={{ ...s.input, minHeight: 60 }} value={complianceEdit.block_reason || ''} onChange={e => setComplianceEdit(prev => ({ ...prev, block_reason: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={s.btnCancel} onClick={() => setShowViewModal(false)}>Close</button>
                    <button style={s.btnConfirm} onClick={saveCompliance}>Save Compliance</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN DRIVER MODAL */}
      {showDriverModal && selectedVehicle && (
        <div style={s.modalOverlay} onClick={() => setShowDriverModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>{selectedVehicle.current_driver_id ? '🔄 Change Driver' : '👤 Assign Driver'}</span>
              <button style={s.modalClose} onClick={() => setShowDriverModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.vehicleSummary}>
                <div style={{ fontSize: 28 }}>{typeIcons[selectedVehicle.vehicle_type] || '🚛'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#e8eaf2' }}>{selectedVehicle.make} {selectedVehicle.model}</div>
                  <div style={{ fontSize: 12, color: '#8892a4', fontFamily: 'monospace' }}>{selectedVehicle.plate_number}</div>
                </div>
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Select Driver</label>
                <select style={{ ...s.input, cursor: 'pointer' }} value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
                  <option value="">— Unassign —</option>
                  {drivers.map(d => {
                    const name = d.user?.full_name || d.full_name || 'Unknown';
                    const onAnother = vehicles.some(v => v.current_driver_id === d.user_id && v.id !== selectedVehicle.id);
                    return <option key={d.user_id} value={d.user_id} disabled={onAnother}>{name}{d.avg_rating ? ` · ⭐${d.avg_rating}` : ''}{d.is_available ? ' · ✅' : ' · 🔴'}{onAnother ? ' (on another truck)' : ''}</option>;
                  })}
                </select>
              </div>
              {selectedDriver && (() => {
                const d = drivers.find(dr => dr.user_id === selectedDriver);
                if (!d) return null;
                const name = d.user?.full_name || d.full_name || 'Unknown';
                return (
                  <div style={s.driverPreview}>
                    <div style={{ ...s.driverAvatar, width: 40, height: 40, fontSize: 16 }}>{name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#e8eaf2' }}>{name}</div>
                      <div style={{ fontSize: 12, color: '#8892a4' }}>{d.total_trips || 0} trips · ⭐ {d.avg_rating || 'N/A'} · {d.license_number || 'No license'}</div>
                    </div>
                    <span style={{ ...s.badge, background: d.is_available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: d.is_available ? '#22c55e' : '#ef4444' }}>{d.is_available ? 'Available' : 'Busy'}</span>
                  </div>
                );
              })()}
              <div style={s.modalActions}>
                <button style={s.btnCancel} onClick={() => setShowDriverModal(false)}>Cancel</button>
                <button style={s.btnConfirm} onClick={handleAssignDriver}>{selectedDriver ? '✓ Confirm' : '✓ Unassign'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD VEHICLE MODAL — 3 steps */}
      {showAddModal && (
        <div style={s.modalOverlay} onClick={() => { setShowAddModal(false); resetAdd(); }}>
          <div style={{ ...s.modal, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Register Vehicle</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {['Details', 'Compliance', 'Photos & Docs'].map((lbl, i) => (
                  <div key={lbl} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: addStep === i+1 ? '#e8a020' : addStep > i+1 ? 'rgba(34,197,94,0.2)' : '#181e2d',
                    color: addStep === i+1 ? '#000' : addStep > i+1 ? '#22c55e' : '#545f73' }}
                    onClick={() => setAddStep(i+1)}>
                    {addStep > i+1 ? '✓ ' : `${i+1}. `}{lbl}
                  </div>
                ))}
                <button style={s.modalClose} onClick={() => { setShowAddModal(false); resetAdd(); }}>✕</button>
              </div>
            </div>

            <div style={{ ...s.modalBody, maxHeight: '76vh', overflowY: 'auto' }}>

              {/* STEP 1 */}
              {addStep === 1 && (
                <>
                  <div style={s.formGroup}>
                    <label style={s.label}>Ownership Type</label>
                    <div style={s.ownershipToggle}>
                      <button style={{ ...s.toggleBtn, ...(ownershipType === 'vg_owned' ? s.toggleActive : {}) }} onClick={() => setOwnershipType('vg_owned')}>🏢 VG-Owned</button>
                      <button style={{ ...s.toggleBtn, ...(ownershipType === 'contracted' ? s.toggleActive : {}) }} onClick={() => setOwnershipType('contracted')}>🤝 Contracted</button>
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Manufacturer * <span style={{ color: '#545f73', fontWeight: 400 }}>(Full company name)</span></label>
                      <input style={s.input} placeholder="e.g. Isuzu Motors Ltd" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Make / Brand *</label>
                      <input style={s.input} placeholder="e.g. Isuzu" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Model *</label>
                      <input style={s.input} placeholder="e.g. NQR" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Model Number</label>
                      <input style={s.input} placeholder="e.g. NQR75L-K" value={form.model_number} onChange={e => setForm({ ...form, model_number: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Plate Number * <span style={{ color: '#545f73', fontWeight: 400 }}>(Kenya format)</span></label>
                      <input style={s.input} placeholder="e.g. KDE 456T" value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value.toUpperCase() })} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Year of Manufacture</label>
                      <input style={s.input} placeholder="e.g. 2020" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Engine Number</label>
                      <input style={s.input} placeholder="e.g. 4HG1-123456" value={form.engine_number} onChange={e => setForm({ ...form, engine_number: e.target.value })} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Chassis Number (VIN)</label>
                      <input style={s.input} placeholder="17-char VIN" value={form.chassis_number} onChange={e => setForm({ ...form, chassis_number: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Logbook Number (NTSA)</label>
                      <input style={s.input} placeholder="e.g. LB-2020-1234567" value={form.logbook_number} onChange={e => setForm({ ...form, logbook_number: e.target.value })} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Colour</label>
                      <input style={s.input} placeholder="e.g. White" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Body Type</label>
                      <select style={{ ...s.input, cursor: 'pointer' }} value={form.body_type} onChange={e => setForm({ ...form, body_type: e.target.value })}>
                        <option value="">Select...</option>
                        {['Flatbed','Curtainsider','Box Body','Tipper','Tanker','Refrigerated','Low Bed','Open'].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>No. of Axles</label>
                      <input style={s.input} placeholder="e.g. 2" value={form.axles} onChange={e => setForm({ ...form, axles: e.target.value })} />
                    </div>
                  </div>
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Vehicle Type *</label>
                      <select style={{ ...s.input, cursor: 'pointer' }} value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
                        {['motorcycle','van','pickup','truck','articulated'].map(t => <option key={t} value={t}>{typeIcons[t]} {t}</option>)}
                      </select>
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>Company / Brand Name</label>
                      <input style={s.input} placeholder="e.g. Kamau Transport Ltd" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div style={s.formGroup}>
                      <label style={s.label}>GVW (kg)</label>
                      <input style={s.input} placeholder="e.g. 14500" value={form.gvw_kg} onChange={e => setForm({ ...form, gvw_kg: e.target.value })} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>Tare Weight (kg)</label>
                      <input style={s.input} placeholder="e.g. 6500" value={form.tare_weight_kg} onChange={e => setForm({ ...form, tare_weight_kg: e.target.value })} />
                    </div>
                    <div style={s.formGroup}>
                      <label style={s.label}>Cargo Capacity (kg)</label>
                      <input style={s.input} placeholder="e.g. 8000" value={form.cargo_capacity_kg} onChange={e => setForm({ ...form, cargo_capacity_kg: e.target.value })} />
                    </div>
                  </div>

                  {ownershipType === 'contracted' && (
                    <>
                      <div style={s.divider} />
                      <div style={{ fontSize: 12, color: '#2dd4bf', fontWeight: 600, marginBottom: 12 }}>🤝 Owner / Contractor Details</div>
                      {transporters.length > 0 && (
                        <div style={s.formGroup}>
                          <label style={s.label}>Link to Registered Transporter</label>
                          <select style={{ ...s.input, cursor: 'pointer' }} value={form.owner_user_id} onChange={e => handleTransporterSelect(e.target.value)}>
                            <option value="">— Select transporter or fill manually —</option>
                            {transporters.map(t => <option key={t.id} value={t.id}>{t.full_name} · {t.phone}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={s.formGroup}>
                        <label style={s.label}>Owner Full Name</label>
                        <input style={s.input} placeholder="Vehicle owner name" value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} />
                      </div>
                      <div style={s.formRow}>
                        <div style={{ ...s.formGroup, flex: 1 }}>
                          <label style={s.label}>Owner Phone</label>
                          <input style={s.input} placeholder="+254..." value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })} />
                        </div>
                        <div style={{ ...s.formGroup, flex: 1 }}>
                          <label style={s.label}>M-Pesa Number</label>
                          <input style={s.input} placeholder="+254..." value={form.owner_mpesa} onChange={e => setForm({ ...form, owner_mpesa: e.target.value })} />
                        </div>
                      </div>
                      <div style={s.formRow}>
                        <div style={{ ...s.formGroup, flex: 1 }}>
                          <label style={s.label}>Payment Structure</label>
                          <select style={{ ...s.input, cursor: 'pointer' }} value={form.payment_structure} onChange={e => setForm({ ...form, payment_structure: e.target.value })}>
                            <option value="commission">Commission %</option>
                            <option value="revenue_share">Revenue Share %</option>
                            <option value="per_trip">Per Trip (KES)</option>
                          </select>
                        </div>
                        <div style={{ ...s.formGroup, flex: 1 }}>
                          <label style={s.label}>Rate</label>
                          <input style={s.input} placeholder={form.payment_structure === 'per_trip' ? 'KES per trip' : '% rate'} value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP 2 */}
              {addStep === 2 && (
                <>
                  <div style={{ fontSize: 13, color: '#8892a4', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    📋 Enter Kenya NTSA compliance document expiry dates. These are monitored — you will be alerted 30 days before expiry.
                  </div>
                  {[
                    { key: 'insurance_expiry',          label: '🛡️ Insurance Certificate Expiry' },
                    { key: 'ntsa_expiry',               label: '🔍 NTSA Inspection Certificate Expiry' },
                    { key: 'inspection_expiry',         label: '📋 Inspection Certificate Expiry' },
                    { key: 'road_service_levy_expiry',  label: '🛣️ Road Service Levy Expiry' },
                    { key: 'axle_load_cert_expiry',     label: '⚖️ Axle Load / Overload Permit Expiry' },
                    { key: 'fire_extinguisher_expiry',  label: '🧯 Fire Extinguisher Certificate Expiry' },
                  ].map(({ key, label }) => (
                    <div key={key} style={s.formGroup}>
                      <label style={s.label}>{label}</label>
                      <input type="date" style={s.input} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                      {form[key] && (
                        <div style={{ fontSize: 11, color: expColor(form[key]), marginTop: 4 }}>
                          {fmt(form[key])} — {Math.ceil((new Date(form[key]) - new Date()) / 86400000)} days remaining
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* STEP 3 */}
              {addStep === 3 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.sectionLabel}>🚛 Truck Photos — Camera Only</div>
                    <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                      ⚠️ Photos must be taken live from camera to verify current look and condition. File upload is not allowed.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {TRUCK_VIEWS.map(view => (
                        <CameraCapture key={view.key} label={view.label} icon={view.icon}
                          value={photos[view.key]}
                          onChange={val => setPhotos(prev => ({ ...prev, [view.key]: val }))}
                          onClear={() => setPhotos(prev => ({ ...prev, [view.key]: '' }))} />
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={s.sectionLabel}>👤 Driver Photo at Registration</div>
                    <div style={{ fontSize: 12, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                      ⚠️ Driver must be photographed live — confirms identity and condition at time of registration.
                    </div>
                    <CameraCapture label="Driver Photo" icon="📸"
                      value={photos.driver_photo}
                      onChange={val => setPhotos(prev => ({ ...prev, driver_photo: val }))}
                      onClear={() => setPhotos(prev => ({ ...prev, driver_photo: '' }))} />
                  </div>

                  <div>
                    <div style={s.sectionLabel}>📁 Compliance Documents</div>
                    <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 10 }}>Upload scanned copies or PDFs of Kenya compliance documents.</div>
                    {KE_DOCS.map(({ key, label }) => (
                      <div key={key} style={{ ...s.formGroup, display: 'flex', alignItems: 'center', gap: 10, background: '#181e2d', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ flex: 1, fontSize: 13, color: docs[key] ? '#22c55e' : '#8892a4' }}>
                          {docs[key] ? '✅' : '📄'} {label}
                          {docs[key] && <span style={{ fontSize: 11, color: '#22c55e', marginLeft: 8 }}>{docs[key].name}</span>}
                        </div>
                        <label style={{ ...s.btnSm, cursor: 'pointer', color: '#e8a020', borderColor: 'rgba(232,160,32,0.3)', padding: '5px 14px' }}>
                          {docs[key] ? 'Change' : 'Upload'}
                          <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && setDocs(prev => ({ ...prev, [key]: e.target.files[0] }))} />
                        </label>
                        {docs[key] && (
                          <button style={{ ...s.btnSm, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }} onClick={() => setDocs(prev => ({ ...prev, [key]: null }))}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 10 }}>
                {addStep > 1
                  ? <button style={s.btnCancel} onClick={() => setAddStep(addStep - 1)}>← Back</button>
                  : <button style={s.btnCancel} onClick={() => { setShowAddModal(false); resetAdd(); }}>Cancel</button>
                }
                {addStep < 3
                  ? <button style={s.btnConfirm} onClick={() => setAddStep(addStep + 1)}>Next →</button>
                  : <button style={s.btnConfirm} onClick={handleAddVehicle}>✓ Register Vehicle</button>
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

const cs = {
  camBox: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, minHeight: 110, display: 'flex', flexDirection: 'column', gap: 8 },
  camLabel: { fontSize: 12, fontWeight: 600, color: '#8892a4' },
  camTrigger: { background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.25)', color: '#e8a020', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' },
  camLive: { display: 'flex', flexDirection: 'column', gap: 8 },
  video: { width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 160 },
  camControls: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  btnCapture: { background: '#e8a020', border: 'none', color: '#000', borderRadius: 8, padding: '8px 0', fontWeight: 700, cursor: 'pointer', fontSize: 13 },
  btnCancelCam: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13 },
  camPreview: { display: 'flex', flexDirection: 'column', gap: 6 },
  previewImg: { width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 140 },
  btnRetake: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, padding: '5px 0', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  camError: { fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '6px 10px' },
};

const s = {
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sectionTitle: { fontWeight: 700, fontSize: 18, color: '#e8eaf2', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#8892a4' },
  btnPrimary: { background: '#e8a020', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 },
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' },
  statIcon: { position: 'absolute', right: 16, top: 16, fontSize: 24, opacity: 0.12 },
  statLabel: { fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  statValue: { fontWeight: 800, fontSize: 28 },
  panel: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap', gap: 10 },
  tabs: { display: 'flex', gap: 4 },
  tab: { background: 'transparent', border: '1px solid transparent', borderRadius: 8, padding: '6px 14px', color: '#8892a4', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { background: '#1f2840', color: '#e8eaf2', borderColor: 'rgba(255,255,255,0.07)' },
  tabCount: { background: '#181e2d', borderRadius: 10, padding: '1px 7px', fontSize: 11, color: '#545f73' },
  tabCountActive: { background: '#e8a020', color: '#000', fontWeight: 700 },
  search: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '6px 12px', color: '#e8eaf2', fontSize: 13, width: 220, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 11, color: '#545f73', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 600 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 16px', fontSize: 13, color: '#e8eaf2' },
  emptyCell: { padding: '48px 16px', textAlign: 'center' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 40, opacity: 0.3 },
  emptyTitle: { fontSize: 15, fontWeight: 600, color: '#8892a4' },
  emptySub: { fontSize: 13, color: '#545f73' },
  vehicleCell: { display: 'flex', alignItems: 'center', gap: 10 },
  vehicleIconBox: { fontSize: 20, background: '#181e2d', borderRadius: 8, padding: 6, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vehicleName: { fontWeight: 600, fontSize: 13, color: '#e8eaf2' },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  driverCell: { display: 'flex', alignItems: 'center', gap: 8 },
  driverAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(45,212,191,0.2)', color: '#2dd4bf', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  unassigned: { fontSize: 12, color: '#545f73', fontStyle: 'italic' },
  actionBtns: { display: 'flex', gap: 6 },
  btnSm: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, width: '95%', maxWidth: 460 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 10, flexWrap: 'wrap' },
  modalTitle: { fontWeight: 600, fontSize: 15, color: '#e8eaf2' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer' },
  modalBody: { padding: 20 },
  vehicleSummary: { display: 'flex', alignItems: 'center', gap: 12, background: '#181e2d', borderRadius: 10, padding: 14, marginBottom: 16 },
  driverPreview: { display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.15)', borderRadius: 10, padding: 12, marginTop: 10, marginBottom: 4 },
  formGroup: { marginBottom: 14 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '10px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  ownershipToggle: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  toggleBtn: { padding: 10, background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  toggleActive: { background: 'rgba(232,160,32,0.15)', borderColor: 'rgba(232,160,32,0.4)', color: '#e8a020', fontWeight: 700 },
  divider: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0 16px' },
  modalActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  btnCancel: { padding: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  btnConfirm: { padding: 11, background: '#e8a020', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#e8a020', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  infoCell: { background: '#181e2d', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' },
  infoCellLabel: { fontSize: 11, color: '#545f73', marginBottom: 3 },
  infoCellValue: { fontSize: 13, fontWeight: 600, color: '#e8eaf2' },
  photoLabel: { position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, borderRadius: 4, padding: '2px 6px' },
};
