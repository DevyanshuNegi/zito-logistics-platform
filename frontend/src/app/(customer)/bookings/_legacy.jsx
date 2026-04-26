import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useSocket } from '../contexts/SocketContext';

const VEHICLE_TYPES = [
  { key: 'bicycle',      icon: '🚲', label: 'Bicycle'       },
  { key: 'motorcycle',   icon: '🏍️', label: 'Motorcycle'    },
  { key: 'tuk_tuk',      icon: '🛺', label: 'Tuk-Tuk'       },
  { key: 'car',          icon: '🚗', label: 'Car'            },
  { key: 'suv',          icon: '🚙', label: 'SUV'            },
  { key: 'van',          icon: '🚐', label: 'Van'            },
  { key: 'pickup',       icon: '🛻', label: 'Pickup'         },
  { key: 'reefer_van',   icon: '🧊', label: 'Reefer Van'     },
  { key: 'truck_1t',     icon: '🚛', label: '1T Truck'       },
  { key: 'truck_3t',     icon: '🚛', label: '3T Truck'       },
  { key: 'truck_7t',     icon: '🚚', label: '7T Truck'       },
  { key: 'articulated',  icon: '🚜', label: '18-Wheeler'     },
  { key: 'reefer_truck', icon: '❄️', label: 'Reefer Truck'   },
  { key: 'flatbed',      icon: '🏗️', label: 'Flatbed'        },
  { key: 'tipper',       icon: '⛏️', label: 'Tipper'         },
  { key: 'tanker',       icon: '🛢️', label: 'Tanker'         },
];

