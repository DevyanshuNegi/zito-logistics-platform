import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { canUseViewAs, getHomePathForRole, normalizeRole } from '../utils/roles';

const VEHICLE_OPTIONS = [
  { key: 'motorcycle', label: 'Motorcycle', base: 200, perKm: 15, maxKg: 30 },
  { key: 'pickup_truck', label: 'Pickup Truck', base: 1000, perKm: 50, maxKg: 1500 },
  { key: 'van', label: 'Van', base: 1500, perKm: 60, maxKg: 1200 },
  { key: 'light_truck', label: 'Light Truck', base: 3000, perKm: 80, maxKg: 4000 },
  { key: 'heavy_truck', label: 'Heavy Truck', base: 8000, perKm: 150, maxKg: 20000 },
];

const CARGO_OPTIONS = [
  'general',
  'fragile',
  'perishable',
  'hazardous',
  'livestock',
  'machinery',
  'electronics',
  'furniture',
  'other',
];

const buildViewAsConfig = (userId) => (
  userId ? { headers: { 'X-View-As-User': userId } } : undefined
);

const formatKes = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const estimateFare = ({ vehicle_type, cargo_weight_kg, distance_km, additional_stops, scheduled_at }) => {
  const vehicle = VEHICLE_OPTIONS.find((entry) => entry.key === vehicle_type);
  if (!vehicle) return 0;

  let amount = vehicle.base + (vehicle.perKm * Number(distance_km || 0));
  const weight = Number(cargo_weight_kg || 0);
  if (weight > vehicle.maxKg * 0.8) amount *= 1.2;
  amount += (additional_stops || []).length * 250;

  if (scheduled_at) {
    const hour = new Date(scheduled_at).getHours();
    if (hour >= 21 || hour < 6) amount *= 1.15;
  }

  return Math.round(amount);
};

