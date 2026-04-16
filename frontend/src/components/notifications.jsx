import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useSocket } from '../contexts/SocketContext';

// ── Notification types ─────────────────────────────────────────────────────
const N_CFG = {
  trip_assigned:   { icon: '📌', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Trip Assigned' },
  trip_started:    { icon: '🚛', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', label: 'Trip Started' },
  trip_completed:  { icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Trip Completed' },
  trip_cancelled:  { icon: '✕',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Trip Cancelled' },
  payment_received:{ icon: '💰', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Payment Received' },
  payment_due:     { icon: '⚠',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Payment Due' },
  verification:    { icon: '🔍', color: '#e8a020', bg: 'rgba(232,160,32,0.12)', label: 'Verification' },
  driver_online:   { icon: '👤', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', label: 'Driver Online' },
  system:          { icon: 'ℹ',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'System' },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

// ── Generate notifications from live data ──────────────────────────────────
async function buildNotifications() {
  const notes = [];

  try {
    let bookings = [];
    try {
      const bRes = await api.get('/api/v1/bookings');
      bookings = bRes.data?.data || bRes.data || [];
    } catch (err) {
      console.warn('Bookings API not ready');
    }

    bookings.forEach(b => {
      const id = b.id;
      const ref = `#${String(id).padStart(4, '0')}`;

      if (b.status === 'assigned') {
        notes.push({
          id: `trip_assigned_${id}`,
          type: 'trip_assigned',
          title: `Trip ${ref} assigned`,
          body: `${b.pickup_location || '—'} → ${b.dropoff_location || '—'}`,
          time: b.updated_at || b.created_at,
          link: '/assignments',
          read: false,
        });
      }

      if (b.status === 'in_transit') {
        notes.push({
          id: `trip_started_${id}`,
          type: 'trip_started',
          title: `Trip ${ref} is in transit`,
          body: `${b.pickup_location || '—'} → ${b.dropoff_location || '—'}`,
          time: b.updated_at || b.created_at,
          link: '/map',
          read: false,
        });
      }

      if (b.status === 'completed') {
        notes.push({
          id: `trip_completed_${id}`,
          type: 'trip_completed',
          title: `Trip ${ref} completed`,
          body: `KES ${Number(b.amount || b.total_amount || 0).toLocaleString()} earned`,
          time: b.updated_at || b.created_at,
          link: '/payments',
          read: true,
        });
      }

      if (b.status === 'cancelled') {
        notes.push({
          id: `trip_cancelled_${id}`,
          type: 'trip_cancelled',
          title: `Trip ${ref} was cancelled`,
          body: `${b.pickup_location || '—'} → ${b.dropoff_location || '—'}`,
          time: b.updated_at || b.created_at,
          link: '/bookings',
          read: true,
        });
      }
    });

    let pending = [];
    try {
      const vRes = await api.get('/api/v1/users?verification_status=pending');
      pending = vRes.data?.data || vRes.data || [];
    } catch (err) {
      console.warn('Users verification API not ready');
    }

    if (pending.length > 0) {
      notes.push({
        id: `verification_pending_${pending.length}`,
        type: 'verification',
        title: `${pending.length} pending verification${pending.length > 1 ? 's' : ''}`,
        body:
          pending
            .slice(0, 3)
            .map(u => u.full_name)
            .join(', ') + (pending.length > 3 ? ` +${pending.length - 3} more` : ''),
        time: pending[0]?.created_at || new Date().toISOString(),
        link: '/verification',
        read: false,
      });
    }

    let unpaid = [];
    try {
      const pRes = await api.get('/api/v1/bookings?status=completed&payment_status=pending');
      unpaid = pRes.data?.data || pRes.data || [];
    } catch (err) {
      console.warn('Payments API not ready');
    }

    if (unpaid.length > 0) {
      notes.push({
        id: `payment_due_${unpaid.length}`,
        type: 'payment_due',
        title: `${unpaid.length} payment${unpaid.length > 1 ? 's' : ''} outstanding`,
        body: `KES ${unpaid
          .reduce((s, b) => s + (parseFloat(b.amount || b.total_amount) || 0), 0)
          .toLocaleString()} total pending`,
        time: new Date().toISOString(),
        link: '/payments',
        read: false,
      });
    }
  } catch (err) {
    console.error('Notification build error:', err);
  }

  return notes
    .filter(n => n.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 30);
}

// ── useNotifications hook ──────────────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const readIdsRef = useRef(
    new Set(JSON.parse(localStorage.getItem('vg_read_notifs') || '[]'))
  );

  const load = useCallback(async () => {
    const notes = await buildNotifications();

    const updated = notes.map(n => ({
      ...n,
      read: readIdsRef.current.has(n.id) ? true : n.read,
    }));

    setNotifications(updated);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);

    // Socket event listeners for real-time updates
    if (socket) {
      const handleBookingStatusUpdate = (data) => {
        console.log('📡 Real-time booking status update:', data);
        // Reload notifications to reflect the change
        load();
      };

      const handleBookingCreated = (data) => {
        console.log('📡 Real-time booking created:', data);
        load();
      };

      const handleDriverAssigned = (data) => {
        console.log('📡 Real-time driver assigned:', data);
        load();
      };

      socket.on('booking:status_updated', handleBookingStatusUpdate);
      socket.on('booking:created', handleBookingCreated);
      socket.on('booking:driver_assigned', handleDriverAssigned);

      return () => {
        clearInterval(interval);
        socket.off('booking:status_updated', handleBookingStatusUpdate);
        socket.off('booking:created', handleBookingCreated);
        socket.off('booking:driver_assigned', handleDriverAssigned);
      };
    }

    return () => clearInterval(interval);
  }, [load, socket]);

  const markRead = useCallback(id => {
    readIdsRef.current.add(id);
    localStorage.setItem('vg_read_notifs', JSON.stringify([...readIdsRef.current]));
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => {
        readIdsRef.current.add(n.id);
        return { ...n, read: true };
      });
      localStorage.setItem('vg_read_notifs', JSON.stringify([...readIdsRef.current]));
      return updated;
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, reload: load };
}

// ── NotificationPanel component ────────────────────────────────────────────
export default function NotificationPanel({
  onClose,
  notifications,
  loading,
  unreadCount,
  markRead,
  markAllRead
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} style={{ position: 'absolute', top: 54, right: 0, width: 360, background: '#111621', borderRadius: 14 }}>
      <div style={{ padding: 14, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Notifications</div>
          {unreadCount > 0 && <div style={{ fontSize: 12 }}>{unreadCount} unread</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead}>Mark all read</button>
          )}
          <button onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 20 }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 20 }}>No notifications</div>
        ) : (
          notifications.map(n => {
            const cfg = N_CFG[n.type] || N_CFG.system;

            return (
              <div
                key={n.id}
                style={{ padding: 12, display: 'flex', gap: 10, cursor: 'pointer' }}
                onClick={() => {
                  markRead(n.id);
                  onClose();
                  if (n.link) window.location.href = n.link;
                }}
              >
                <div>{cfg.icon}</div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12 }}>{n.body}</div>}
                  <div style={{ fontSize: 11 }}>{timeAgo(n.time)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}