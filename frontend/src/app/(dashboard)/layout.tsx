'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

// Legacy components - we will keep them as .jsx for now and patch them if needed
// Or dynamically import them if they give SSR trouble, but here we enforce 'use client'
import NotificationPanel, { useNotifications } from '@/components/notifications';
import ConnectionStatus from '@/components/ConnectionStatus';
import ViewAsSwitcher from '@/components/ViewAsSwitcher';

import { hasPermission } from '@/utils/permission';
import { ADMIN_ROLES, canUseViewAs, getHomePathForRole, normalizeRole } from '@/utils/roles';

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
        // Using string matching to PRD roles
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

const s = {
  shell: {
    display: 'grid',
    height: '100vh',
    background: '#0a0d14',
    color: '#e8eaf2',
    fontFamily: '"DM Sans", "Inter", sans-serif',
  },
  sidebar: {
    background: '#111621',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  } as React.CSSProperties,
  mobileBackdrop: {
    position: 'fixed' as React.CSSProperties['position'],
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1000
  },
  logo: { padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  logoMark: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: {
    width: '36px', height: '36px', background: '#e8a020',
    color: '#000', borderRadius: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '18px', letterSpacing: '-1px'
  },
  logoText: { fontSize: '20px', fontWeight: 800, letterSpacing: '2px', lineHeight: 1 },
  logoSub: { fontSize: '10px', color: '#e8a020', fontWeight: 700, letterSpacing: '0.5px', marginTop: '2px' },

  viewAs: { padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(232,160,32,0.05)' },

  nav: { padding: '20px', flex: 1 },
  navSectionTitle: {
    fontSize: '11px', color: '#545f73', fontWeight: 700,
    letterSpacing: '1px', marginBottom: '12px', marginTop: '24px'
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
    color: '#8892a4', fontSize: '14px', fontWeight: 600,
    marginBottom: '4px', transition: 'all 0.2s',
  },
  navItemActive: { background: 'rgba(232,160,32,0.1)', color: '#e8a020' },
  niIcon: { fontSize: '16px', opacity: 0.8 },

  main: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' } as React.CSSProperties,
  header: {
    height: '70px', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#0a0d14'
  },
  headerTitle: { fontSize: '18px', fontWeight: 700, marginRight: '16px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '20px' },

  bellWrap: { position: 'relative' } as React.CSSProperties,
  bellBtn: {
    background: '#111621', border: '1px solid rgba(255,255,255,0.1)',
    width: '40px', height: '40px', borderRadius: '50%',
    color: '#8892a4', fontSize: '13px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600,
  },
  badge: {
    position: 'absolute' as React.CSSProperties['position'],
    top: '-4px', right: '-4px', background: '#dc2626',
    color: '#fff', fontSize: '10px', fontWeight: 700,
    padding: '2px 6px', borderRadius: '10px', border: '2px solid #0a0d14'
  },

  userPill: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '6px 12px', background: '#111621',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
    cursor: 'pointer'
  },
  avatar: {
    width: '28px', height: '28px', background: '#e8a020',
    color: '#000', borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '12px'
  },
  userName: { fontSize: '13px', fontWeight: 600 },
  userRole: { fontSize: '11px', color: '#8892a4', textTransform: 'capitalize' as React.CSSProperties['textTransform'] },

  content: { flex: 1, overflowY: 'auto', padding: '24px' } as React.CSSProperties,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Use Zustand global store instead of legacy context
  const { user, logout } = useAuthStore();
  
  const router = useRouter();
  const pathname = usePathname();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };
    
    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const role = normalizeRole(user?.role || '');
  const homePath = getHomePathForRole(role);
  const showViewAs = canUseViewAs(role);

  // Still utilizing the existing notification hooks from notifications.jsx for rapid migration
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted) return null; // prevent hydration mismatch

  // Determine current active page label
  const pageTitle =
    navGroups.flatMap((group) => group.items).find((item) => item.path === pathname)?.label || 'Dashboard';

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

      {/* SIDEBAR */}
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
          <div style={{ ...s.logoMark, cursor: 'pointer' }} onClick={() => router.push(homePath)}>
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
                  const isActive = pathname === item.path;

                  return (
                    <div
                      key={item.label}
                      style={{ ...s.navItem, ...(isActive ? s.navItemActive : {}) }}
                      onClick={() => {
                        router.push(item.path);
                        if (isMobile) setShowMobileMenu(false);
                      }}
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
                  notifications={notifications} 
                  loading={loading} 
                  onClose={() => setShowNotifs(false)} 
                  onMarkRead={markRead} 
                  onMarkAllRead={markAllRead} 
                />
              )}
            </div>

            <div style={s.userPill} onClick={handleLogout}>
              <div style={s.avatar}>{user?.full_name?.charAt(0) || 'U'}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={s.userName}>{user?.full_name || 'User'}</span>
                <span style={s.userRole}>{user?.role || 'Guest'}</span>
              </div>
            </div>
          </div>
        </header>

        <section style={s.content}>
          {children}
        </section>
      </main>
    </div>
  );
}