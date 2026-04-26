import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';
import { useSocket } from '../contexts/SocketContext';

// ── Live Map — Vehicle Tracking ────────────────────────────────────────────
// Uses Leaflet (CDN) for map rendering with simulated GPS positions

const STATUS_CFG = {
  in_transit: { color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  label: 'In Transit', icon: '🚛' },
  assigned:   { color: '#6366f1', bg: 'rgba(99,102,241,0.15)', label: 'Assigned',   icon: '📋' },
  available:  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  label: 'Available',  icon: '✓'  },
  offline:    { color: '#545f73', bg: 'rgba(84,95,115,0.15)',  label: 'Offline',    icon: '○'  },
};

// Kenya bounding box roughly: lat 1.5 to -4.7, lng 34 to 42
const KENYA_CITIES = [
  { name: 'Nairobi',    lat: -1.2921, lng: 36.8219 },
  { name: 'Mombasa',   lat: -4.0435, lng: 39.6682 },
  { name: 'Kisumu',    lat: -0.0917, lng: 34.7679 },
  { name: 'Nakuru',    lat: -0.3031, lng: 36.0800 },
  { name: 'Eldoret',   lat:  0.5143, lng: 35.2698 },
  { name: 'Thika',     lat: -1.0332, lng: 37.0693 },
  { name: 'Malindi',   lat: -3.2175, lng: 40.1169 },
  { name: 'Nyeri',     lat: -0.4167, lng: 36.9500 },
];

function randomKenyaPos() {
  const city = KENYA_CITIES[Math.floor(Math.random() * KENYA_CITIES.length)];
  return { lat: city.lat + (Math.random() - 0.5) * 0.5, lng: city.lng + (Math.random() - 0.5) * 0.5, city: city.name };
}

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => deg * (Math.PI / 180);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.offline;
  return <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{cfg.icon} {cfg.label}</span>;
}