function UserPicker({ role, onSelect }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get(`/api/v1/users?role=${role}`)
      .then((response) => setUsers(response.data?.data || []))
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
          {!loading && filteredUsers.length === 0 && <div style={styles.emptyText}>No matching users found.</div>}

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
              <span style={styles.arrow}>Preview</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookingComposer({ endpointBase, role, managedCustomers, onClose, onCreated }) {
  const [stopInput, setStopInput] = useState('');
  const [form, setForm] = useState({
    customer_id: '',
    pickup_address: '',
    delivery_address: '',
    additional_stops: [],
    cargo_type: 'general',
    cargo_weight_kg: '',
    cargo_description: '',
    distance_km: '',
    vehicle_type: 'van',
    payment_method: 'mpesa',
    special_instructions: '',
    scheduled_at: '',
    is_recurring: false,
    recurrence_pattern: 'weekly',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const estimatedFare = useMemo(() => estimateFare(form), [form]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addStop = () => {
    const value = stopInput.trim();
    if (!value) return;
    setForm((current) => ({ ...current, additional_stops: [...current.additional_stops, value] }));
    setStopInput('');
  };

  const removeStop = (index) => {
    setForm((current) => ({
      ...current,
      additional_stops: current.additional_stops.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await api.post(`${endpointBase}/bookings`, {
        ...form,
        cargo_weight_kg: Number(form.cargo_weight_kg || 0),
        distance_km: Number(form.distance_km || 0),
        scheduled_at: form.scheduled_at || undefined,
        recurrence_pattern: form.is_recurring ? form.recurrence_pattern : undefined,
        customer_id: role === 'agent' ? form.customer_id || undefined : undefined,
        customer_rate: estimatedFare,
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
        <div style={styles.modalTitle}>{role === 'agent' ? 'Create Booking For Customer' : 'Create Booking'}</div>
        <div style={styles.modalHint}>
          Address autocomplete and live map routing will be connected later. For now, enter exact pickup and delivery addresses manually.
        </div>

        <form onSubmit={handleSubmit} style={styles.modalForm}>
          {role === 'agent' && (
            <select
              style={styles.searchInput}
              value={form.customer_id}
              onChange={(event) => updateField('customer_id', event.target.value)}
              required
            >
              <option value="">Select managed customer</option>
              {managedCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                </option>
              ))}
            </select>
          )}

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

          <div style={styles.stopComposer}>
            <input
              style={styles.searchInput}
              placeholder="Add intermediate stop"
              value={stopInput}
              onChange={(event) => setStopInput(event.target.value)}
            />
            <button type="button" style={styles.secondaryBtn} onClick={addStop}>
              Add Stop
            </button>
          </div>

          {form.additional_stops.length > 0 && (
            <div style={styles.stopList}>
              {form.additional_stops.map((stop, index) => (
                <div key={`${stop}-${index}`} style={styles.stopChip}>
                  <span>{stop}</span>
                  <button type="button" style={styles.chipClose} onClick={() => removeStop(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={styles.twoCol}>
            <select
              style={styles.searchInput}
              value={form.cargo_type}
              onChange={(event) => updateField('cargo_type', event.target.value)}
            >
              {CARGO_OPTIONS.map((cargoType) => (
                <option key={cargoType} value={cargoType}>
                  {cargoType.replace('_', ' ')}
                </option>
              ))}
            </select>

            <input
              style={styles.searchInput}
              type="number"
              min="0"
              placeholder="Weight (kg)"
              value={form.cargo_weight_kg}
              onChange={(event) => updateField('cargo_weight_kg', event.target.value)}
              required
            />
          </div>

          <div style={styles.twoCol}>
            <input
              style={styles.searchInput}
              type="number"
              min="0"
              placeholder="Distance estimate (km)"
              value={form.distance_km}
              onChange={(event) => updateField('distance_km', event.target.value)}
              required
            />

            <select
              style={styles.searchInput}
              value={form.vehicle_type}
              onChange={(event) => updateField('vehicle_type', event.target.value)}
            >
              {VEHICLE_OPTIONS.map((vehicle) => (
                <option key={vehicle.key} value={vehicle.key}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.twoCol}>
            <select
              style={styles.searchInput}
              value={form.payment_method}
              onChange={(event) => updateField('payment_method', event.target.value)}
            >
              <option value="mpesa">M-Pesa reference</option>
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash on delivery</option>
            </select>

            <input
              style={styles.searchInput}
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(event) => updateField('scheduled_at', event.target.value)}
            />
          </div>

          <textarea
            style={styles.textArea}
            placeholder="Cargo description"
            value={form.cargo_description}
            onChange={(event) => updateField('cargo_description', event.target.value)}
          />

          <textarea
            style={styles.textArea}
            placeholder="Special instructions"
            value={form.special_instructions}
            onChange={(event) => updateField('special_instructions', event.target.value)}
          />

          <div style={styles.recurringRow}>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(event) => updateField('is_recurring', event.target.checked)}
              />
              <span>Recurring booking</span>
            </label>

            {form.is_recurring && (
              <select
                style={styles.searchInput}
                value={form.recurrence_pattern}
                onChange={(event) => updateField('recurrence_pattern', event.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          <div style={styles.estimateCard}>
            <div style={styles.estimateLabel}>Estimated customer rate</div>
            <div style={styles.estimateValue}>{formatKes(estimatedFare)}</div>
            <div style={styles.estimateHint}>
              Estimate is calculated locally for now and will stay compatible with the PRD routing logic once map services are enabled.
            </div>
          </div>

          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" style={styles.secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" style={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Booking'}
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
  const { isMobile } = useResponsive();
  const currentRole = normalizeRole(authUser?.role);
  const previewEnabled = canUseViewAs(currentRole) && new URLSearchParams(window.location.search).get('preview') === 'true';
  const endpointBase = role === 'agent' ? '/api/v1/agent' : '/api/v1/customer';

  const [selectedPreviewUser, setSelectedPreviewUser] = useState(null);
  const [portalUser, setPortalUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [managedCustomers, setManagedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const homePath = getHomePathForRole(currentRole);
  const previewUserId = previewEnabled ? selectedPreviewUser?.id : null;
  const canCreateBooking = !previewEnabled && (role === 'customer' || role === 'agent');

  const loadPortalData = async (userId) => {
    setLoading(true);
    setError('');

    try {
      const requestConfig = buildViewAsConfig(userId);
      const requests = [
        api.get(`${endpointBase}/profile`, requestConfig),
        api.get(`${endpointBase}/dashboard`, requestConfig),
        api.get(`${endpointBase}/bookings`, requestConfig),
      ];

      if (role === 'agent') {
        requests.push(api.get('/api/v1/agent/customers', requestConfig));
      }

      const [profileRes, dashboardRes, bookingsRes, customersRes] = await Promise.all(requests);

      setPortalUser(profileRes.data?.data?.user || profileRes.data?.user || null);
      setDashboard(dashboardRes.data?.data || dashboardRes.data || null);
      setBookings(bookingsRes.data?.data || []);
      if (role === 'agent') {
        setManagedCustomers(customersRes?.data?.data || []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load portal data.');
      setPortalUser(null);
      setDashboard(null);
      setBookings([]);
      setManagedCustomers([]);
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
        setManagedCustomers([]);
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

  const activeBookings = bookings.filter((booking) => ['approved', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status));
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  const scheduledBookings = bookings.filter((booking) => booking.scheduled_at);
  const recurringBookings = bookings.filter((booking) => booking.is_recurring);
  const activeBooking = activeBookings[0] || null;

  const cards = role === 'agent'
    ? [
        { label: 'Managed Customers', value: managedCustomers.length || Number(dashboard?.customers || 0) },
        { label: 'Active Bookings', value: activeBookings.length || Number(dashboard?.activeBookings || 0) },
        { label: 'Recurring Schedules', value: recurringBookings.length },
        { label: 'Completed Jobs', value: completedBookings.length },
      ]
    : [
        { label: 'Total Bookings', value: bookings.length },
        { label: 'Active Trips', value: activeBookings.length },
        { label: 'Scheduled', value: scheduledBookings.length },
        { label: 'Completed', value: completedBookings.length },
      ];

  const downloadCustomerInvoice = async (bookingId, reference) => {
    try {
      const response = await api.get(`/api/v1/customer/bookings/${bookingId}/invoice`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reference || bookingId}-invoice.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError.response?.data?.error?.message || 'Could not download invoice');
    }
  };

  return (
    <Layout title={role === 'agent' ? 'Agent Portal' : 'Customer Portal'}>
      {showComposer && (
        <BookingComposer
          endpointBase={endpointBase}
          role={role}
          managedCustomers={managedCustomers}
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
              setManagedCustomers([]);
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
                {role === 'agent' ? 'Agent workspace' : 'Customer workspace'}, {portalUser.full_name}
              </div>
              <div style={styles.heroSub}>
                {role === 'agent'
                  ? 'Manage customer bookings, recurring schedules, and invoice follow-up from one place.'
                  : 'Create bookings, review scheduled jobs, and keep track of invoices without waiting for the mobile app.'}
              </div>
            </div>

            {canCreateBooking && (
              <button type="button" style={styles.primaryBtn} onClick={() => setShowComposer(true)}>
                {role === 'agent' ? 'Create Managed Booking' : 'Request Booking'}
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

          <div style={{
            ...styles.contentGrid,
            gridTemplateColumns: isMobile ? '1fr' : '1.25fr 0.75fr',
          }}>
            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>
                {role === 'agent' ? 'Managed Booking Feed' : 'Booking Feed'}
              </div>

              {activeBooking ? (
                <div style={styles.activeCard}>
                  <div style={styles.activeTitle}>Active Trip Spotlight</div>
                  <div style={styles.activeRoute}>
                    {(activeBooking.pickup_address || activeBooking.pickup_location) || 'Pickup'}{' -> '}{(activeBooking.delivery_address || activeBooking.dropoff_location) || 'Delivery'}
                  </div>
                  <div style={styles.activeMetaRow}>
                    <span style={styles.statusPill}>{activeBooking.status}</span>
                    <span style={styles.metaPill}>
                      {formatKes(activeBooking.customer_rate || activeBooking.final_fare || activeBooking.estimated_fare)}
                    </span>
                    {activeBooking.scheduled_at && (
                      <span style={styles.metaPill}>Scheduled {formatDate(activeBooking.scheduled_at)}</span>
                    )}
                    {activeBooking.is_recurring && (
                      <span style={styles.metaPill}>Recurring {activeBooking.recurrence_pattern}</span>
                    )}
                  </div>
                  <div style={styles.activeHint}>
                    Live map rendering will be switched on later. Until then, this portal keeps the trip state, assigned driver, and finance readiness visible end to end.
                  </div>
                </div>
              ) : (
                <div style={styles.emptyText}>No active bookings right now.</div>
              )}

              {!loading && bookings.length === 0 && (
                <div style={styles.emptyText}>No bookings found for this portal yet.</div>
              )}

              {!loading && bookings.map((booking) => (
                <div key={booking.id} style={styles.bookingRow}>
                  <div>
                    <div style={styles.listTitle}>{booking.reference || booking.id}</div>
                    <div style={styles.listSub}>
                      {(booking.pickup_address || booking.pickup_location) || 'Pickup'}
                      {' -> '}
                      {(booking.delivery_address || booking.dropoff_location) || 'Delivery'}
                    </div>
                    <div style={styles.bookingBadges}>
                      {booking.additional_stops?.length > 0 && (
                        <span style={styles.metaPill}>{booking.additional_stops.length} stops</span>
                      )}
                      {booking.scheduled_at && (
                        <span style={styles.metaPill}>Scheduled {formatDate(booking.scheduled_at)}</span>
                      )}
                      {booking.is_recurring && (
                        <span style={styles.metaPill}>Recurring {booking.recurrence_pattern}</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.bookingMeta}>
                    <div style={styles.statusPill}>{booking.status || 'pending'}</div>
                    <div style={styles.priceText}>
                      {formatKes(booking.final_fare || booking.estimated_fare || booking.customer_rate || 0)}
                    </div>
                    {role === 'customer' && booking.status === 'completed' && (
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={() => downloadCustomerInvoice(booking.id, booking.reference)}
                      >
                        Invoice
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.sideColumn}>
              {role === 'agent' && (
                <div style={styles.sectionCard}>
                  <div style={styles.sectionTitle}>Customer Portfolio</div>
                  {managedCustomers.length === 0 ? (
                    <div style={styles.emptyText}>No managed customers loaded yet.</div>
                  ) : (
                    managedCustomers.slice(0, 8).map((customer) => (
                      <div key={customer.id} style={styles.listRow}>
                        <div>
                          <div style={styles.listTitle}>{customer.full_name}</div>
                          <div style={styles.listSub}>{customer.email || customer.phone || 'No contact details'}</div>
                        </div>
                        <span style={styles.arrow}>Managed</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div style={styles.sectionCard}>
                <div style={styles.sectionTitle}>Portal Snapshot</div>
                <div style={styles.snapshotItem}>
                  <span>Scheduled jobs</span>
                  <strong>{scheduledBookings.length}</strong>
                </div>
                <div style={styles.snapshotItem}>
                  <span>Recurring schedules</span>
                  <strong>{recurringBookings.length}</strong>
                </div>
                <div style={styles.snapshotItem}>
                  <span>Invoice-ready jobs</span>
                  <strong>{completedBookings.length}</strong>
                </div>
                <div style={styles.snapshotItem}>
                  <span>Dashboard active count</span>
                  <strong>{dashboard?.active || dashboard?.activeBookings || activeBookings.length}</strong>
                </div>
              </div>
            </div>
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
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.75fr',
    gap: 16,
  },
  sideColumn: {
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
    lineHeight: 1.6,
    maxWidth: 620,
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
  activeCard: {
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  activeTitle: {
    color: '#8892a4',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeRoute: {
    marginTop: 10,
    color: '#e8eaf2',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  activeMetaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activeHint: {
    marginTop: 12,
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 1.6,
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.18)',
    borderRadius: 12,
    padding: 12,
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
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    color: '#e8eaf2',
    padding: 14,
    marginBottom: 10,
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
    lineHeight: 1.5,
  },
  arrow: {
    color: '#e8a020',
    fontSize: 12,
    fontWeight: 700,
  },
  bookingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    padding: '14px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  bookingBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  bookingMeta: {
    display: 'grid',
    gap: 8,
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
  metaPill: {
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.24)',
    color: '#a5b4fc',
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
  stopComposer: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 10,
  },
  stopList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.24)',
    color: '#c7d2fe',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
  },
  chipClose: {
    border: 'none',
    background: 'transparent',
    color: '#c7d2fe',
    cursor: 'pointer',
    fontSize: 11,
  },
  recurringRow: {
    display: 'grid',
    gap: 10,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#e8eaf2',
    fontSize: 13,
  },
  estimateCard: {
    background: 'rgba(232,160,32,0.12)',
    border: '1px solid rgba(232,160,32,0.24)',
    borderRadius: 14,
    padding: 16,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#8892a4',
  },
  estimateValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 800,
    color: '#e8a020',
  },
  estimateHint: {
    marginTop: 6,
    color: '#8b95a9',
    fontSize: 12,
    lineHeight: 1.6,
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
  snapshotItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: '#cbd5e1',
    fontSize: 13,
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
    maxWidth: 760,
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 8,
  },
  modalHint: {
    color: '#8892a4',
    fontSize: 12,
    lineHeight: 1.6,
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
