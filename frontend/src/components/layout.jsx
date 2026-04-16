import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationPanel, { useNotifications } from './notifications';
import ConnectionStatus from './ConnectionStatus';
import { hasPermission } from '../utils/permission';
import { canUseViewAs, getHomePathForRole, normalizeRole } from '../utils/roles';

const navGroups = [
  {
    section: 'OPERATIONS',
    items: [
      { label: 'Dashboard', icon: 'DB', path: '/' },
      { label: 'Live Map', icon: 'MP', path: '/map' },
      { label: 'Trip Management', icon: 'TR', path: '/bookings' },
      { label: 'Assignments', icon: 'AS', path: '/assignments' },
      { label: 'Complaints', icon: 'CP', path: '/complaints' },
      { label: 'Help / SOS', icon: 'HP', path: '/help' },
      {
        label: 'Marketplace',
        icon: 'MK',
        path: '/marketplace',
        roles: ['driver', 'transporter', 'agent', 'super_admin', 'operations_admin', 'finance_admin'],
      },
      {
        label: 'Profile',
        icon: 'PF',
        path: '/profile',
        roles: ['driver', 'transporter', 'agent', 'super_admin', 'operations_admin', 'finance_admin'],
      },
    ],
  },
  {
    section: 'MANAGEMENT',
    items: [
      { label: 'Drivers', icon: 'DR', path: '/drivers' },
      { label: 'Fleet', icon: 'FL', path: '/fleet' },
      { label: 'Customers', icon: 'CU', path: '/customers' },
      { label: 'Transporters', icon: 'TP', path: '/transporters' },
      { label: 'Verification', icon: 'VR', path: '/verification' },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { label: 'Payments', icon: 'PM', path: '/payments' },
      { label: 'Contracts', icon: 'CT', path: '/contracts' },
      { label: 'Reports', icon: 'RP', path: '/reports' },
      { label: 'Settings', icon: 'ST', path: '/settings', roles: ['super_admin'] },
    ],
  },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);

  const role = normalizeRole(user?.role || '');
  const homePath = getHomePathForRole(role);
  const showViewAs = canUseViewAs(role);

  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();

  const pageTitle =
    navGroups.flatMap((group) => group.items).find((item) => item.path === location.pathname)?.label || title || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <div style={{ ...s.logoMark, cursor: 'pointer' }} onClick={() => navigate(homePath)}>
            <div style={s.logoIcon}>VG</div>
            <div>
              <div style={s.logoText}>ZITO</div>
              <div style={s.logoSub}>MOVE HEAVY MOVE SMART</div>
            </div>
          </div>
        </div>

        {showViewAs && (
          <div style={s.viewAs}>
            <div style={s.viewAsLabel}>VIEW AS</div>
            <div style={s.viewAsGrid}>
              {[
                { label: 'Customer', icon: 'CU', portal: '/portal/customer', color: '#6366f1' },
                { label: 'Agent', icon: 'AG', portal: '/portal/agent', color: '#22c55e' },
                { label: 'Driver', icon: 'DR', portal: '/portal/driver-view', color: '#2dd4bf' },
                { label: 'Transporter', icon: 'TP', portal: '/portal/transporter', color: '#e8a020' },
              ].map((previewTarget) => (
                <button
                  key={previewTarget.label}
                  style={s.viewAsBtn}
                  onClick={() => window.open(`${previewTarget.portal}?preview=true`, '_blank')}
                >
                  <span style={{ fontSize: 13 }}>{previewTarget.icon}</span>
                  <span style={{ color: previewTarget.color }}>{previewTarget.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <nav style={s.nav}>
          {navGroups.map((group) => (
            <div key={group.section}>
              <div style={s.navSectionTitle}>{group.section}</div>

              {group.items
                .filter((item) => {
                  if (item.roles) {
                    return item.roles.map(normalizeRole).includes(role);
                  }

                  const permissionKey = item.path.replace('/', '') || 'dashboard';
                  return hasPermission(role, permissionKey);
                })
                .map((item) => {
                  const isActive = location.pathname === item.path;

                  return (
                    <div
                      key={item.label}
                      style={{ ...s.navItem, ...(isActive ? s.navItemActive : {}) }}
                      onClick={() => navigate(item.path)}
                    >
                      <span style={s.niIcon}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <div style={s.headerTitle}>{pageTitle}</div>
            <ConnectionStatus />
          </div>

          <div style={s.headerRight}>
            <div style={s.bellWrap}>
              <button style={s.bellBtn} onClick={() => setShowNotifs((value) => !value)}>
                NT {unreadCount > 0 && <span style={s.badge}>{unreadCount}</span>}
              </button>

              {showNotifs && (
                <NotificationPanel
                  notifications={notifications}
                  loading={loading}
                  markRead={markRead}
                  markAllRead={markAllRead}
                />
              )}
            </div>

            <div style={s.userBox}>
              <div style={s.userName}>{user?.full_name || 'User'}</div>
              <div style={s.userRole}>{role || 'guest'}</div>
            </div>

            <button style={s.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div style={s.content}>{children}</div>
      </main>
    </div>
  );
}

const s = {
  shell: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    minHeight: '100vh',
    background: '#0f121c',
    color: '#e8eaf2',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  sidebar: {
    background: '#0b0e16',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '18px 18px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  logo: {},
  logoMark: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  logoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: '#e8a020',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    color: '#0f121c',
  },
  logoText: { fontWeight: 800, fontSize: 16, letterSpacing: 0.5 },
  logoSub: { fontSize: 11, color: '#8b95a9', letterSpacing: 0.6 },
  viewAs: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  viewAsLabel: { fontSize: 11, color: '#8b95a9', marginBottom: 8, letterSpacing: 0.8 },
  viewAsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  viewAsBtn: {
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '10px 6px',
    display: 'grid',
    gap: 6,
    placeItems: 'center',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 18 },
  navSectionTitle: { fontSize: 11, color: '#6b7280', letterSpacing: 0.6, marginBottom: 6 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: '#cbd5e1',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  navItemActive: {
    background: 'rgba(232,160,32,0.12)',
    color: '#fff',
    border: '1px solid rgba(232,160,32,0.35)',
  },
  niIcon: { width: 18, textAlign: 'center' },
  main: { display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 22px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
  },
  headerTitle: { fontSize: 20, fontWeight: 800 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 14 },
  bellWrap: { position: 'relative' },
  bellBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    borderRadius: 999,
    padding: '2px 6px',
    fontSize: 11,
    marginLeft: 6,
  },
  userBox: { textAlign: 'right' },
  userName: { fontWeight: 700 },
  userRole: { fontSize: 12, color: '#8b95a9' },
  logoutBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'transparent',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  content: { padding: 20 },
};