export default function LiveMap() {
  const { socket } = useSocket();
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const markersRef  = useRef({});
  const [vehicles,  setVehicles]  = useState([]);
  const [bookings,  setBookings]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [mapReady,  setMapReady]  = useState(false);
  const [lastUpdate,setLastUpdate]= useState(new Date());
  const positionsRef = useRef({});

  // Load Leaflet CSS + JS
  useEffect(() => {
    if (document.getElementById('leaflet-css')) { setMapReady(true); return; }
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Fetch data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/v1/admin/live/drivers');
        const live = res.data.data || res.data || {};
        const vs = (live.drivers || []).map(d => ({
          id: d.id,
          plate_number: d.user?.full_name || `Driver ${d.id.slice(0,6)}`,
          make: 'Driver',
          model: '',
          is_active: d.is_available,
          current_lat: d.current_lat,
          current_lng: d.current_lng,
          location_updated: d.location_updated,
          driver_user_id: d.user_id,
        }));
        const bs = live.activeBookings || [];

        vs.forEach(v => {
          if (v.current_lat && v.current_lng) {
            positionsRef.current[v.id] = { lat: Number(v.current_lat), lng: Number(v.current_lng), city: 'Live' };
          } else if (!positionsRef.current[v.id]) {
            positionsRef.current[v.id] = randomKenyaPos();
          }
        });

        setVehicles(vs);
        setBookings(bs);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Simulate movement for in-transit vehicles
  // Live socket updates
  useEffect(() => {
    if (!socket) return;
    const onLoc = (payload) => {
      const { driver_id, lat, lng } = payload;
      positionsRef.current[driver_id] = { lat: Number(lat), lng: Number(lng), city: 'Live' };
      setVehicles(prev => prev.map(v => v.id === driver_id ? { ...v, current_lat: lat, current_lng: lng } : v));
      setLastUpdate(new Date());
    };
    socket.on('driver:location', onLoc);
    return () => socket.off('driver:location', onLoc);
  }, [socket]);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    if (!L) return;

    leafletMap.current = L.map(mapRef.current, { zoomControl: true }).setView([-1.2921, 37.5], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(leafletMap.current);
  }, [mapReady]);

  // Update markers
  useEffect(() => {
    if (!mapReady || !leafletMap.current || vehicles.length === 0) return;
    const L = window.L;
    if (!L) return;

    vehicles.forEach(v => {
      const pos = positionsRef.current[v.id];
      if (!pos) return;

      const bk       = bookings.find(b => b.vehicle_id === v.id && (b.status === 'in_transit' || b.status === 'assigned'));
      const status   = bk ? bk.status : (v.is_active ? 'available' : 'offline');
      const cfg      = STATUS_CFG[status] || STATUS_CFG.offline;
      const isActive = status === 'in_transit';

      const iconHtml = `
        <div style="position:relative;width:36px;height:36px">
          ${isActive ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${cfg.color};opacity:0.5;animation:ping 1.5s infinite"></div>` : ''}
          <div style="width:36px;height:36px;background:${cfg.color}22;border:2px solid ${cfg.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer">🚛</div>
        </div>`;

      const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });

      if (markersRef.current[v.id]) {
        markersRef.current[v.id].setLatLng([pos.lat, pos.lng]).setIcon(icon);
      } else {
        const marker = L.marker([pos.lat, pos.lng], { icon })
          .addTo(leafletMap.current)
          .on('click', () => setSelected(v.id));
        markersRef.current[v.id] = marker;
      }

      // Popup
      markersRef.current[v.id].bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;min-width:160px">
          <div style="font-weight:800;font-size:15px;color:#e8a020;letter-spacing:1px">${v.plate_number}</div>
          <div style="font-size:12px;color:#666;margin-top:4px">${v.make || ''} ${v.model || ''}</div>
          <div style="margin-top:8px;font-size:12px">${bk ? `📍 ${bk.pickup_location || ''} → ${bk.dropoff_location || ''}` : 'No active trip'}</div>
          <div style="margin-top:6px;font-size:11px;color:${cfg.color};font-weight:700">${cfg.icon} ${cfg.label}</div>
        </div>
      `);
    });
  }, [vehicles, bookings, mapReady]);

  // Get status for a vehicle
  const getVehicleStatus = (v) => {
    const bk = bookings.find(b => b.assigned_driver_id === v.id && (b.status === 'in_transit' || b.status === 'assigned' || b.status === 'picked_up' || b.status === 'accepted'));
    return bk ? bk.status : (v.is_active ? 'available' : 'offline');
  };

  const getActiveBooking = (v) => bookings.find(b => b.assigned_driver_id === v.id && (b.status === 'in_transit' || b.status === 'assigned' || b.status === 'picked_up' || b.status === 'accepted'));

  const getEta = (v) => {
    const bk = getActiveBooking(v);
    const pos = positionsRef.current[v.id];
    if (!bk || !pos) return null;
    const target = bk.status === 'assigned' || bk.status === 'accepted'
      ? { lat: bk.pickup_lat, lng: bk.pickup_lng }
      : { lat: bk.delivery_lat, lng: bk.delivery_lng };
    if (!target.lat || !target.lng) return null;
    const dist = haversineKm(Number(pos.lat), Number(pos.lng), Number(target.lat), Number(target.lng));
    const etaMinutes = Math.round((dist / 40) * 60); // assume 40 km/h avg
    return { distKm: dist.toFixed(1), etaMin: etaMinutes };
  };

  const filteredVehicles = vehicles.filter(v => {
    if (filter === 'all') return true;
    return getVehicleStatus(v) === filter;
  });

  const handleFocusVehicle = (v) => {
    setSelected(v.id);
    const pos = positionsRef.current[v.id];
    if (pos && leafletMap.current) {
      leafletMap.current.setView([pos.lat, pos.lng], 12, { animate: true });
      markersRef.current[v.id]?.openPopup();
    }
  };

  const counts = {
    all:        vehicles.length,
    in_transit: vehicles.filter(v => getVehicleStatus(v) === 'in_transit').length,
    assigned:   vehicles.filter(v => getVehicleStatus(v) === 'assigned').length,
    available:  vehicles.filter(v => getVehicleStatus(v) === 'available').length,
    offline:    vehicles.filter(v => getVehicleStatus(v) === 'offline').length,
  };

  const selectedVehicle = selected ? vehicles.find(v => v.id === selected) : null;
  const selectedBooking = selectedVehicle ? getActiveBooking(selectedVehicle) : null;
  const selectedPos     = selected ? positionsRef.current[selected] : null;

  return (
    <Layout title="Live Map">
      <style>{`
        @keyframes ping { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.3);opacity:.2} }
        .leaflet-popup-content-wrapper { background:#111621!important;border:1px solid rgba(255,255,255,0.1)!important;border-radius:12px!important;color:#e8eaf2!important;box-shadow:0 8px 32px rgba(0,0,0,0.4)!important }
        .leaflet-popup-tip { background:#111621!important }
        .leaflet-popup-close-button { color:#8892a4!important }
        .leaflet-control-zoom a { background:#111621!important;color:#e8eaf2!important;border-color:rgba(255,255,255,0.1)!important }
        .leaflet-control-attribution { background:rgba(0,0,0,0.5)!important;color:#545f73!important;font-size:9px!important }
      `}</style>

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 108px)' }}>
        {/* ── LEFT PANEL ── */}
        <div style={s.panel}>
          {/* Header */}
          <div style={s.panelHeader}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e8eaf2' }}>Fleet Tracker</div>
              <div style={{ fontSize: 11, color: '#545f73', marginTop: 2 }}>
                🟢 Live · Updated {lastUpdate.toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#e8a020' }}>{vehicles.length}</div>
              <div style={{ fontSize: 10, color: '#545f73' }}>vehicles</div>
            </div>
          </div>

          {/* Stats row */}
          <div style={s.statsRow}>
            {[
              { key: 'in_transit', label: 'Moving',    color: '#2dd4bf' },
              { key: 'assigned',   label: 'Assigned',  color: '#6366f1' },
              { key: 'available',  label: 'Free',       color: '#22c55e' },
              { key: 'offline',    label: 'Offline',   color: '#545f73' },
            ].map(s2 => (
              <div key={s2.key} style={{ ...s.statBox, cursor: 'pointer', borderColor: filter === s2.key ? s2.color + '55' : 'rgba(255,255,255,0.07)' }}
                onClick={() => setFilter(filter === s2.key ? 'all' : s2.key)}>
                <div style={{ fontWeight: 800, fontSize: 16, color: s2.color }}>{counts[s2.key]}</div>
                <div style={{ fontSize: 9, color: '#545f73', marginTop: 2 }}>{s2.label}</div>
              </div>
            ))}
          </div>

          {/* Vehicle list */}
          <div style={s.vehicleList}>
            {loading ? (
              <div style={s.empty}>Loading vehicles...</div>
            ) : filteredVehicles.length === 0 ? (
              <div style={s.empty}>No vehicles match filter</div>
            ) : filteredVehicles.map(v => {
              const status = getVehicleStatus(v);
              const bk     = getActiveBooking(v);
              const cfg    = STATUS_CFG[status] || STATUS_CFG.offline;
              const pos    = positionsRef.current[v.id];
              const isSel  = selected === v.id;

              return (
                <div key={v.id}
                  style={{ ...s.vehicleCard, ...(isSel ? { borderColor: cfg.color, background: '#1f2840' } : {}) }}
                  onClick={() => handleFocusVehicle(v)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#e8a020', fontFamily: 'monospace', letterSpacing: 1 }}>{v.plate_number}</div>
                      <div style={{ fontSize: 11, color: '#545f73', marginTop: 1 }}>{v.make} {v.model}</div>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  {bk && (
                    <div style={{ fontSize: 11, color: '#8892a4', marginBottom: 4 }}>
                      <div>▲ {bk.pickup_location || '—'}</div>
                      <div style={{ marginTop: 2 }}>▼ {bk.dropoff_location || '—'}</div>
                    </div>
                  )}
                  {getEta(v) && (
                    <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>
                      ETA {getEta(v).etaMin} min · {getEta(v).distKm} km
                    </div>
                  )}
                  {pos && (
                    <div style={{ fontSize: 10, color: '#545f73' }}>
                      📍 Near {pos.city} · {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                    </div>
                  )}
                  {status === 'in_transit' && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${40 + Math.random() * 40}%`, background: '#2dd4bf', borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{ flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          {!mapReady && (
            <div style={{ position: 'absolute', inset: 0, background: '#111621', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style={{ textAlign: 'center', color: '#8892a4' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🗺</div>
                <div>Loading map...</div>
              </div>
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Selected vehicle overlay */}
          {selectedVehicle && selectedPos && (
            <div style={s.vehicleOverlay}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#e8a020', fontFamily: 'monospace', letterSpacing: 2 }}>{selectedVehicle.plate_number}</div>
                  <div style={{ fontSize: 12, color: '#8892a4', marginTop: 2 }}>{selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.year}</div>
                </div>
                <button style={{ background: 'transparent', border: 'none', color: '#8892a4', cursor: 'pointer', fontSize: 18 }} onClick={() => setSelected(null)}>✕</button>
              </div>
              <StatusBadge status={getVehicleStatus(selectedVehicle)} />
              {selectedBooking && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 11, color: '#545f73', marginBottom: 4 }}>ACTIVE TRIP</div>
                  <div style={{ fontSize: 12, color: '#e8eaf2' }}>▲ {selectedBooking.pickup_location}</div>
                  <div style={{ fontSize: 12, color: '#8892a4', marginTop: 3 }}>▼ {selectedBooking.dropoff_location}</div>
                  {getEta(selectedVehicle) && (
                    <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>
                      ETA {getEta(selectedVehicle).etaMin} min · {getEta(selectedVehicle).distKm} km
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: '#545f73' }}>
                📍 {selectedPos.lat.toFixed(5)}, {selectedPos.lng.toFixed(5)} · Near {selectedPos.city}
              </div>
            </div>
          )}

          {/* Live indicator */}
          <div style={s.liveBadge}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', marginRight: 6, boxShadow: '0 0 6px #22c55e' }} />
            LIVE · {counts.in_transit} moving
          </div>
        </div>
      </div>
    </Layout>
  );
}

const s = {
  panel: { width: 300, flexShrink: 0, background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelHeader: { padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  statBox: { padding: '10px 6px', textAlign: 'center', background: '#181e2d', border: '1px solid transparent', cursor: 'pointer' },
  vehicleList: { flex: 1, overflowY: 'auto', padding: 10 },
  vehicleCard: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s' },
  empty: { textAlign: 'center', color: '#545f73', padding: 32, fontSize: 13 },
  vehicleOverlay: { position: 'absolute', bottom: 20, right: 20, width: 260, background: 'rgba(17,22,33,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, zIndex: 1000 },
  liveBadge: { position: 'absolute', top: 14, right: 14, background: 'rgba(17,22,33,0.9)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#22c55e', zIndex: 1000, display: 'flex', alignItems: 'center' },
};
