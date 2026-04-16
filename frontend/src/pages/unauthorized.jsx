import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getHomePathForRole, normalizeRole } from '../utils/roles';


export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const homePath = getHomePathForRole(normalizeRole(user?.role));


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0d14',
      color: '#e8eaf2',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Access Denied</h1>
      <p style={{ color: '#8892a4', marginBottom: 32, textAlign: 'center' }}>
        You do not have permission to access this page.
      </p>
      <button
        onClick={() => navigate(homePath)}
        style={{
          padding: '12px 32px',
          background: '#e8a020',
          color: '#000',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
