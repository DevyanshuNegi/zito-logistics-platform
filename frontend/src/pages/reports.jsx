import { useState } from 'react';
import Layout from '../components/layout';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('trips');

  const tabs = [
    { key: 'trips',   label: '📋 Trips',   desc: 'Trip volume and performance' },
    { key: 'revenue', label: '💰 Revenue', desc: 'Revenue breakdown by method' },
    { key: 'drivers', label: '👤 Drivers', desc: 'Driver performance metrics' },
    { key: 'fleet',   label: '🚛 Fleet',   desc: 'Vehicle utilisation' },
  ];

  const reportCards = {
    trips: [
      { title: 'Total Trips', value: '—', sub: 'All time', color: '#e8a020' },
      { title: 'Completed', value: '—', sub: 'Successfully delivered', color: '#22c55e' },
      { title: 'Cancelled', value: '—', sub: 'Cancelled by customer/admin', color: '#ef4444' },
      { title: 'Avg Distance', value: '— km', sub: 'Per trip average', color: '#2dd4bf' },
      { title: 'On-Time Rate', value: '—%', sub: 'Delivered on schedule', color: '#6366f1' },
      { title: 'Avg Delivery Time', value: '— hrs', sub: 'Pickup to delivery', color: '#f59e0b' },
    ],
    revenue: [
      { title: 'Total Revenue', value: 'KES —', sub: 'All payments collected', color: '#e8a020' },
      { title: 'Cash Collected', value: 'KES —', sub: 'Cash on delivery', color: '#22c55e' },
      { title: 'M-Pesa Revenue', value: 'KES —', sub: 'Mobile money', color: '#2dd4bf' },
      { title: 'Credit Invoiced', value: 'KES —', sub: 'Invoiced to customers', color: '#6366f1' },
      { title: 'Outstanding', value: 'KES —', sub: 'Unpaid invoices', color: '#ef4444' },
      { title: 'Avg Trip Value', value: 'KES —', sub: 'Revenue per trip', color: '#f59e0b' },
    ],
    drivers: [
      { title: 'Active Drivers', value: '—', sub: 'Currently available', color: '#22c55e' },
      { title: 'Top Rated', value: '—', sub: 'Rating above 4.5', color: '#e8a020' },
      { title: 'Trips This Month', value: '—', sub: 'Total driver trips', color: '#2dd4bf' },
      { title: 'Avg Rating', value: '—', sub: 'Platform average', color: '#6366f1' },
      { title: 'On Probation', value: '—', sub: 'New drivers', color: '#f59e0b' },
      { title: 'Suspended', value: '—', sub: 'License/doc issues', color: '#ef4444' },
    ],
    fleet: [
      { title: 'Total Vehicles', value: '—', sub: 'All fleet', color: '#e8a020' },
      { title: 'VG-Owned', value: '—', sub: 'Company fleet', color: '#6366f1' },
      { title: 'Contracted', value: '—', sub: 'Third-party vehicles', color: '#2dd4bf' },
      { title: 'Utilisation Rate', value: '—%', sub: 'Active vs idle', color: '#22c55e' },
      { title: 'In Maintenance', value: '—', sub: 'Currently off-road', color: '#f59e0b' },
      { title: 'Expiring Docs', value: '—', sub: 'Insurance / NTSA in 30 days', color: '#ef4444' },
    ],
  };

  return (
    <Layout title="Reports">
      <div style={s.sectionHeader}>
        <div>
          <div style={s.sectionTitle}>Reports & Analytics</div>
          <div style={s.sectionSub}>Operational insights across trips, revenue, drivers and fleet</div>
        </div>
        <button style={s.btnPrimary}>⬇ Export Report</button>
      </div>

      {/* TAB NAV */}
      <div style={s.tabNav}>
        {tabs.map(t => (
          <button key={t.key}
            style={{ ...s.tabCard, ...(activeTab === t.key ? s.tabCardActive : {}) }}
            onClick={() => setActiveTab(t.key)}>
            <div style={s.tabLabel}>{t.label}</div>
            <div style={s.tabDesc}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* METRIC CARDS */}
      <div style={s.metricsGrid}>
        {(reportCards[activeTab] || []).map((card, i) => (
          <div key={i} style={{ ...s.metricCard, borderTop: `2px solid ${card.color}` }}>
            <div style={s.metricTitle}>{card.title}</div>
            <div style={{ ...s.metricValue, color: card.color }}>{card.value}</div>
            <div style={s.metricSub}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* COMING SOON BANNER */}
      <div style={s.comingSoon}>
        <div style={s.comingIcon}>📊</div>
        <div>
          <div style={s.comingTitle}>Charts & Graphs — Coming Soon</div>
          <div style={s.comingSub}>
            Once trips and payments are connected, this section will show interactive charts:
            trip volume trends, revenue by month, driver performance rankings, and fleet utilisation graphs.
          </div>
        </div>
      </div>

      {/* QUICK EXPORT CARDS */}
      <div style={s.exportGrid}>
        {[
          { title: 'Trip Report', desc: 'All trips with status, distance, fare', icon: '📋', endpoint: '/api/v1/reports/trips' },
          { title: 'Revenue Report', desc: 'Payments breakdown by method', icon: '💰', endpoint: '/api/v1/reports/revenue' },
          { title: 'Driver Report', desc: 'Performance metrics per driver', icon: '👤', endpoint: '/api/v1/reports/drivers' },
          { title: 'Fleet Report', desc: 'Vehicle utilisation & maintenance', icon: '🚛', endpoint: '/api/v1/reports/fleet' },
        ].map((r, i) => (
          <div key={i} style={s.exportCard}>
            <div style={s.exportIcon}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={s.exportTitle}>{r.title}</div>
              <div style={s.exportDesc}>{r.desc}</div>
            </div>
            <button style={s.exportBtn}>CSV</button>
            <button style={s.exportBtn}>PDF</button>
          </div>
        ))}
      </div>
    </Layout>
  );
}

const s = {
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sectionTitle: { fontWeight: 700, fontSize: 18, color: '#e8eaf2', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#8892a4' },
  btnPrimary: { background: '#e8a020', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabNav: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  tabCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' },
  tabCardActive: { background: '#1f2840', borderColor: '#e8a020' },
  tabLabel: { fontWeight: 600, fontSize: 14, color: '#e8eaf2', marginBottom: 4 },
  tabDesc: { fontSize: 11, color: '#8892a4' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 },
  metricCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 },
  metricTitle: { fontSize: 12, color: '#8892a4', marginBottom: 8, fontWeight: 500 },
  metricValue: { fontWeight: 800, fontSize: 26, marginBottom: 4 },
  metricSub: { fontSize: 11, color: '#545f73' },
  comingSoon: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  comingIcon: { fontSize: 32, flexShrink: 0 },
  comingTitle: { fontWeight: 600, fontSize: 15, color: '#e8eaf2', marginBottom: 6 },
  comingSub: { fontSize: 13, color: '#8892a4', lineHeight: 1.6 },
  exportGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  exportCard: { background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 },
  exportIcon: { fontSize: 22 },
  exportTitle: { fontWeight: 600, fontSize: 13, color: '#e8eaf2', marginBottom: 2 },
  exportDesc: { fontSize: 12, color: '#8892a4' },
  exportBtn: { background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' },
};