import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import SwipeButton from '../components/swipebutton';

export default function Driver() {

  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [bookings, setBookings] = useState([]);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [toast, setToast] = useState(null);

  // ================= FETCH BOOKINGS =================
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/bookings', {
        params: { assigned_driver_id: user?.id }
      });
      setBookings(res.data?.data || res.data || []);
    } catch (err) {
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  // ================= FETCH DRIVER PROFILE =================
  const fetchDriverProfile = async () => {
    try {
      const res = await api.get(`/api/v1/drivers/${user?.id}`);
      setDriverProfile(res.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch driver profile:', err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBookings();
      fetchDriverProfile();
    }
  }, [user]);

  // ================= REAL-TIME UPDATES =================
  useEffect(() => {
    if (!socket) return;

    const handleStatusUpdate = (data) => {
      if (data.booking.assigned_driver_id === user?.id) {
        fetchBookings();
        showToast(`✅ Trip ${data.booking.reference} → ${data.new_status.replace('_', ' ')}`, 'info');
      }
    };

    socket.on('booking:status_updated', handleStatusUpdate);
    return () => socket.off('booking:status_updated', handleStatusUpdate);
  }, [socket, user?.id]);

  // ================= CALCULATIONS =================
  const calculateEarnings = () => {
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const total = completedBookings.reduce((sum, b) => sum + (parseFloat(b.final_fare) || 0), 0);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = completedBookings
      .filter(b => new Date(b.updated_at) >= oneWeekAgo)
      .reduce((sum, b) => sum + (parseFloat(b.final_fare) || 0), 0);

    return { total, thisWeek };
  };

  const getStats = () => {
    const completed = bookings.filter(b => b.status === 'completed').length;
    const active = bookings.filter(b => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(b.status)).length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    return { completed, active, cancelled };
  };

  const getFilteredBookings = () => {
    switch(filterTab) {
      case 'active':
        return bookings.filter(b => ['assigned', 'accepted', 'picked_up', 'in_transit'].includes(b.status));
      case 'completed':
        return bookings.filter(b => b.status === 'completed');
      case 'cancelled':
        return bookings.filter(b => b.status === 'cancelled');
      default:
        return bookings;
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ================= ACCEPT BOOKING =================
  const acceptBooking = async (id) => {
    try {
      await api.patch(`/api/v1/bookings/${id}/driver-accept`);
      showToast('✅ Trip accepted!');
      fetchBookings();
    } catch {
      showToast('Failed to accept booking', 'error');
    }
  };

  // ================= REJECT BOOKING =================
  const rejectBooking = async (id) => {
    try {
      await api.patch(`/api/v1/bookings/${id}/driver-reject`);
      showToast('❌ Trip rejected');
      fetchBookings();
    } catch {
      showToast('Failed to reject booking', 'error');
    }
  };

  // ================= UPDATE STATUS =================
  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/api/v1/bookings/${id}/status`, { status });
      fetchBookings();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const earnings = calculateEarnings();
  const stats = getStats();
  const filteredBookings = getFilteredBookings();

  const tabs = [
    { key: 'all', label: 'All', count: bookings.length },
    { key: 'active', label: 'Active', count: stats.active },
    { key: 'completed', label: 'Completed', count: stats.completed },
    { key: 'cancelled', label: 'Cancelled', count: stats.cancelled },
  ];

  // ================= UI =================
  return (
    <Layout title="Driver Dashboard">

      <div style={{ padding: 20 }}>

        {/* ── Toast Notification ── */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
            background: toast.type === 'error' ? '#dc2626' : '#16a34a',
            color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {toast.msg}
          </div>
        )}

        {/* ── HEADER ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', marginBottom: 4 }}>👨‍💼 {user?.full_name || 'Driver'}</h1>
          <p style={{ color: '#8892a4', marginBottom: 2 }}>Welcome back! Here's your performance summary</p>
          {driverProfile?.avg_rating && (
            <p style={{ color: '#22c55e', fontSize: 13 }}>⭐ {driverProfile.avg_rating}/5 • {driverProfile.total_trips || 0} trips completed</p>
          )}
        </div>

        {/* ── STATS CARDS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24
        }}>
          <div style={s.statCard}>
            <div style={s.statLabel}>💰 Total Earnings</div>
            <div style={{ ...s.statValue, color: '#22c55e' }}>KES {earnings.total.toLocaleString()}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>📊 This Week</div>
            <div style={{ ...s.statValue, color: '#3b82f6' }}>KES {earnings.thisWeek.toLocaleString()}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>📈 Total Trips</div>
            <div style={{ ...s.statValue, color: '#e8a020' }}>{bookings.length}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>⭐ My Rating</div>
            <div style={{ ...s.statValue, color: '#fbbf24' }}>
              {driverProfile?.avg_rating ? `${driverProfile.avg_rating}/5` : '—'}
            </div>
          </div>
        </div>

        {/* ── FILTER TABS ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 12 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                style={{
                  background: filterTab === tab.key ? 'rgba(232,160,32,0.1)' : 'transparent',
                  border: filterTab === tab.key ? '1px solid rgba(232,160,32,0.3)' : '1px solid rgba(255,255,255,0.07)',
                  color: filterTab === tab.key ? '#e8a020' : '#8892a4',
                  borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label} <span style={{ marginLeft: 6, fontSize: 11 }}>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── TRIP SUMMARY ── */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.07)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 4 }}>Active Trips</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{stats.active}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 4 }}>Completed</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{stats.completed}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 4 }}>Cancelled</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{stats.cancelled}</div>
            </div>
          </div>
        </div>

        {/* ── TRIPS LIST ── */}
        <h3 style={{ color: '#fff', marginBottom: 16 }}>My Trips ({filteredBookings.length})</h3>

        {loading && <p style={{ color: '#8892a4' }}>Loading trips...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {!loading && filteredBookings.length === 0 && (
          <p style={{ color: '#8892a4', textAlign: 'center', padding: 24 }}>No trips in this category</p>
        )}

        {!loading && filteredBookings.map((b) => (
          <div
            key={b.id}
            onClick={() => navigate(`/trip/${b.id}`, { state: { booking: b } })}
            style={{
              background: '#111621', border: '1px solid rgba(255,255,255,0.07)',
              padding: 16, marginBottom: 12, borderRadius: 10,
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{b.reference}</div>
                <div style={{ fontSize: 12, color: '#8892a4', marginBottom: 2 }}>📍 {b.pickup_address?.split(',')[0]}</div>
                <div style={{ fontSize: 12, color: '#8892a4' }}>🏁 {b.delivery_address?.split(',')[0]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  KES {(b.final_fare || b.estimated_fare)?.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#e8a020', textTransform: 'capitalize' }}>
                  {b.status?.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* ── ACTIONS ── */}
            <div style={{ marginTop: 12, display: 'flex', gap: 8, onClick: (e) => e.stopPropagation() }}>
              {b.status === 'assigned' && (
                <>
                  <SwipeButton onSuccess={() => acceptBooking(b.id)} text="Slide to Accept" style={{ flex: 1 }} />
                  <button
                    style={{
                      padding: '8px 12px', background: '#ef4444', border: 'none',
                      borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer'
                    }}
                    onClick={() => rejectBooking(b.id)}
                  >
                    Reject
                  </button>
                </>
              )}
              {b.status === 'accepted' && (
                <button
                  style={s.actionBtn}
                  onClick={() => updateStatus(b.id, 'picked_up')}
                >
                  📦 Mark Picked Up
                </button>
              )}
              {b.status === 'picked_up' && (
                <button
                  style={s.actionBtn}
                  onClick={() => updateStatus(b.id, 'in_transit')}
                >
                  🚚 Start Transit
                </button>
              )}
              {b.status === 'in_transit' && (
                <button
                  style={s.actionBtn}
                  onClick={() => updateStatus(b.id, 'delivered')}
                >
                  📍 Mark Delivered
                </button>
              )}
              {b.status === 'delivered' && (
                <button
                  style={s.actionBtn}
                  onClick={() => updateStatus(b.id, 'completed')}
                >
                  ✅ Complete
                </button>
              )}
            </div>

          </div>
        ))}

      </div>

    </Layout>
  );
}

const s = {
  statCard: {
    background: '#111621', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 16
  },
  statLabel: {
    fontSize: 12, color: '#8892a4', marginBottom: 8, fontWeight: 500
  },
  statValue: {
    fontSize: 20, fontWeight: 700, color: '#e8eaf2'
  },
  actionBtn: {
    padding: '8px 12px', background: 'rgba(232,160,32,0.1)', border: '1px solid rgba(232,160,32,0.3)',
    color: '#e8a020', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 1
  }
};
