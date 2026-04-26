import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const TABS = [
  { key: 'trips', label: 'Trip Performance', desc: 'Volume, completion, and service pace' },
  { key: 'revenue', label: 'Revenue', desc: 'Collections, outstanding balances, and margins' },
  { key: 'drivers', label: 'Drivers', desc: 'Availability, ratings, and completed work' },
  { key: 'fleet', label: 'Fleet', desc: 'Vehicle availability and transporter usage' },
];

const formatKes = (value) => `KES ${Number(value || 0).toLocaleString()}`;
const toNumber = (value) => Number(value || 0);

const toCsv = (rows) => rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

function buildMonthSeries(bookings) {
  const months = [];
  const now = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: date.toLocaleDateString('en-KE', { month: 'short' }),
      trips: 0,
      revenue: 0,
      completed: 0,
    });
  }

  bookings.forEach((booking) => {
    const created = booking.created_at ? new Date(booking.created_at) : null;
    if (!created) return;
    const key = `${created.getFullYear()}-${created.getMonth() + 1}`;
    const bucket = months.find((item) => item.key === key);
    if (!bucket) return;
    bucket.trips += 1;
    bucket.revenue += toNumber(booking.customer_rate || booking.final_fare);
    if (booking.status === 'completed') bucket.completed += 1;
  });

  return months;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('trips');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [bookingsReport, setBookingsReport] = useState([]);
  const [financialReport, setFinancialReport] = useState({});
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError('');

      try {
        const [
          statsResponse,
          bookingsReportResponse,
          financialResponse,
          driversResponse,
          bookingsResponse,
          vehiclesResponse,
          paymentsResponse,
        ] = await Promise.all([
          api.get('/api/v1/admin/stats'),
          api.get('/api/v1/admin/reports/bookings'),
          api.get('/api/v1/admin/reports/financial'),
          api.get('/api/v1/admin/reports/drivers?limit=200'),
          api.get('/api/v1/bookings?limit=300'),
          api.get('/api/v1/vehicles?limit=300'),
          api.get('/api/v1/payments?limit=300'),
        ]);

        setStats(statsResponse.data?.data || {});
        setBookingsReport(bookingsReportResponse.data?.data?.report || []);
        setFinancialReport(financialResponse.data?.data?.report || {});
        setDrivers(driversResponse.data?.data || []);
        setBookings(bookingsResponse.data?.data || []);
        setVehicles(vehiclesResponse.data?.data || []);
        setPayments(paymentsResponse.data?.data?.payments || []);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Could not load reports');
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const metrics = useMemo(() => {
    const completedBookings = bookings.filter((booking) => booking.status === 'completed');
    const activeBookings = bookings.filter((booking) => ['approved', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status));
    const cancelledBookings = bookings.filter((booking) => booking.status === 'cancelled');
    const outstandingBookings = completedBookings.filter((booking) => !['released', 'refunded'].includes(booking.payment_status));
    const totalRevenue = toNumber(financialReport.total_revenue);
    const totalProfit = toNumber(financialReport.total_profit);
    const totalExpenses = toNumber(financialReport.total_expenses);
    const availableDrivers = toNumber(stats?.users?.available_drivers);
    const averageRating = drivers.length
      ? drivers.reduce((sum, driver) => sum + toNumber(driver.avg_rating), 0) / drivers.length
      : 0;
    const activeVehicles = vehicles.filter((vehicle) => vehicle.is_active).length;
    const verifiedVehicles = vehicles.filter((vehicle) => vehicle.is_verified || vehicle.is_approved).length;
    const paymentsCollected = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + toNumber(payment.amount), 0);

    return {
      trips: [
        { label: 'Total Trips', value: bookings.length, hint: 'All captured bookings', color: '#e8a020' },
        { label: 'Active Trips', value: activeBookings.length, hint: 'In review, assigned, or moving', color: '#6366f1' },
        { label: 'Completed', value: completedBookings.length, hint: 'Successfully delivered', color: '#22c55e' },
        { label: 'Cancelled', value: cancelledBookings.length, hint: 'Cancelled before completion', color: '#ef4444' },
      ],
      revenue: [
        { label: 'Collected Revenue', value: formatKes(paymentsCollected || totalRevenue), hint: 'Paid or released amounts', color: '#22c55e' },
        { label: 'Outstanding', value: formatKes(outstandingBookings.reduce((sum, booking) => sum + toNumber(booking.customer_rate || booking.final_fare), 0)), hint: 'Completed trips awaiting finance release', color: '#ef4444' },
        { label: 'Total Expenses', value: formatKes(totalExpenses), hint: 'Trip charge and delivery costs', color: '#f59e0b' },
        { label: 'Gross Profit', value: formatKes(totalProfit), hint: 'Revenue minus hire and expenses', color: '#2dd4bf' },
      ],
      drivers: [
        { label: 'Active Drivers', value: availableDrivers, hint: 'Available for assignment right now', color: '#22c55e' },
        { label: 'Driver Pool', value: toNumber(stats?.users?.drivers), hint: 'Approved and pending drivers', color: '#6366f1' },
        { label: 'Avg Rating', value: averageRating.toFixed(1), hint: 'Average customer rating', color: '#e8a020' },
        { label: 'Trips per Driver', value: drivers.length ? (completedBookings.length / drivers.length).toFixed(1) : '0.0', hint: 'Completed work distribution', color: '#2dd4bf' },
      ],
      fleet: [
        { label: 'Active Vehicles', value: activeVehicles, hint: 'Vehicles available in the system', color: '#22c55e' },
        { label: 'Verified Fleet', value: verifiedVehicles, hint: 'Documents approved and ready', color: '#6366f1' },
        { label: 'In Utilisation', value: activeBookings.filter((booking) => booking.vehicle_id).length, hint: 'Trips currently attached to a vehicle', color: '#e8a020' },
        { label: 'Awaiting Verification', value: Math.max(0, vehicles.length - verifiedVehicles), hint: 'Need compliance or document follow-up', color: '#ef4444' },
      ],
    };
  }, [bookings, drivers, financialReport, payments, stats, vehicles]);

  const monthSeries = useMemo(() => buildMonthSeries(bookings), [bookings]);
  const bookingStatusRows = useMemo(() => bookingsReport.map((row) => ({
    status: row.status,
    count: toNumber(row.count),
    totalFare: toNumber(row.total_fare),
  })), [bookingsReport]);

  const topDrivers = useMemo(() => (
    [...drivers]
      .sort((left, right) => toNumber(right.avg_rating) - toNumber(left.avg_rating))
      .slice(0, 5)
  ), [drivers]);

  const exportCurrentTab = () => {
    let rows = [];

    if (activeTab === 'trips') {
      rows = [
        ['metric', 'value'],
        ...metrics.trips.map((card) => [card.label, card.value]),
        ...bookingStatusRows.map((row) => [`status:${row.status}`, row.count]),
      ];
    }

    if (activeTab === 'revenue') {
      rows = [
        ['metric', 'value'],
        ...metrics.revenue.map((card) => [card.label, card.value]),
      ];
    }

    if (activeTab === 'drivers') {
      rows = [
        ['driver', 'rating', 'trips', 'available'],
        ...topDrivers.map((driver) => [
          driver.user?.full_name || 'Driver',
          toNumber(driver.avg_rating).toFixed(2),
          driver.total_trips,
          driver.is_available ? 'yes' : 'no',
        ]),
      ];
    }

    if (activeTab === 'fleet') {
      rows = [
        ['plate_number', 'vehicle_type', 'verified', 'active'],
        ...vehicles.map((vehicle) => [
          vehicle.plate_number,
          vehicle.vehicle_type,
          vehicle.is_verified || vehicle.is_approved ? 'yes' : 'no',
          vehicle.is_active ? 'yes' : 'no',
        ]),
      ];
    }

    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTab}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadOperationalExport = async () => {
    const response = await api.get('/api/v1/admin/reports/export?format=xlsx', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zito-bookings-export.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const insightCards = {
    trips: bookingStatusRows.map((row) => ({
      title: row.status.replace(/_/g, ' '),
      value: row.count,
      sub: formatKes(row.totalFare),
    })),
    revenue: monthSeries.map((month) => ({
      title: month.label,
      value: formatKes(month.revenue),
      sub: `${month.completed} completed`,
    })),
    drivers: topDrivers.map((driver) => ({
      title: driver.user?.full_name || 'Driver',
      value: `${toNumber(driver.avg_rating).toFixed(1)} stars`,
      sub: `${driver.total_trips || 0} total trips`,
    })),
    fleet: vehicles.slice(0, 6).map((vehicle) => ({
      title: vehicle.plate_number || vehicle.id,
      value: vehicle.vehicle_type,
      sub: vehicle.is_active ? 'Active' : 'Inactive',
    })),
  };

  return (
    <Layout title="Reports">
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Reports & Analytics</div>
          <div style={styles.subTitle}>
            Frontend-aligned PRD reporting with manual finance and map-service fallbacks until paid integrations go live.
          </div>
        </div>

        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryBtn} onClick={exportCurrentTab}>
            Export Snapshot
          </button>
          <button type="button" style={styles.primaryBtn} onClick={downloadOperationalExport}>
            Download Ops Export
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.tabGrid}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            style={{
              ...styles.tabCard,
              ...(activeTab === tab.key ? styles.tabCardActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            <div style={styles.tabLabel}>{tab.label}</div>
            <div style={styles.tabDesc}>{tab.desc}</div>
          </button>
        ))}
      </div>

      <div style={styles.metricsGrid}>
        {(metrics[activeTab] || []).map((card) => (
          <div key={card.label} style={styles.metricCard}>
            <div style={styles.metricLabel}>{card.label}</div>
            <div style={{ ...styles.metricValue, color: card.color }}>{card.value}</div>
            <div style={styles.metricHint}>{card.hint}</div>
          </div>
        ))}
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.chartPanel}>
          <div style={styles.panelTitle}>Six-Month Pulse</div>
          <div style={styles.panelSubTitle}>
            Trend bars are computed from existing booking data so reporting works before premium BI tooling is added.
          </div>

          <div style={styles.chartWrap}>
            {loading ? (
              <div style={styles.emptyState}>Loading report trends...</div>
            ) : (
              monthSeries.map((month) => {
                const value = activeTab === 'revenue'
                  ? month.revenue
                  : activeTab === 'drivers'
                    ? month.completed
                    : activeTab === 'fleet'
                      ? month.completed
                      : month.trips;
                const maxValue = Math.max(...monthSeries.map((item) => (
                  activeTab === 'revenue'
                    ? item.revenue
                    : activeTab === 'drivers'
                      ? item.completed
                      : activeTab === 'fleet'
                        ? item.completed
                        : item.trips
                )), 1);
                const height = Math.max(18, Math.round((value / maxValue) * 180));

                return (
                  <div key={month.key} style={styles.barColumn}>
                    <div style={styles.barValue}>
                      {activeTab === 'revenue' ? formatKes(value) : value}
                    </div>
                    <div style={{ ...styles.bar, height }} />
                    <div style={styles.barLabel}>{month.label}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={styles.sidePanel}>
          <div style={styles.panelTitle}>Focus Insights</div>
          <div style={styles.insightList}>
            {(insightCards[activeTab] || []).slice(0, 6).map((item) => (
              <div key={`${item.title}-${item.sub}`} style={styles.insightCard}>
                <div style={styles.insightTitle}>{item.title}</div>
                <div style={styles.insightValue}>{item.value}</div>
                <div style={styles.insightSub}>{item.sub}</div>
              </div>
            ))}
          </div>

          <div style={styles.notice}>
            Customer payments can be recorded manually now. Live M-Pesa settlement and premium route ETA will slot in later without changing this reporting surface.
          </div>
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#e8eaf2',
  },
  subTitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#8892a4',
    maxWidth: 720,
    lineHeight: 1.6,
  },
  headerActions: {
    display: 'flex',
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
    padding: '11px 16px',
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: 12,
    padding: '10px 12px',
    marginBottom: 16,
  },
  tabGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  tabCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 16,
    textAlign: 'left',
    cursor: 'pointer',
  },
  tabCardActive: {
    borderColor: 'rgba(232,160,32,0.4)',
    background: '#1a2132',
  },
  tabLabel: {
    color: '#e8eaf2',
    fontWeight: 700,
    fontSize: 14,
  },
  tabDesc: {
    marginTop: 6,
    fontSize: 12,
    color: '#8892a4',
    lineHeight: 1.5,
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 18,
  },
  metricLabel: {
    color: '#8892a4',
    fontSize: 12,
  },
  metricValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
  },
  metricHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#545f73',
    lineHeight: 1.5,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.8fr',
    gap: 16,
  },
  chartPanel: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
  },
  sidePanel: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
  },
  panelTitle: {
    color: '#e8eaf2',
    fontSize: 17,
    fontWeight: 800,
  },
  panelSubTitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#8892a4',
    lineHeight: 1.6,
  },
  chartWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: 14,
    alignItems: 'end',
    minHeight: 250,
    marginTop: 18,
  },
  barColumn: {
    display: 'grid',
    justifyItems: 'center',
    gap: 8,
  },
  barValue: {
    fontSize: 11,
    color: '#8892a4',
    textAlign: 'center',
    minHeight: 32,
  },
  bar: {
    width: '100%',
    maxWidth: 54,
    borderRadius: 14,
    background: 'linear-gradient(180deg, #e8a020 0%, #6366f1 100%)',
  },
  barLabel: {
    fontSize: 11,
    color: '#e8eaf2',
    fontWeight: 700,
  },
  insightList: {
    display: 'grid',
    gap: 10,
    marginTop: 16,
  },
  insightCard: {
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
  },
  insightTitle: {
    color: '#8892a4',
    fontSize: 12,
  },
  insightValue: {
    marginTop: 8,
    color: '#e8eaf2',
    fontSize: 15,
    fontWeight: 700,
  },
  insightSub: {
    marginTop: 4,
    color: '#545f73',
    fontSize: 12,
  },
  notice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.2)',
    color: '#93c5fd',
    fontSize: 12,
    lineHeight: 1.6,
  },
  emptyState: {
    color: '#8892a4',
    fontSize: 13,
  },
};
