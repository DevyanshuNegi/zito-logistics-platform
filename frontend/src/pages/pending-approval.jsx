import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─── Role-specific messages ───────────────────────────────────────────────────
const ROLE_INFO = {
  driver: {
    icon: '🚛',
    title: 'Driver Application Under Review',
    steps: [
      'Admin verifies your National ID',
      'Driving licence checked with NTSA',
      'Background check completed',
      'Vehicle assignment ready',
    ],
    eta: 'Usually approved within 1–2 business days',
  },
  transporter: {
    icon: '🏭',
    title: 'Transporter Application Under Review',
    steps: [
      'Admin verifies your company details',
      'Vehicle documents reviewed',
      'Insurance certificates checked',
      'Fleet registered in the system',
    ],
    eta: 'Usually approved within 2–3 business days',
  },
  agent: {
    icon: '🤝',
    title: 'Agent Application Under Review',
    steps: [
      'Admin verifies your identity',
      'Agency credentials confirmed',
      'Account permissions configured',
      'Training materials sent to your email',
    ],
    eta: 'Usually approved within 1 business day',
  },
  customer: {
    icon: '👤',
    title: 'Account Pending Activation',
    steps: [
      'Admin reviews your registration',
      'Account details verified',
      'Booking access enabled',
      'Welcome email sent',
    ],
    eta: 'Usually approved within a few hours',
  },
};

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const info = ROLE_INFO[user?.role] || ROLE_INFO.customer;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const S = {
    wrapper: {
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f121c',
      fontFamily: 'system-ui', padding: 16,
    },
    card: {
      width: '100%', maxWidth: 440, background: '#181e2d',
      borderRadius: 18, padding: '36px 28px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      textAlign: 'center',
    },
    icon:     { fontSize: 52, marginBottom: 12 },
    badge: {
      display: 'inline-block', background: 'rgba(232,160,32,0.12)',
      border: '1px solid rgba(232,160,32,0.3)',
      color: '#e8a020', fontSize: 11, fontWeight: 700,
      padding: '4px 12px', borderRadius: 20, marginBottom: 16,
      letterSpacing: 0.5,
    },
    title:   { fontSize: 20, fontWeight: 800, color: '#e8eaf2', marginBottom: 8 },
    name:    { fontSize: 14, color: '#8892a4', marginBottom: 24 },
    stepsBox: {
      background: '#111621', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '18px 20px', marginBottom: 20, textAlign: 'left',
    },
    stepsTitle: { fontSize: 12, color: '#545f73', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    step: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
    stepDot: {
      width: 8, height: 8, borderRadius: '50%',
      background: 'rgba(232,160,32,0.4)', flexShrink: 0,
    },
    stepText: { fontSize: 13, color: '#8892a4' },
    etaBox: {
      background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
      borderRadius: 10, padding: '10px 16px', marginBottom: 24,
    },
    etaText: { fontSize: 12, color: '#22c55e' },
    supportBox: {
      background: '#111621', borderRadius: 10, padding: '12px 16px',
      marginBottom: 24, fontSize: 12, color: '#545f73', lineHeight: 1.6,
    },
    logoutBtn: {
      width: '100%', padding: '12px', background: 'transparent',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
      color: '#8892a4', fontSize: 13, cursor: 'pointer',
    },
    refreshBtn: {
      width: '100%', padding: '13px', background: '#e8a020',
      border: 'none', borderRadius: 8, fontWeight: 700,
      fontSize: 14, color: '#0f121c', cursor: 'pointer', marginBottom: 10,
    },
  };

  return (
    <div style={S.wrapper}>
      <div style={S.card}>

        <div style={S.icon}>{info.icon}</div>
        <div style={S.badge}>⏳ PENDING APPROVAL</div>
        <div style={S.title}>{info.title}</div>
        <div style={S.name}>
          Hello, <strong style={{ color: '#e8eaf2' }}>{user?.full_name || user?.name || 'there'}</strong>!
          Your account is being reviewed.
        </div>

        {/* Approval steps */}
        <div style={S.stepsBox}>
          <div style={S.stepsTitle}>Review Checklist</div>
          {info.steps.map((step, i) => (
            <div key={i} style={S.step}>
              <div style={S.stepDot} />
              <span style={S.stepText}>{step}</span>
            </div>
          ))}
        </div>

        {/* ETA */}
        <div style={S.etaBox}>
          <div style={S.etaText}>🕐 {info.eta}</div>
        </div>

        {/* Support info */}
        <div style={S.supportBox}>
          Need help? Contact our support team at{' '}
          <span style={{ color: '#e8a020' }}>support@vglogistics.co.ke</span>
          <br />or call <span style={{ color: '#e8a020' }}>+254 700 000 000</span>
        </div>

        {/* Actions */}
        <button style={S.refreshBtn} onClick={() => window.location.reload()}>
          🔄 Check Approval Status
        </button>
        <button style={S.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>

      </div>
    </div>
  );
}