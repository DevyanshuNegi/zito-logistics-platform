import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationPanel, { useNotifications } from './notifications';
import ConnectionStatus from './ConnectionStatus';
import ViewAsSwitcher from './ViewAsSwitcher';
import { hasPermission } from '../utils/permission';
import { ADMIN_ROLES, canUseViewAs, getHomePathForRole, normalizeRole } from '../utils/roles';

const navGroups = [
  {
    section: 'OPERATIONS',
    items: [
      { label: 'Dashboard', icon: 'DB', path: '/' },
      { label: 'Live Map', icon: 'MP', path: '/map' },
      { label: 'Trip Management', icon: 'TR', path: '/bookings' },
      { label: 'Assignments', icon: 'AS', path: '/assignments' },
      { label: 'Notifications', icon: 'NT', path: '/notifications', roles: ADMIN_ROLES },
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
      { label: 'Audit Log', icon: 'AL', path: '/audit-log', roles: ADMIN_ROLES },
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
  const { user, adminUser, logout, endViewAs, isViewingAs } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div style={{
      ...s.shell,
      gridTemplateColumns: isMobile ? '1fr' : '280px 1fr'
    }}>
      {/* MOBILE OVERLAY BACKDROP */}
      {isMobile && showMobileMenu && (
        <div
          style={s.mobileBackdrop}
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* SIDEBAR - HIDDEN ON MOBILE UNLESS showMobileMenu IS TRUE */}
      <aside style={{
        ...s.sidebar,
        ...(isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '280px',
          zIndex: showMobileMenu ? 1001 : -1,
          opacity: showMobileMenu ? 1 : 0,
          pointerEvents: showMobileMenu ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        } : {})
      }}>
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
            <ViewAsSwitcher />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#e8eaf2',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ☰
              </button>
            )}
            <div>
              <div style={s.headerTitle}>{pageTitle}</div>
              <ConnectionStatus />
            </div>
          </div>

          <div style={s.headerRight}>
            <div style={s.bellWrap}>
              <button style={s.bellBtn} onClick={() => setShowNotifs((value) => !value)}>
                NT {unreadCount > 0 && <span style={s.badge}>{unreadCount}</span>}
              </button>

              {showNotifs && (
                <NotificationPanel
                  onClose={() => setShowNotifs(false)}
                  notifications={notifications}
                  loading={loading}
                  unreadCount={unreadCount}
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

        <div style={s.content}>
          {isViewingAs && (
            <div style={{
              background: '#fff3cd',
              color: '#856404',
              padding: '12px 16px',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              border: '1px solid #ffc107'
            }}>
              <div>
                <strong>View As Mode:</strong> Viewing as {user?.email} ({user?.role})
              </div>
              <button
                onClick={endViewAs}
                style={{
                  background: '#ffc107',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#000'
                }}
              >
                Exit View As
              </button>
            </div>
          )}
          {children}
        </div>
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
    position: 'relative',
  },
  mobileBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
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
