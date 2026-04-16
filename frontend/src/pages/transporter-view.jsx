import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { canUseViewAs, getHomePathForRole, normalizeRole } from '../utils/roles';

const buildViewAsConfig = (userId) => (userId
  ? { headers: { 'X-View-As-User': userId } }
  : undefined);

function TransporterPicker({ onSelect }) {
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/api/v1/users?role=transporter')
      .then((res) => setTransporters(res.data?.data || res.data || []))
      .catch(() => setTransporters([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredTransporters = transporters.filter((entry) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [entry.full_name, entry.email, entry.phone]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });

  return (
    <div style={styles.centeredCard}>
      <div style={styles.card}>
        <div style={styles.title}>Choose a transporter to preview</div>
        <input
          style={styles.searchInput}
          placeholder="Search transporters..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div style={styles.listWrap}>
          {loading && <div style={styles.emptyText}>Loading transporters...</div>}

          {!loading && filteredTransporters.length === 0 && (
            <div style={styles.emptyText}>No matching transporters found.</div>
          )}

          {!loading && filteredTransporters.map((entry) => (
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
              <span style={styles.linkText}>Preview</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TransporterView() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const currentRole = normalizeRole(authUser?.role);
  const previewEnabled = canUseViewAs(currentRole) && new URLSearchParams(window.location.search).get('preview') === 'true';

  const [selectedPreviewUser, setSelectedPreviewUser] = useState(null);
  const [portalUser, setPortalUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [fleet, setFleet] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [finance, setFinance] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const homePath = getHomePathForRole(currentRole);

  const loadPortalData = async (previewUser) => {
    setLoading(true);
    setError('');

    try {
      const requestConfig = buildViewAsConfig(previewUser?.id);
      const [dashboardRes, fleetRes, bookingsRes, financeRes, invoiceRes] = await Promise.all([
        api.get('/api/v1/transporter/dashboard', requestConfig),
        api.get('/api/v1/transporter/fleet', requestConfig),
        api.get('/api/v1/transporter/bookings', requestConfig),
        api.get('/api/v1/transporter/finance', requestConfig),
        api.get('/api/v1/transporter/finance/invoices', requestConfig),
      ]);

      setPortalUser(previewUser || authUser);
      setDashboard(dashboardRes.data?.data || dashboardRes.data || null);
      setFleet(fleetRes.data?.data || fleetRes.data || []);
      setBookings(bookingsRes.data?.data || bookingsRes.data || []);
      setFinance(financeRes.data?.data?.summary || financeRes.data?.summary || financeRes.data || null);
      setInvoices(invoiceRes.data?.data?.invoices || invoiceRes.data?.invoices || []);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || 'Could not load transporter portal data.');
      setPortalUser(null);
      setDashboard(null);
      setFleet([]);
      setBookings([]);
      setFinance(null);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (previewEnabled) {
      if (selectedPreviewUser?.id) {
        loadPortalData(selectedPreviewUser);
      } else {
        setLoading(false);
        setPortalUser(null);
      }
      return;
    }

    if (currentRole !== 'transporter') {
      setLoading(false);
      return;
    }

    loadPortalData();
  }, [currentRole, previewEnabled, selectedPreviewUser?.id]);

  return (
    <Layout title="Transporter Portal">
      {previewEnabled && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" style={styles.secondaryBtn} onClick={() => navigate(homePath)}>
            Back to Dashboard
          </button>
        </div>
      )}

      {previewEnabled && !selectedPreviewUser && (
        <TransporterPicker onSelect={setSelectedPreviewUser} />
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
              setFleet([]);
              setBookings([]);
              setFinance(null);
              setInvoices([]);
            }}
          >
            Switch Preview User
          </button>
        </div>
      )}

      {loading && <div style={styles.emptyText}>Loading transporter portal...</div>}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {portalUser && (
        <div style={styles.grid}>
          <div style={styles.hero}>
            <div>
              <div style={styles.title}>Transporter Overview</div>
              <div style={styles.subtle}>
                {portalUser.full_name} {previewEnabled ? '(preview mode)' : ''}
              </div>
            </div>
          </div>

          <div style={styles.metricsGrid}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Vehicles</div>
              <div style={styles.metricValue}>{dashboard?.totalVehicles || 0}</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Drivers</div>
              <div style={styles.metricValue}>{dashboard?.totalDrivers || 0}</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Bookings</div>
              <div style={styles.metricValue}>{dashboard?.totalBookings || 0}</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Profit</div>
              <div style={styles.metricValue}>KES {Number(finance?.total_profit || 0).toLocaleString()}</div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Fleet</div>
            {fleet.length === 0 && <div style={styles.emptyText}>No vehicles found.</div>}
            {fleet.map((vehicle) => (
              <div key={vehicle.id} style={styles.row}>
                <div>
                  <div style={styles.listTitle}>{vehicle.plate_number || vehicle.id}</div>
                  <div style={styles.listSub}>{vehicle.vehicle_type || 'vehicle'}</div>
                </div>
                <div style={styles.statusPill}>{vehicle.is_active === false ? 'retired' : 'active'}</div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Recent Bookings</div>
            {bookings.length === 0 && <div style={styles.emptyText}>No bookings found.</div>}
            {bookings.slice(0, 8).map((booking) => (
              <div key={booking.id} style={styles.row}>
                <div>
                  <div style={styles.listTitle}>{booking.reference || booking.id}</div>
                  <div style={styles.listSub}>
                    {booking.customer?.full_name || 'Customer'} - {booking.pickup_address}
                    {' -> '}
                    {booking.delivery_address}
                  </div>
                </div>
                <div style={styles.statusPill}>{booking.status || 'pending'}</div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Invoices</div>
            {invoices.length === 0 && <div style={styles.emptyText}>No transporter invoices available.</div>}
            {invoices.slice(0, 8).map((invoice) => (
              <div key={invoice.booking_id || invoice.invoice_number} style={styles.row}>
                <div>
                  <div style={styles.listTitle}>{invoice.invoice_number}</div>
                  <div style={styles.listSub}>{invoice.customer?.full_name || 'Customer'}</div>
                </div>
                <div style={styles.linkText}>
                  KES {Number(invoice.transporter_profit || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

const styles = {
  centeredCard: {
    display: 'flex',
    justifyContent: 'center',
  },
  grid: {
    display: 'grid',
    gap: 16,
  },
  hero: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  card: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 20,
  },
  title: {
    color: '#e8eaf2',
    fontSize: 22,
    fontWeight: 800,
  },
  subtle: {
    color: '#8b95a9',
    fontSize: 13,
    marginTop: 4,
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
  sectionTitle: {
    color: '#e8eaf2',
    fontSize: 18,
    fontWeight: 800,
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
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  listSub: {
    color: '#8b95a9',
    fontSize: 12,
  },
  linkText: {
    color: '#e8a020',
    fontSize: 12,
    fontWeight: 700,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: '14px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
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
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
    marginBottom: 12,
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
    marginBottom: 16,
  },
};