const statusColors = {
  pending:    { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  assigned:   { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  in_transit: { bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf' },
  completed:  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  cancelled:  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
};

const emptyForm = {
  pickup_address: '',
  delivery_address: '',
  pickup_lat: '',
  pickup_lng: '',
  delivery_lat: '',
  delivery_lng: '',
  cargo_type: '',
  cargo_weight_kg: '',
  vehicle_type: 'van',
  special_instructions: '',
  requested_at: '',
  customer_name: '',
  customer_phone: '',
  customer_id: '',
  distance_km: '',
  is_urgent: false,
};

export default function Bookings() {
  const navigate = useNavigate();
  const socket = useSocket();
  const [bookings, setBookings]         = useState([]);
  const [drivers, setDrivers]           = useState([]);
  const [customers, setCustomers]        = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('all');
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [step, setStep]                 = useState(1);
  const [toast, setToast]               = useState(null);
  const [assignModal, setAssignModal]   = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');

  // ── Price calculator state ──
  const [priceCalc, setPriceCalc]       = useState(null);
  const [calcLoading, setCalcLoading]   = useState(false);

  const fetchBookings = () => {
    api.get('/api/v1/bookings')
      .then(res => setBookings(res.data.data || []))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
    api.get('/api/v1/users?role=driver&is_verified=true')
      .then(res => setDrivers(res.data.data || []))
      .catch(() => setDrivers([]));

    api.get('/api/v1/users?role=customer')
      .then(res => setCustomers(res.data.data || []))
      .catch(() => setCustomers([]));
  }, []);

  // ── Socket.io real-time updates ──
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data) => {
      console.log('📡 Booking status updated:', data);
      setBookings(prev =>
        prev.map(b =>
          b.id === data.booking_id ? data.booking : b
        )
      );
      showToast(`✅ Booking ${data.booking_reference} → ${data.new_status.replace('_', ' ')}`, 'info');
    };

    const handleBookingCreated = (data) => {
      console.log('📡 New booking created:', data);
      setBookings(prev => [data.booking, ...prev]);
      showToast(`✅ New booking ${data.booking_reference} created`, 'success');
    };

    const handleDriverAssigned = (data) => {
      console.log('📡 Driver assigned:', data);
      setBookings(prev =>
        prev.map(b =>
          b.id === data.booking_id ? { ...b, assigned_driver_id: data.driver_id } : b
        )
      );
      showToast(`✅ Driver assigned to ${data.booking_reference}`, 'info');
    };

    socket.on('booking:status_updated', handleStatusUpdate);
    socket.on('booking:created', handleBookingCreated);
    socket.on('booking:driver_assigned', handleDriverAssigned);

    return () => {
      socket.off('booking:status_updated', handleStatusUpdate);
      socket.off('booking:created', handleBookingCreated);
      socket.off('booking:driver_assigned', handleDriverAssigned);
    };
  }, [socket]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const tabs = [
    { key: 'all',        label: 'All'        },
    { key: 'pending',    label: 'Pending'    },
    { key: 'assigned',   label: 'Assigned'   },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'completed',  label: 'Completed'  },
    { key: 'cancelled',  label: 'Cancelled'  },
  ];

  const filtered = bookings.filter(b =>
    activeTab === 'all' ? true : b.status === activeTab
  );

  const openModal = () => {
    setForm(emptyForm);
    setStep(1);
    setSubmitError('');
    setPriceCalc(null);
    setShowModal(true);
  };

  // ── Calculate price from API ──
  const handleCalculatePrice = async () => {
    if (!form.vehicle_type || !form.distance_km) {
      setSubmitError('Please enter distance to calculate price.');
      return;
    }
    setCalcLoading(true);
    setSubmitError('');
    try {
      const res = await api.post('/api/v1/bookings/calculate-price', {
        customer_id:     form.customer_id,
        vehicle_type:    form.vehicle_type,
        distance_km:     parseFloat(form.distance_km),
        cargo_weight_kg: parseFloat(form.cargo_weight_kg) || 0,
        is_urgent:       form.is_urgent,
      });
      setPriceCalc(res.data.data);
    } catch (err) {
      setSubmitError('Failed to calculate price. Try again.');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.customer_id || !form.pickup_address || !form.delivery_address || !form.cargo_type) {
      setSubmitError('Please fill all required fields.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post('/api/v1/bookings', {
        customer_id:          form.customer_id,
        pickup_address:       form.pickup_address,
        delivery_address:     form.delivery_address,
        cargo_type:           form.cargo_type,
        cargo_weight_kg:      parseFloat(form.cargo_weight_kg) || 0,
        vehicle_type:         form.vehicle_type,
        special_instructions: form.special_instructions,
        requested_at:         form.requested_at || new Date().toISOString(),
        distance_km:          parseFloat(form.distance_km) || null,
        is_urgent:            form.is_urgent,
        estimated_fare:       priceCalc?.estimated_fare || null,
      });
      setBookings(prev => [res.data.data, ...prev]);
      setShowModal(false);
      showToast('✅ Booking created successfully');
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDriver) { showToast('Please select a driver', 'error'); return; }
    try {
      await api.patch(`/api/v1/bookings/${assignModal.bookingId}/assign`, { driver_id: selectedDriver });
      showToast(`✅ Driver assigned to ${assignModal.ref}`);
      setAssignModal(null);
      setSelectedDriver('');
      fetchBookings();
    } catch (err) {
      showToast('Failed to assign driver', 'error');
    }
  };

  const handleCancel = async (id, ref) => {
    if (!window.confirm(`Cancel booking ${ref}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/bookings/${id}`);
      showToast(`❌ Booking ${ref} cancelled`);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to cancel booking', 'error');
    }
  };

  const f = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));

    if (['vehicle_type', 'distance_km', 'cargo_weight_kg', 'is_urgent'].includes(key)) {
      setPriceCalc(null);
    }
  };

  useEffect(() => {

  if (!form.pickup_lat || !form.delivery_lat) return;

  const fetchDistance = async () => {
    try {
       const res = await fetch(
         `https://router.project-osrm.org/route/v1/driving/${form.pickup_lng},${form.pickup_lat};${form.delivery_lng},${form.delivery_lat}?overview=false`
       );

       const data = await res.json();

       const km = data.routes[0].distance / 1000;

       f('distance_km', km.toFixed(2));

     } catch (err) {
       console.error('Distance error');
     }
   };

      fetchDistance();

    }, [form.pickup_lat, form.delivery_lat]);
    


  return (
    <Layout title="Trip Management">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
          background: toast.type === 'error' ? '#dc2626' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Assign Driver Modal ── */}
      {assignModal && (
        <div style={s.modalOverlay} onClick={() => setAssignModal(null)}>
          <div style={{ ...s.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>Assign Driver</div>
                <div style={s.modalSub}>Booking: {assignModal.ref}</div>
              </div>
              <button style={s.modalClose} onClick={() => setAssignModal(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.formGroup}>
                <label style={s.label}>Select Available Driver</label>
                <select
                  style={{ ...s.input, cursor: 'pointer' }}
                  value={selectedDriver}
                  onChange={e => setSelectedDriver(e.target.value)}
                >
                  <option value="">— Choose driver —</option>
                  {drivers.length === 0
                    ? <option disabled>No verified drivers found</option>
                    : drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} — {d.phone}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div style={s.modalActions}>
                <button style={s.btnCancel} onClick={() => setAssignModal(null)}>Cancel</button>
                <button style={{ ...s.btnPrimary, padding: 12 }} onClick={handleAssign}>
                  ✓ Assign Driver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Trip Management</div>
          <div style={s.sectionSub}>Create and manage all customer bookings</div>
        </div>
        <button style={s.btnPrimary} onClick={openModal}>+ New Booking</button>
      </div>

      {/* ── Stats ── */}
      <div style={s.statGrid}>
        {[
          { label: 'TOTAL',      color: '#e8a020', val: bookings.length },
          { label: 'PENDING',    color: '#f59e0b', val: bookings.filter(b => b.status === 'pending').length },
          { label: 'IN TRANSIT', color: '#2dd4bf', val: bookings.filter(b => b.status === 'in_transit').length },
          { label: 'COMPLETED',  color: '#22c55e', val: bookings.filter(b => b.status === 'completed').length },
          { label: 'CANCELLED',  color: '#ef4444', val: bookings.filter(b => b.status === 'cancelled').length },
        ].map((stat, i) => (
          <div key={i} style={{ ...s.statCard, borderTop: `2px solid ${stat.color}` }}>
            <div style={s.statLabel}>{stat.label}</div>
            <div style={{ ...s.statValue, color: stat.color }}>{loading ? '—' : stat.val}</div>
          </div>
        ))}
      </div>

      {/* ── Table panel ── */}
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <div style={s.tabs}>
            {tabs.map(t => (
              <button key={t.key}
                style={{ ...s.tab, ...(activeTab === t.key ? s.tabActive : {}) }}
                onClick={() => setActiveTab(t.key)}>
                {t.label}
                <span style={{ ...s.tabCount, ...(activeTab === t.key ? s.tabCountActive : {}) }}>
                  {t.key === 'all' ? bookings.length : bookings.filter(b => b.status === t.key).length}
                </span>
              </button>
            ))}
          </div>
          <input style={s.search} placeholder="Search bookings..." />
        </div>

        <table style={s.table}>
          <thead>
            <tr>
              {['BOOKING', 'CUSTOMER', 'PICKUP', 'DELIVERY', 'VEHICLE', 'DRIVER', 'STATUS', 'FARE', 'DATE', 'ACTIONS'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={s.emptyCell}>Loading bookings...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={s.emptyCell}>
                <div style={s.emptyState}>
                  <div style={s.emptyIcon}>📋</div>
                  <div style={s.emptyTitle}>No bookings found</div>
                  <div style={s.emptySub}>Click "+ New Booking" to create the first one</div>
                </div>
              </td></tr>
            ) : filtered.map(b => {
              const sc  = statusColors[b.status] || { bg: 'rgba(255,255,255,0.05)', color: '#8892a4' };
              const ref = b.reference || b.id?.slice(0, 8);
              const vt  = VEHICLE_TYPES.find(v => v.key === b.vehicle_type);
              return (
                <tr key={b.id} style={{ ...s.tr, cursor: 'pointer' }}
                  onClick={() => navigate(`/trip/${b.id}`, { state: { booking: b } })}>
                  <td style={s.td}><span style={s.chip}>{ref}</span></td>
                  <td style={{ ...s.td, fontWeight: 500 }}>{b.customer?.full_name || '—'}</td>
                  <td style={{ ...s.td, fontSize: 12, color: '#8892a4', maxWidth: 120 }}>
                    {b.pickup_address?.split(',')[0] || '—'}
                  </td>
                  <td style={{ ...s.td, fontSize: 12, color: '#8892a4', maxWidth: 120 }}>
                    {b.delivery_address?.split(',')[0] || '—'}
                  </td>
                  <td style={{ ...s.td, fontSize: 12 }}>
                    {vt ? `${vt.icon} ${vt.label}` : b.vehicle_type || '—'}
                  </td>
                  <td style={{ ...s.td, fontSize: 12 }}>
                    {b.assignedDriver?.full_name || <span style={{ color: '#545f73', fontStyle: 'italic' }}>Unassigned</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, background: sc.bg, color: sc.color }}>
                      {b.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 600, color: '#22c55e', fontSize: 13 }}>
                    {b.estimated_fare ? `KES ${parseFloat(b.estimated_fare).toLocaleString()}` : '—'}
                  </td>
                  <td style={{ ...s.td, fontSize: 11, color: '#8892a4' }}>
                    {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {b.status === 'approved' && (
                      <button style={s.actionBtn}
                        onClick={() => setAssignModal({ bookingId: b.id, ref })}>
                        Assign
                      </button>
                    )}
                    {!['completed', 'cancelled', 'in_transit'].includes(b.status) && (
                      <button
                        style={{ ...s.actionBtn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', marginLeft: 4 }}
                        onClick={() => handleCancel(b.id, ref)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New Booking Modal ── */}
      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>

            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>New Booking</div>
                <div style={s.modalSub}>Step {step} of 2 — {step === 1 ? 'Route & Cargo' : 'Vehicle & Price'}</div>
              </div>
              <button style={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div style={s.stepBar}>
              <div style={{ ...s.stepItem, ...(step >= 1 ? s.stepActive : {}) }}>
                <div style={{ ...s.stepDot, ...(step >= 1 ? s.stepDotActive : {}) }}>1</div>
                <span>Route & Cargo</span>
              </div>
              <div style={s.stepLine} />
              <div style={{ ...s.stepItem, ...(step >= 2 ? s.stepActive : {}) }}>
                <div style={{ ...s.stepDot, ...(step >= 2 ? s.stepDotActive : {}) }}>2</div>
                <span>Vehicle & Price</span>
              </div>
            </div>

            <div style={s.modalBody}>

              {step === 1 && (
                <>
                  <div style={s.formGroup}>
                    <label style={s.label}>🏢 Customer</label>
                    <select
                      style={{ ...s.input, cursor: 'pointer' }}
                      value={form.customer_id}
                      onChange={e => f('customer_id', e.target.value)}
                    >
                      <option value="">— Select Customer —</option>

                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                       ))}
                    </select>
                  </div>

                  <div style={s.formGroup}>
                    <label style={s.label}>📍 Pickup Address *</label>

                    <input
                      style={s.input}
                      placeholder="Search pickup location"
                      value={form.pickup_address}
                      onChange={async (e) => {
                        const q = e.target.value;
                        f('pickup_address', q);

                        if (q.length < 3) return;

                        const res = await fetch(
                          `https://nominatim.openstreetmap.org/search?format=json&q=${q}`
                        );
                        const data = await res.json();

                        if (data[0]) {
                          f('pickup_lat', data[0].lat);
                          f('pickup_lng', data[0].lon);
                        }
                      }}
                    />
                  </div>

                  <div style={s.formGroup}>
                    <label style={s.label}>🏁 Delivery Address *</label>

                    <input
                      style={s.input}
                      placeholder="Search delivery location"
                      value={form.delivery_address}
                      onChange={async (e) => {
                        const q = e.target.value;
                        f('delivery_address', q);

                        if (q.length < 3) return;

                        const res = await fetch(
                          `https://nominatim.openstreetmap.org/search?format=json&q=${q}`
                        );
                        const data = await res.json();

                        if (data[0]) {
                          f('delivery_lat', data[0].lat);
                          f('delivery_lng', data[0].lon);
                        }
                      }}
                    />
                  </div>

                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>📦 Cargo Type *</label>
                      <input style={s.input}
                        placeholder="e.g. Electronics, FMCG"
                        value={form.cargo_type}
                        onChange={e => f('cargo_type', e.target.value)} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>⚖️ Weight (kg)</label>
                      <input style={s.input} type="number"
                        placeholder="e.g. 1500"
                        value={form.cargo_weight_kg}
                        onChange={e => f('cargo_weight_kg', e.target.value)} />
                    </div>
                  </div>

                  <div style={s.formGroup}>
                    <label style={s.label}>📝 Special Instructions</label>
                    <textarea style={{ ...s.input, height: 72, resize: 'none' }}
                      placeholder="e.g. Fragile items, requires tail lift, gate code: 1234..."
                      value={form.special_instructions}
                      onChange={e => f('special_instructions', e.target.value)} />
                  </div>

                  <button style={{ ...s.btnPrimary, width: '100%', padding: 12 }}
                    onClick={() => {
                      if (!form.pickup_address || !form.delivery_address || !form.cargo_type) {
                        setSubmitError('Please fill Pickup, Delivery and Cargo Type.');
                        return;
                      }
                      setSubmitError('');
                      setStep(2);
                    }}>
                    Next: Vehicle & Price →
                  </button>
                  {submitError && <div style={{ ...s.errorBox, marginTop: 10 }}>⚠️ {submitError}</div>}
                </>
              )}

              {step === 2 && (
                <>
                  {/* Route summary */}
                  <div style={s.routeSummary}>
                    <div style={s.routeRow}>
                      <span style={s.routeDot}>📍</span>
                      <span style={s.routeText}>{form.pickup_address}</span>
                    </div>
                    <div style={s.routeLine} />
                    <div style={s.routeRow}>
                      <span style={s.routeDot}>🏁</span>
                      <span style={s.routeText}>{form.delivery_address}</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#8892a4' }}>
                      📦 {form.cargo_type} {form.cargo_weight_kg ? `· ${form.cargo_weight_kg} kg` : ''}
                    </div>
                  </div>

                  {/* Vehicle selector */}
                  <div style={s.formGroup}>
                    <label style={s.label}>🚛 Vehicle Type Required *</label>
                    <div style={s.vehicleGrid}>
                      {VEHICLE_TYPES.map(vt => (
                        <button key={vt.key}
                          style={{ ...s.vehicleOption, ...(form.vehicle_type === vt.key ? s.vehicleOptionActive : {}) }}
                          onClick={() => f('vehicle_type', vt.key)}>
                          <div style={s.vehicleOptionIcon}>{vt.icon}</div>
                          <div style={{ fontSize: 10, textAlign: 'center', color: form.vehicle_type === vt.key ? '#e8a020' : '#8892a4' }}>
                            {vt.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Distance + urgent */}
                  <div style={s.formRow}>
                    <div style={{ ...s.formGroup, flex: 1 }}>
                      <label style={s.label}>📏 Distance (km) *</label>
                      <input style={s.input} type="number"
                        placeholder="e.g. 450"
                        value={form.distance_km}
                        onChange={e => f('distance_km', e.target.value)} />
                    </div>
                    <div style={{ ...s.formGroup, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={form.is_urgent}
                          onChange={e => f('is_urgent', e.target.checked)}
                          style={{ width: 16, height: 16 }} />
                        ⚡ Urgent (+25%)
                      </label>
                    </div>
                  </div>

                  {/* Calculate button */}
                  <button
                    style={{ ...s.btnPrimary, width: '100%', padding: 10, marginBottom: 12, opacity: calcLoading ? 0.7 : 1 }}
                    onClick={handleCalculatePrice}
                    disabled={calcLoading}>
                    {calcLoading ? 'Calculating...' : '🧮 Calculate Price'}
                  </button>

                  {/* Price breakdown */}
                  {priceCalc && (
                    <div style={s.priceBox}>
                      <div style={s.priceTitle}>💰 Price Breakdown</div>
                      <div style={s.priceRow}>
                        <span>Base rate</span>
                        <span>KES {priceCalc.base_rate_per_km}/km × {priceCalc.distance_km} km</span>
                      </div>
                      <div style={s.priceRow}>
                        <span>Subtotal</span>
                        <span>KES {priceCalc.subtotal?.toLocaleString()}</span>
                      </div>
                      {priceCalc.weight_surcharge > 0 && (
                        <div style={s.priceRow}>
                          <span>Weight surcharge</span>
                          <span>+ KES {priceCalc.weight_surcharge?.toLocaleString()}</span>
                        </div>
                      )}
                      {priceCalc.urgent_surcharge > 0 && (
                        <div style={s.priceRow}>
                          <span>Urgent surcharge</span>
                          <span>+ KES {priceCalc.urgent_surcharge?.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={s.priceDivider} />
                      <div style={{ ...s.priceRow, fontWeight: 700, fontSize: 16 }}>
                        <span style={{ color: '#e8eaf2' }}>Estimated Total</span>
                        <span style={{ color: '#22c55e' }}>KES {priceCalc.estimated_fare?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Schedule */}
                  <div style={s.formGroup}>
                    <label style={s.label}>🗓️ Requested Pickup Date & Time</label>
                    <input style={s.input} type="datetime-local"
                      value={form.requested_at}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={e => f('requested_at', e.target.value)} />
                  </div>

                  {submitError && <div style={s.errorBox}>⚠️ {submitError}</div>}

                  <div style={s.modalActions}>
                    <button style={s.btnCancel} onClick={() => setStep(1)}>← Back</button>
                    <button
                      style={{ ...s.btnPrimary, padding: 12, opacity: submitting ? 0.6 : 1 }}
                      onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Creating...' : '✓ Create Booking'}
                    </button>
                  </div>
                </>
              )}

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
  statCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' },
  statLabel: { fontSize: 11, color: '#545f73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  statValue: { fontWeight: 800, fontSize: 26 },
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
  chip: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontFamily: 'monospace' },
  badge: { borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  actionBtn: { background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.2)', color: '#e8a020', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, background: '#111621', zIndex: 1 },
  modalTitle: { fontWeight: 700, fontSize: 16, color: '#e8eaf2', marginBottom: 2 },
  modalSub: { fontSize: 12, color: '#8892a4' },
  modalClose: { background: 'transparent', border: 'none', color: '#8892a4', fontSize: 18, cursor: 'pointer', marginTop: 2 },
  stepBar: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 8 },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#545f73' },
  stepActive: { color: '#e8eaf2' },
  stepDot: { width: 24, height: 24, borderRadius: '50%', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#545f73', flexShrink: 0 },
  stepDotActive: { background: '#e8a020', border: 'none', color: '#000' },
  stepLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' },
  modalBody: { padding: 20 },
  formGroup: { marginBottom: 16 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500, color: '#8892a4' },
  input: { width: '100%', padding: '10px 12px', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  routeSummary: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 },
  routeRow: { display: 'flex', alignItems: 'center', gap: 10 },
  routeDot: { fontSize: 16, flexShrink: 0 },
  routeText: { fontSize: 13, color: '#e8eaf2', fontWeight: 500 },
  routeLine: { width: 2, height: 16, background: 'rgba(255,255,255,0.1)', margin: '4px 0 4px 8px' },
  vehicleGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 4 },
  vehicleOption: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  vehicleOptionActive: { background: 'rgba(232,160,32,0.1)', borderColor: 'rgba(232,160,32,0.4)' },
  vehicleOptionIcon: { fontSize: 22 },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: 8, padding: '10px 14px', fontSize: 13 },
  modalActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  btnCancel: { padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer' },
  // ── Price calculator styles ──
  priceBox: { background: '#181e2d', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 },
  priceTitle: { fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 12 },
  priceRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8892a4', marginBottom: 6 },
  priceDivider: { height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' },
};