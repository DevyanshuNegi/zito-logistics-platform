import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useNotifications } from '../components/notifications';

const TYPE_LABELS = {
  trip_assigned: 'Assignments',
  trip_started: 'Live Trips',
  trip_completed: 'Completed Trips',
  trip_cancelled: 'Cancelled Trips',
  payment_received: 'Payments',
  payment_due: 'Finance',
  verification: 'Verification',
  system: 'System',
};

const TYPE_COLORS = {
  trip_assigned: '#6366f1',
  trip_started: '#2dd4bf',
  trip_completed: '#22c55e',
  trip_cancelled: '#ef4444',
  payment_received: '#22c55e',
  payment_due: '#f59e0b',
  verification: '#e8a020',
  system: '#0ea5e9',
};

const formatTime = (value) => (
  value
    ? new Date(value).toLocaleString('en-KE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
);

export default function NotificationsCenter() {
  const navigate = useNavigate();
  const { notifications, loading, unreadCount, markRead, markAllRead, reload } = useNotifications();
  const [prefs, setPrefs] = useState({ email: true, sms: false, in_app: true });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const response = await api.get('/api/v1/profile/notifications');
        setPrefs(response.data?.data || { email: true, sms: false, in_app: true });
      } catch (err) {
        console.warn('Notification preferences unavailable', err);
      }
    };

    loadPrefs();
  }, []);

  const visibleNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((note) => !note.read);
    if (filter === 'action') {
      return notifications.filter((note) => ['payment_due', 'verification', 'trip_assigned'].includes(note.type));
    }
    return notifications.filter((note) => note.type === filter);
  }, [filter, notifications]);

  const groupedCounts = useMemo(() => notifications.reduce((acc, note) => {
    const key = note.type || 'system';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [notifications]);

  const actionQueue = useMemo(() => notifications.filter((note) => (
    ['payment_due', 'verification', 'trip_assigned'].includes(note.type)
  )), [notifications]);

  const togglePreference = async (key) => {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);
    setSavingPrefs(true);
    setError('');

    try {
      await api.patch('/api/v1/profile/notifications', nextPrefs);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not save notification preferences');
      setPrefs(prefs);
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <Layout title="Notifications">
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Notification Center</div>
          <div style={styles.subTitle}>
            Live in-app updates for assignments, finance, verification, and operational events.
          </div>
        </div>

        <div style={styles.headerActions}>
          <button type="button" style={styles.secondaryBtn} onClick={reload}>
            Refresh Feed
          </button>
          <button type="button" style={styles.primaryBtn} onClick={markAllRead}>
            Mark All Read
          </button>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        {[
          { label: 'Unread', value: unreadCount, color: '#e8a020' },
          { label: 'Action Required', value: actionQueue.length, color: '#ef4444' },
          { label: 'Total Feed', value: notifications.length, color: '#22c55e' },
          { label: 'Channels Enabled', value: Object.values(prefs).filter(Boolean).length, color: '#6366f1' },
        ].map((card) => (
          <div key={card.label} style={styles.summaryCard}>
            <div style={{ ...styles.summaryValue, color: card.color }}>{card.value}</div>
            <div style={styles.summaryLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Action Queue</div>
            {actionQueue.length === 0 ? (
              <div style={styles.emptyState}>No urgent actions right now.</div>
            ) : (
              actionQueue.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  style={styles.queueCard}
                  onClick={() => {
                    markRead(note.id);
                    if (note.link) navigate(note.link);
                  }}
                >
                  <div style={styles.queueTop}>
                    <span style={{ ...styles.queueType, color: TYPE_COLORS[note.type] || '#8892a4' }}>
                      {TYPE_LABELS[note.type] || 'System'}
                    </span>
                    <span style={styles.queueTime}>{formatTime(note.time)}</span>
                  </div>
                  <div style={styles.queueTitle}>{note.title}</div>
                  {note.body && <div style={styles.queueBody}>{note.body}</div>}
                </button>
              ))
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.panelTitle}>Delivery Channels</div>
            {error && <div style={styles.errorBox}>{error}</div>}
            {[
              { key: 'in_app', label: 'In-app activity feed', hint: 'Visible in the drawer and this page.' },
              { key: 'email', label: 'Email updates', hint: 'Useful for approvals, invoices, and escalations.' },
              { key: 'sms', label: 'SMS updates', hint: 'Best for urgent delivery and verification alerts.' },
            ].map((channel) => (
              <div key={channel.key} style={styles.preferenceRow}>
                <div>
                  <div style={styles.preferenceLabel}>{channel.label}</div>
                  <div style={styles.preferenceHint}>{channel.hint}</div>
                </div>
                <button
                  type="button"
                  style={{
                    ...styles.toggleBtn,
                    background: prefs[channel.key] ? '#e8a020' : '#181e2d',
                    color: prefs[channel.key] ? '#0f121c' : '#e8eaf2',
                    opacity: savingPrefs ? 0.7 : 1,
                  }}
                  onClick={() => togglePreference(channel.key)}
                  disabled={savingPrefs}
                >
                  {prefs[channel.key] ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.feedHeader}>
            <div>
              <div style={styles.panelTitle}>Full Feed</div>
              <div style={styles.feedSubTitle}>Auto-refreshes from socket events and periodic polling.</div>
            </div>
            <select style={styles.filterSelect} value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All notifications</option>
              <option value="unread">Unread only</option>
              <option value="action">Action required</option>
              {Object.keys(TYPE_LABELS).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.feedTagRow}>
            {Object.entries(groupedCounts).map(([type, count]) => (
              <span key={type} style={{ ...styles.feedTag, borderColor: `${TYPE_COLORS[type] || '#8892a4'}55` }}>
                {TYPE_LABELS[type] || type} {count}
              </span>
            ))}
          </div>

          <div style={styles.feedList}>
            {loading ? (
              <div style={styles.emptyState}>Loading notifications...</div>
            ) : visibleNotifications.length === 0 ? (
              <div style={styles.emptyState}>No notifications match the selected filter.</div>
            ) : (
              visibleNotifications.map((note) => (
                <div
                  key={note.id}
                  style={{
                    ...styles.feedRow,
                    background: note.read ? '#181e2d' : 'rgba(232,160,32,0.08)',
                  }}
                >
                  <div
                    style={{
                      ...styles.feedAccent,
                      background: TYPE_COLORS[note.type] || '#8892a4',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={styles.feedRowTop}>
                      <div>
                        <div style={styles.feedTitle}>{note.title}</div>
                        <div style={styles.feedMeta}>
                          {TYPE_LABELS[note.type] || 'System'} · {formatTime(note.time)}
                        </div>
                      </div>
                      {!note.read && <span style={styles.unreadPill}>Unread</span>}
                    </div>
                    {note.body && <div style={styles.feedBody}>{note.body}</div>}
                    <div style={styles.feedActions}>
                      {!note.read && (
                        <button type="button" style={styles.linkBtn} onClick={() => markRead(note.id)}>
                          Mark read
                        </button>
                      )}
                      {note.link && (
                        <button type="button" style={styles.linkBtn} onClick={() => navigate(note.link)}>
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
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
    maxWidth: 680,
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 18,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 800,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#8892a4',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 16,
  },
  leftColumn: {
    display: 'grid',
    gap: 16,
  },
  panel: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: 18,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#e8eaf2',
    marginBottom: 12,
  },
  queueCard: {
    width: '100%',
    border: '1px solid rgba(255,255,255,0.06)',
    background: '#181e2d',
    borderRadius: 12,
    padding: 14,
    textAlign: 'left',
    marginBottom: 10,
    cursor: 'pointer',
  },
  queueTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  queueType: {
    fontSize: 11,
    fontWeight: 700,
  },
  queueTime: {
    fontSize: 11,
    color: '#545f73',
  },
  queueTitle: {
    marginTop: 10,
    color: '#e8eaf2',
    fontWeight: 700,
    fontSize: 14,
  },
  queueBody: {
    marginTop: 6,
    fontSize: 12,
    color: '#8892a4',
    lineHeight: 1.5,
  },
  preferenceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '12px 0',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  preferenceLabel: {
    color: '#e8eaf2',
    fontWeight: 600,
    fontSize: 13,
  },
  preferenceHint: {
    marginTop: 4,
    color: '#8892a4',
    fontSize: 12,
    lineHeight: 1.5,
  },
  toggleBtn: {
    minWidth: 64,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '8px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: 12,
    padding: '10px 12px',
    marginBottom: 10,
  },
  feedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  feedSubTitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#8892a4',
  },
  filterSelect: {
    minWidth: 190,
    padding: '10px 12px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
  },
  feedTagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  feedTag: {
    borderRadius: 999,
    padding: '5px 10px',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#cbd5e1',
    fontSize: 11,
  },
  feedList: {
    marginTop: 16,
    display: 'grid',
    gap: 10,
  },
  feedRow: {
    display: 'flex',
    gap: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  feedAccent: {
    width: 4,
    borderRadius: 999,
  },
  feedRowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  feedTitle: {
    color: '#e8eaf2',
    fontWeight: 700,
    fontSize: 14,
  },
  feedMeta: {
    marginTop: 4,
    color: '#8892a4',
    fontSize: 12,
  },
  unreadPill: {
    background: 'rgba(232,160,32,0.16)',
    color: '#e8a020',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    height: 'fit-content',
  },
  feedBody: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 1.6,
  },
  feedActions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  linkBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#181e2d',
    color: '#e8eaf2',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  emptyState: {
    color: '#8892a4',
    fontSize: 13,
    padding: '10px 0',
  },
};
