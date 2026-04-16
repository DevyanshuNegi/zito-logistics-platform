import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { getHomePathForRole, normalizeRole } from '../utils/roles';

const formatKes = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : '0';
};

export default function AgencyView() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const homePath = getHomePathForRole(normalizeRole(authUser?.role));
  const [agency, setAgency] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentsMeta, setAgentsMeta] = useState({});
  const [agentSearch, setAgentSearch] = useState('');
  const [transporters, setTransporters] = useState([]);
  const [transportersMeta, setTransportersMeta] = useState({});
  const [transporterSearch, setTransporterSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [bookingsMeta, setBookingsMeta] = useState({});
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [bookingSort, setBookingSort] = useState({ by: 'created_at', dir: 'DESC' });
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingTransporters, setLoadingTransporters] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const loadAgency = async () => {
    setLoading(true);
    setError('');
    setAgency(null);
    setDashboard(null);
    setReports(null);

    try {
      const [profileRes, dashRes, reportRes] = await Promise.allSettled([
        api.get('/api/v1/agency/profile'),
        api.get('/api/v1/agency/dashboard'),
        api.get('/api/v1/agency/reports'),
      ]);

      const failures = [];

      if (profileRes.status === 'fulfilled') {
        setAgency(profileRes.value.data?.data?.user || profileRes.value.data?.user || null);
      } else {
        failures.push('profile');
      }

      if (dashRes.status === 'fulfilled') {
        setDashboard(dashRes.value.data?.data || dashRes.value.data || null);
      } else {
        failures.push('dashboard');
      }

      if (reportRes.status === 'fulfilled') {
        setReports(reportRes.value.data?.data?.report || reportRes.value.data?.report || null);
      } else {
        failures.push('reports');
      }

      if (failures.length) {
        setError(`Could not load ${failures.join(', ')} data. Please try again.`);
      }
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to load agency portal data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async (page = 1) => {
    setLoadingAgents(true);
    try {
      const res = await api.get('/api/v1/agency/agents', { params: { page, q: agentSearch || undefined } });
      setAgents(res.data?.data || []);
      setAgentsMeta(res.data?.meta || {});
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchTransporters = async (page = 1) => {
    setLoadingTransporters(true);
    try {
      const res = await api.get('/api/v1/agency/transporters', { params: { page, q: transporterSearch || undefined } });
      setTransporters(res.data?.data || []);
      setTransportersMeta(res.data?.meta || {});
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to load transporters');
    } finally {
      setLoadingTransporters(false);
    }
  };

  const fetchBookings = async (page = 1) => {
    setLoadingBookings(true);
    try {
      const res = await api.get('/api/v1/agency/bookings', {
        params: {
          page,
          q: bookingSearch || undefined,
          status: bookingStatus || undefined,
          sort_by: bookingSort.by,
          sort_dir: bookingSort.dir,
        },
      });
      setBookings(res.data?.data || []);
      setBookingsMeta(res.data?.meta || {});
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  const exportReports = async () => {
    try {
      setExporting(true);
      const res = await api.get('/api/v1/agency/reports/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `agency-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setError(e?.response?.data?.error?.message || 'Failed to export reports');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadAgency();
    fetchAgents();
    fetchTransporters();
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout title="Agency Portal">
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(homePath)} style={s.backBtn}>
          {'<- Back to Dashboard'}
        </button>
      </div>

      <div style={s.card}>
        <div style={s.row}>
          <div>
            <h2 style={s.h2}>Agency Dashboard</h2>
            <p style={s.muted}>View agents, transporters, bookings, and financial report snapshot.</p>
          </div>
          <button onClick={loadAgency} style={s.loadBtn} disabled={loading}>
            {loading ? 'Loading...' : 'Load Agency Data'}
          </button>
        </div>

        {error && <div style={s.error}>{error}</div>}

        {agency && (
          <div style={s.section}>
            <div style={s.kv}>
              Agency: <strong>{agency.full_name}</strong>
            </div>
            <div style={s.kv}>Email: {agency.email}</div>
            <div style={s.kv}>Phone: {agency.phone || '-'}</div>
          </div>
        )}

        {dashboard && (
          <div style={s.grid}>
            <div style={s.metric}>
              <div style={s.label}>Agents</div>
              <div style={s.value}>{dashboard.agents || 0}</div>
            </div>
            <div style={s.metric}>
              <div style={s.label}>Transporters</div>
              <div style={s.value}>{dashboard.transporters || 0}</div>
            </div>
            <div style={s.metric}>
              <div style={s.label}>Bookings</div>
              <div style={s.value}>{dashboard.totalBookings || 0}</div>
            </div>
          </div>
        )}

        {reports && (
          <div style={s.section}>
            <h3 style={s.h3}>Report Snapshot</h3>
            <div style={s.kv}>Total Bookings: {reports.total_bookings || 0}</div>
            <div style={s.kv}>Customer Rate: KES {formatKes(reports.totals?.customer_rate)}</div>
            <div style={s.kv}>Hire Rate: KES {formatKes(reports.totals?.hire_rate)}</div>
            <div style={s.kv}>Expenses: KES {formatKes(reports.totals?.expenses)}</div>
            <div style={s.kv}>Profit: KES {formatKes(reports.totals?.profit)}</div>
            {reports.by_status && (
              <div style={s.statusRow}>
                {Object.entries(reports.by_status).map(([k, v]) => (
                  <div key={k} style={s.statusChip}>
                    <span style={{ textTransform: 'capitalize' }}>{k.toLowerCase()}</span>
                    <strong style={{ marginLeft: 6 }}>{v}</strong>
                  </div>
                ))}
              </div>
            )}
            <button style={s.exportBtn} onClick={exportReports} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        )}

        <div style={s.section}>
          <div style={s.row}>
            <h3 style={s.h3}>Agents</h3>
            <div style={s.row}>
              <input
                style={s.search}
                placeholder="Search agent name/email/phone"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAgents(1)}
              />
              <button style={s.secondaryBtn} onClick={() => fetchAgents(1)} disabled={loadingAgents}>
                Search
              </button>
            </div>
            <div>
              <button style={s.secondaryBtn} onClick={() => fetchAgents(Math.max(1, (agentsMeta.page || 1) - 1))} disabled={loadingAgents || !agentsMeta.has_prev}>
                Prev
              </button>
              <button style={{ ...s.secondaryBtn, marginLeft: 8 }} onClick={() => fetchAgents((agentsMeta.page || 1) + 1)} disabled={loadingAgents || !agentsMeta.has_next}>
                Next
              </button>
            </div>
          </div>
          {loadingAgents ? (
            <div style={s.muted}>Loading agents...</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 && (
                  <tr><td colSpan={3} style={s.muted}>No agents found.</td></tr>
                )}
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td>{a.full_name}</td>
                    <td>{a.email}</td>
                    <td>{a.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={s.section}>
          <div style={s.row}>
            <h3 style={s.h3}>Transporters</h3>
            <div style={s.row}>
              <input
                style={s.search}
                placeholder="Search transporter name/email/phone"
                value={transporterSearch}
                onChange={(e) => setTransporterSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTransporters(1)}
              />
              <button style={s.secondaryBtn} onClick={() => fetchTransporters(1)} disabled={loadingTransporters}>
                Search
              </button>
            </div>
            <div>
              <button style={s.secondaryBtn} onClick={() => fetchTransporters(Math.max(1, (transportersMeta.page || 1) - 1))} disabled={loadingTransporters || !transportersMeta.has_prev}>
                Prev
              </button>
              <button style={{ ...s.secondaryBtn, marginLeft: 8 }} onClick={() => fetchTransporters((transportersMeta.page || 1) + 1)} disabled={loadingTransporters || !transportersMeta.has_next}>
                Next
              </button>
            </div>
          </div>
          {loadingTransporters ? (
            <div style={s.muted}>Loading transporters...</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {transporters.length === 0 && (
                  <tr><td colSpan={3} style={s.muted}>No transporters found.</td></tr>
                )}
                {transporters.map((t) => (
                  <tr key={t.id}>
                    <td>{t.full_name}</td>
                    <td>{t.email}</td>
                    <td>{t.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={s.section}>
          <div style={s.row}>
            <h3 style={s.h3}>Bookings</h3>
            <div style={s.row}>
              <input
                style={s.search}
                placeholder="Search reference / cargo"
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchBookings(1)}
              />
              <select
                style={s.select}
                value={bookingStatus}
                onChange={(e) => {
                  setBookingStatus(e.target.value);
                  fetchBookings(1);
                }}
              >
                <option value="">All statuses</option>
                {['pending', 'approved', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled', 'rejected'].map((sVal) => (
                  <option key={sVal} value={sVal}>{sVal.replace('_', ' ')}</option>
                ))}
              </select>
              <button style={s.secondaryBtn} onClick={() => fetchBookings(1)} disabled={loadingBookings}>
                Apply
              </button>
            </div>
            <div>
              <button style={s.secondaryBtn} onClick={() => fetchBookings(Math.max(1, (bookingsMeta.page || 1) - 1))} disabled={loadingBookings || !bookingsMeta.has_prev}>
                Prev
              </button>
              <button style={{ ...s.secondaryBtn, marginLeft: 8 }} onClick={() => fetchBookings((bookingsMeta.page || 1) + 1)} disabled={loadingBookings || !bookingsMeta.has_next}>
                Next
              </button>
            </div>
          </div>
          {loadingBookings ? (
            <div style={s.muted}>Loading bookings...</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>ID</th>
                  <th onClick={() => setBookingSort((s) => ({ by: 'created_at', dir: s.dir === 'ASC' ? 'DESC' : 'ASC' }))} style={s.th}>Created</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th onClick={() => setBookingSort((s) => ({ by: 'customer_rate', dir: s.dir === 'ASC' ? 'DESC' : 'ASC' }))} style={s.th}>Customer Rate</th>
                  <th onClick={() => setBookingSort((s) => ({ by: 'hire_rate', dir: s.dir === 'ASC' ? 'DESC' : 'ASC' }))} style={s.th}>Hire Rate</th>
                  <th onClick={() => setBookingSort((s) => ({ by: 'profit', dir: s.dir === 'ASC' ? 'DESC' : 'ASC' }))} style={s.th}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && (
                  <tr><td colSpan={8} style={s.muted}>No bookings yet.</td></tr>
                )}
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td style={s.link} onClick={() => navigate(`/trip/${b.id}`)}>{b.reference}</td>
                    <td>{b.id}</td>
                    <td>{b.created_at ? new Date(b.created_at).toLocaleString() : '-'}</td>
                    <td>{b.agent?.full_name || '-'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{b.status || '-'}</td>
                    <td>KES {formatKes(b.customer_rate)}</td>
                    <td>KES {formatKes(b.hire_rate)}</td>
                    <td>KES {formatKes(b.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}

const s = {
  backBtn: {
    background: '#1f2840',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#e8eaf2',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 18,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  h2: { margin: '0 0 6px', fontSize: 20, fontWeight: 800 },
  h3: { margin: '0 0 8px', fontSize: 16, fontWeight: 700 },
  muted: { color: '#94a3b8', margin: 0 },
  loadBtn: {
    background: '#e8a020',
    border: 'none',
    color: '#111',
    padding: '9px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
  },
  error: {
    marginTop: 10,
    color: '#ef4444',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: '8px 10px',
  },
  section: {
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  kv: { color: '#cbd5e1', marginBottom: 4 },
  grid: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(120px,1fr))',
    gap: 10,
  },
  metric: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 10,
  },
  label: { color: '#94a3b8', fontSize: 12 },
  value: { color: '#e8eaf2', fontSize: 22, fontWeight: 800 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 10,
  },
  th: { cursor: 'pointer', userSelect: 'none' },
  link: { color: '#38bdf8', cursor: 'pointer' },
  search: {
    padding: '8px 10px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#e8eaf2',
    minWidth: 220,
  },
  select: {
    padding: '8px 10px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#e8eaf2',
    marginLeft: 8,
  },
  secondaryBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf2',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  statusRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statusChip: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf2',
    fontSize: 12,
  },
  exportBtn: {
    marginTop: 10,
    background: '#0ea5e9',
    border: 'none',
    color: '#0b1220',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
  },
};
