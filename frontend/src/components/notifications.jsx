import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useSocket } from '../contexts/SocketContext';

const N_CFG = {
  trip_assigned:   { icon: 'AS', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Trip Assigned' },
  trip_started:    { icon: 'MV', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', label: 'Trip Started' },
  trip_completed:  { icon: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Trip Completed' },
  trip_cancelled:  { icon: 'CX', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Trip Cancelled' },
  payment_received:{ icon: 'PM', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Payment Received' },
  payment_due:     { icon: 'PD', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Payment Due' },
  verification:    { icon: 'VR', color: '#e8a020', bg: 'rgba(232,160,32,0.12)', label: 'Verification' },
  system:          { icon: 'SY', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'System' },
};

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
}

const getRouteLabel = (booking) => [
  booking.pickup_address || booking.pickup_location || 'Unknown pickup',
  booking.delivery_address || booking.dropoff_location || booking.dropoff_address || 'Unknown delivery',
].join(' -> ');

async function buildNotifications() {
  const notes = [];

  try {
    let bookings = [];
    try {
      const bookingResponse = await api.get('/api/v1/bookings?limit=50');
      bookings = bookingResponse.data?.data || [];
    } catch (err) {
      console.warn('Bookings API not ready');
    }

    bookings.forEach((booking) => {
      const bookingId = booking.id;
      const bookingRef = booking.reference || `#${String(bookingId).slice(-6).toUpperCase()}`;
      const routeLabel = getRouteLabel(booking);
      const amount = Number(
        booking.customer_rate || booking.final_fare || booking.estimated_fare || booking.amount || 0,
      );

      if (booking.status === 'assigned') {
        notes.push({
          id: `trip_assigned_${bookingId}`,
          type: 'trip_assigned',
          title: `Trip ${bookingRef} assigned`,
          body: routeLabel,
          time: booking.updated_at || booking.created_at,
          link: '/assignments',
          read: false,
        });
      }

      if (booking.status === 'in_transit') {
        notes.push({
          id: `trip_started_${bookingId}`,
          type: 'trip_started',
          title: `Trip ${bookingRef} is in transit`,
          body: routeLabel,
          time: booking.updated_at || booking.created_at,
          link: '/map',
          read: false,
        });
      }

      if (booking.status === 'completed') {
        notes.push({
          id: `trip_completed_${bookingId}`,
          type: 'trip_completed',
          title: `Trip ${bookingRef} completed`,
          body: `KES ${amount.toLocaleString()} delivered successfully`,
          time: booking.updated_at || booking.completed_at || booking.created_at,
          link: '/reports',
          read: true,
        });
      }

      if (booking.status === 'cancelled') {
        notes.push({
          id: `trip_cancelled_${bookingId}`,
          type: 'trip_cancelled',
          title: `Trip ${bookingRef} was cancelled`,
          body: routeLabel,
          time: booking.updated_at || booking.cancelled_at || booking.created_at,
          link: '/bookings',
          read: true,
        });
      }
    });

    let pendingUsers = [];
    try {
      const usersResponse = await api.get('/api/v1/users?verification_status=pending');
      pendingUsers = usersResponse.data?.data || [];
    } catch (err) {
      console.warn('User verification API not ready');
    }

    if (pendingUsers.length > 0) {
      notes.push({
        id: `verification_pending_${pendingUsers.length}`,
        type: 'verification',
        title: `${pendingUsers.length} verification review${pendingUsers.length > 1 ? 's' : ''} pending`,
        body: pendingUsers
          .slice(0, 3)
          .map((user) => user.full_name)
          .join(', '),
        time: pendingUsers[0]?.created_at || new Date().toISOString(),
        link: '/verification',
        read: false,
      });
    }

    const outstandingBookings = bookings.filter(
      (booking) => booking.status === 'completed' && !['released', 'paid', 'refunded'].includes(booking.payment_status),
    );

    if (outstandingBookings.length > 0) {
      notes.push({
        id: `payment_due_${outstandingBookings.length}`,
        type: 'payment_due',
        title: `${outstandingBookings.length} completed trip${outstandingBookings.length > 1 ? 's' : ''} awaiting finance`,
        body: `KES ${outstandingBookings
          .reduce((sum, booking) => sum + Number(booking.customer_rate || booking.final_fare || 0), 0)
          .toLocaleString()} outstanding`,
        time: outstandingBookings[0]?.updated_at || new Date().toISOString(),
        link: '/payments',
        read: false,
      });
    }
  } catch (err) {
    console.error('Notification build error:', err);
  }

  return notes
    .filter((notification) => notification.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 30);
}

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  const readIdsRef = useRef(
    new Set(JSON.parse(localStorage.getItem('vg_read_notifs') || '[]')),
  );

  const load = useCallback(async () => {
    const notes = await buildNotifications();
    setNotifications(notes.map((note) => ({
      ...note,
      read: readIdsRef.current.has(note.id) ? true : note.read,
    })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);

    if (!socket) {
      return () => clearInterval(interval);
    }

    const reload = () => load();
    socket.on('booking:status_updated', reload);
    socket.on('booking:created', reload);
    socket.on('booking:driver_assigned', reload);

    return () => {
      clearInterval(interval);
      socket.off('booking:status_updated', reload);
      socket.off('booking:created', reload);
      socket.off('booking:driver_assigned', reload);
    };
  }, [load, socket]);

  const markRead = useCallback((id) => {
    readIdsRef.current.add(id);
    localStorage.setItem('vg_read_notifs', JSON.stringify([...readIdsRef.current]));
    setNotifications((current) => current.map((note) => (
      note.id === id ? { ...note, read: true } : note
    )));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) => {
      const updated = current.map((note) => {
        readIdsRef.current.add(note.id);
        return { ...note, read: true };
      });
      localStorage.setItem('vg_read_notifs', JSON.stringify([...readIdsRef.current]));
      return updated;
    });
  }, []);

  const unreadCount = notifications.filter((note) => !note.read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, reload: load };
}

export default function NotificationPanel({
  onClose = () => {},
  notifications,
  loading,
  unreadCount = 0,
  markRead,
  markAllRead,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Notifications</div>
          <div style={styles.subtle}>
            {unreadCount > 0 ? `${unreadCount} unread updates` : 'All caught up'}
          </div>
        </div>

        <div style={styles.headerActions}>
          {unreadCount > 0 && (
            <button type="button" style={styles.actionBtn} onClick={markAllRead}>
              Mark all read
            </button>
          )}
          <button type="button" style={styles.actionBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={styles.emptyState}>No notifications</div>
        ) : (
          notifications.map((notification) => {
            const cfg = N_CFG[notification.type] || N_CFG.system;
            return (
              <div
                key={notification.id}
                style={{
                  ...styles.row,
                  background: notification.read ? 'transparent' : 'rgba(232,160,32,0.06)',
                }}
                onClick={() => {
                  markRead(notification.id);
                  onClose();
                  if (notification.link) window.location.href = notification.link;
                }}
              >
                <div style={{ ...styles.icon, background: cfg.bg, color: cfg.color }}>
                  {cfg.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ ...styles.rowTitle, fontWeight: notification.read ? 600 : 800 }}>
                    {notification.title}
                  </div>
                  {notification.body && <div style={styles.rowBody}>{notification.body}</div>}
                  <div style={styles.rowTime}>{timeAgo(notification.time)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={styles.footer}>
        <button
          type="button"
          style={{ ...styles.actionBtn, width: '100%' }}
          onClick={() => {
            onClose();
            window.location.href = '/notifications';
          }}
        >
          Open Notification Center
        </button>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    position: 'absolute',
    top: 54,
    right: 0,
    width: 360,
    background: '#111621',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    zIndex: 30,
  },
  header: {
    padding: 14,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontWeight: 700,
    color: '#e8eaf2',
  },
  subtle: {
    fontSize: 12,
    color: '#8892a4',
    marginTop: 2,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  actionBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#181e2d',
    color: '#e8eaf2',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  body: {
    maxHeight: 400,
    overflowY: 'auto',
  },
  emptyState: {
    padding: 20,
    color: '#8892a4',
  },
  row: {
    padding: 12,
    display: 'flex',
    gap: 10,
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 800,
  },
  rowTitle: {
    color: '#e8eaf2',
    fontSize: 13,
  },
  rowBody: {
    fontSize: 12,
    color: '#8892a4',
    marginTop: 3,
    lineHeight: 1.5,
  },
  rowTime: {
    fontSize: 11,
    color: '#545f73',
    marginTop: 6,
  },
  footer: {
    padding: 12,
    borderTop: '1px solid rgba(255,255,255,0.07)',
    background: '#0f121c',
  },
};
