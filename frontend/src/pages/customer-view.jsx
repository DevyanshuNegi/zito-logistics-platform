import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { canUseViewAs, getHomePathForRole, normalizeRole } from '../utils/roles';

const VEHICLE_TYPES = [
  'motorcycle',
  'tuk_tuk',
  'car',
  'van',
  'pickup',
  'truck_1t',
  'truck_3t',
  'truck_7t',
];

const buildViewAsConfig = (userId) => (userId
  ? { headers: { 'X-View-As-User': userId } }
  : undefined);

function UserPicker({ role, onSelect }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get(`/api/v1/users?role=${role}`)
      .then((res) => setUsers(res.data?.data || res.data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [role]);

  const filteredUsers = users.filter((entry) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [entry.full_name, entry.email, entry.phone]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div style={styles.centeredCard}>
      <div style={styles.panel}>
        <div style={styles.panelTitle}>Choose {role === 'agent' ? 'an agent' : 'a customer'} to preview</div>
        <input
          style={styles.searchInput}
          placeholder={`Search ${role}s...`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div style={styles.listWrap}>
          {loading && <div style={styles.emptyText}>Loading users...</div>}

          {!loading && filteredUsers.length === 0 && (
            <div style={styles.emptyText}>No matching users found.</div>
          )}

          {!loading && filteredUsers.map((entry) => (
            <button
              key={entry.id}
              type="button"
              style={styles.listButton}
              onClick={() => onSelect(entry)}
            >
              <div>
                <div style={styles.listTitle}>{entry.full_name}</div>
                <div style={styles.listSub}>{entry.email || entry.phone || 'No contact details'}</div>
              </div>
              <span style={styles.arrow}>View</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingComposer({ endpointBase, onClose, onCreated }) {
  const [form, setForm] = useState({
    pickup_address: '',
    delivery_address: '',
    cargo_type: '',
    distance_km: '',
    vehicle_type: 'van',
    cargo_weight_kg: '',
    special_instructions: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await api.post(`${endpointBase}/bookings`, {
        ...form,
        distance_km: Number(form.distance_km || 0),
        cargo_weight_kg: Number(form.cargo_weight_kg || 0),
      });
      onCreated();
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not create the booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalTitle}>Create Booking</div>

        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <input
            style={styles.searchInput}
            placeholder="Pickup address"
            value={form.pickup_address}
            onChange={(event) => updateField('pickup_address', event.target.value)}
            required
          />
          <input
            style={styles.searchInput}
            placeholder="Delivery address"
            value={form.delivery_address}
            onChange={(event) => updateField('delivery_address', event.target.value)}
            required
          />
          <input
            style={styles.searchInput}
            placeholder="Cargo type"
            value={form.cargo_type}
            onChange={(event) => updateField('cargo_type', event.target.value)}
            required
          />

          <div style={styles.twoCol}>
            <input
              style={styles.searchInput}
              type="number"
              min="0"
              placeholder="Distance (km)"
              value={form.distance_km}
              onChange={(event) => updateField('distance_km', event.target.value)}
              required
            />
            <input
              style={styles.searchInput}
              type="number"
              min="0"
              placeholder="Weight (kg)"
              value={form.cargo_weight_kg}
              onChange={(event) => updateField('cargo_weight_kg', event.target.value)}
            />
          </div>

          <select
            style={styles.searchInput}
            value={form.vehicle_type}
            onChange={(event) => updateField('vehicle_type', event.target.value)}
          >
            {VEHICLE_TYPES.map((vehicleType) => (
              <option key={vehicleType} value={vehicleType}>
                {vehicleType}
              </option>
            ))}
          </select>

          <textarea
            style={styles.textArea}
            placeholder="Special instructions"
            value={form.special_instructions}
            onChange={(event) => updateField('special_instructions', event.target.value)}
          />

          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" style={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomerView({ role = 'customer' }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const currentRole = normalizeRole(authUser?.role);
  const previewEnabled = canUseViewAs(currentRole) && new URLSearchParams(window.location.search).get('preview') === 'true';
  const endpointBase = role === 'agent' ? '/api/v1/agent' : '/api/v1/customer';

  const [selectedPreviewUser, setSelectedPreviewUser] = useState(null);
  const [portalUser, setPortalUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const homePath = getHomePathForRole(currentRole);
  const previewUserId = previewEnabled ? selectedPreviewUser?.id : null;
  const canCreateBooking = role === 'customer' && !previewEnabled;

  const loadPortalData = async (userId) => {
    setLoading(true);
    setError('');

    try {
      const requestConfig = buildViewAsConfig(userId);
      const [profileRes, dashboardRes, bookingsRes] = await Promise.all([
        api.get(`${endpointBase}/profile`, requestConfig),
        api.get(`${endpointBase}/dashboard`, requestConfig),
        api.get(`${endpointBase}/bookings`, requestConfig),
      ]);

      setPortalUser(profileRes.data?.data?.user || profileRes.data?.user || null);
      setDashboard(dashboardRes.data?.data || dashboardRes.data || null);
      setBookings(bookingsRes.data?.data || bookingsRes.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load portal data.');
      setPortalUser(null);
      setDashboard(null);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (previewEnabled) {
      if (selectedPreviewUser?.id) {
        loadPortalData(selectedPreviewUser.id);
      } else {
        setLoading(false);
        setPortalUser(null);
        setDashboard(null);
        setBookings([]);
      }
      return;
    }

    if (currentRole !== role) {
      setLoading(false);
      return;
    }

    loadPortalData();
  }, [currentRole, previewEnabled, role, selectedPreviewUser?.id]);

  const handleCreated = async () => {
    setShowComposer(false);
    await loadPortalData(previewUserId);
  };

  const totalSpent = bookings
    .filter((entry) => entry.status === 'completed')
    .reduce((sum, entry) => sum + Number(entry.final_fare || entry.estimated_fare || 0), 0);

  const customerCards = [
    { label: 'Total Bookings', value: bookings.length },
    {
      label: 'Active Trips',
      value: bookings.filter((entry) => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(entry.status)).length,
    },
    { label: 'Total Spend', value: `KES ${totalSpent.toLocaleString()}` },
  ];

  const agentCards = [
    { label: 'Managed Customers', value: Number(dashboard?.customers || 0) },
    { label: 'Total Bookings', value: Number(dashboard?.totalBookings || 0) },
    { label: 'Active Bookings', value: Number(dashboard?.activeBookings || 0) },
  ];

  const cards = role === 'agent' ? agentCards : customerCards;

  return (
    <Layout title={role === 'agent' ? 'Agent Portal' : 'Customer Portal'}>
      {showComposer && (
        <BookingComposer
          endpointBase={endpointBase}
          onClose={() => setShowComposer(false)}
          onCreated={handleCreated}
        />
      )}

      {previewEnabled && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" style={styles.secondaryBtn} onClick={() => navigate(homePath)}>
            Back to Dashboard
          </button>
        </div>
      )}

      {previewEnabled && !selectedPreviewUser && (
        <UserPicker role={role} onSelect={setSelectedPreviewUser} />
      )}

      {previewEnabled && selectedPreviewUser && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => {
              setSelectedPreviewUser(null);
              setPortalUser(null);
              setDashboard(null);
              setBookings([]);
            }}
          >
            Switch Preview User
          </button>
        </div>
      )}

      {!previewEnabled && loading && <div style={styles.emptyText}>Loading portal...</div>}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {portalUser && (
        <div style={styles.portalWrap}>
          <div style={styles.hero}>
            <div>
              <div style={styles.heroTitle}>
                {role === 'agent' ? 'Welcome back' : 'Welcome'}, {portalUser.full_name}
              </div>
              <div style={styles.heroSub}>
                {previewEnabled ? 'Preview mode is active.' : 'Your account data is loaded from the live API.'}
              </div>
            </div>

            {canCreateBooking && (
              <button type="button" style={styles.primaryBtn} onClick={() => setShowComposer(true)}>
                Request Booking
              </button>
            )}
          </div>

          <div style={styles.metricsGrid}>
            {cards.map((card) => (
              <div key={card.label} style={styles.metricCard}>
                <div style={styles.metricLabel}>{card.label}</div>
                <div style={styles.metricValue}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={styles.sectionCard}>
            <div style={styles.sectionTitle}>{role === 'agent' ? 'Managed Bookings' : 'Recent Bookings'}</div>

            {loading && <div style={styles.emptyText}>Loading bookings...</div>}

            {!loading && bookings.length === 0 && (
              <div style={styles.emptyText}>No bookings found for this portal yet.</div>
            )}

            {!loading && bookings.map((booking) => (
              <div key={booking.id} style={styles.bookingRow}>
                <div>
                  <div style={styles.listTitle}>{booking.reference || booking.id}</div>
                  <div style={styles.listSub}>
                    {booking.pickup_address}
                    {' -> '}
                    {booking.delivery_address}
                  </div>
                </div>

                <div style={styles.bookingMeta}>
                  <div style={styles.statusPill}>{booking.status || 'pending'}</div>
                  <div style={styles.priceText}>
                    KES {Number(booking.final_fare || booking.estimated_fare || booking.customer_rate || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

export function AgentView() {
  return <CustomerView role="agent" />;
}

const styles = {
  centeredCard: {
    display: 'flex',
    justifyContent: 'center',
  },
  portalWrap: {
    display: 'grid',
    gap: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 12,
  },
  hero: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 4,
  },
  heroSub: {
    color: '#8b95a9',
    fontSize: 13,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  metricCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  },
  metricLabel: {
    color: '#8b95a9',
    fontSize: 12,
    marginBottom: 8,
  },
  metricValue: {
    color: '#e8eaf2',
    fontSize: 24,
    fontWeight: 800,
  },
  sectionCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 12,
  },
  listWrap: {
    display: 'grid',
    gap: 10,
    maxHeight: 420,
    overflowY: 'auto',
  },
  listButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    color: '#e8eaf2',
    padding: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
  listTitle: {
    color: '#e8eaf2',
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 2,
  },
  listSub: {
    color: '#8b95a9',
    fontSize: 12,
  },
  arrow: {
    color: '#e8a020',
    fontSize: 12,
    fontWeight: 700,
  },
  bookingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: '14px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  bookingMeta: {
    display: 'grid',
    gap: 6,
    justifyItems: 'end',
  },
  statusPill: {
    textTransform: 'capitalize',
    background: 'rgba(232,160,32,0.12)',
    border: '1px solid rgba(232,160,32,0.35)',
    color: '#e8a020',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
  },
  priceText: {
    color: '#22c55e',
    fontWeight: 700,
    fontSize: 13,
  },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
  },
  textArea: {
    width: '100%',
    minHeight: 90,
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
    resize: 'vertical',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  primaryBtn: {
    border: 'none',
    background: '#e8a020',
    color: '#0f121c',
    borderRadius: 10,
    padding: '11px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#181e2d',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  emptyText: {
    color: '#8b95a9',
    textAlign: 'center',
    padding: 24,
  },
  errorBanner: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: 12,
    padding: '10px 12px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 16,
  },
  modalForm: {
    display: 'grid',
    gap: 10,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
};
