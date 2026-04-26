import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const CATEGORY_STYLES = {
  BOOKING: { color: '#e8a020', bg: 'rgba(232,160,32,0.14)' },
  PAYMENT: { color: '#22c55e', bg: 'rgba(34,197,94,0.14)' },
  DRIVER:  { color: '#6366f1', bg: 'rgba(99,102,241,0.14)' },
  SYSTEM:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.14)' },
  USER:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
};

const extractCategory = (action = '') => {
  const prefix = String(action).split('_')[0] || 'SYSTEM';
  return CATEGORY_STYLES[prefix] ? prefix : 'SYSTEM';
};

const formatDateTime = (value) => (
  value
    ? new Date(value).toLocaleString('en-KE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
);

const formatDetails = (details) => {
  if (!details || typeof details !== 'object') return '-';
  return Object.entries(details)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ');
};

const toCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/api/v1/admin/users?limit=200');
        setUsers(response.data?.data || []);
      } catch (err) {
        console.warn('Could not load admin user list for audit filter', err);
      }
    };

    loadUsers();
  }, []);

  useEffect(() => {
    const loadAuditLogs = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/api/v1/admin/audit-logs', {
          params: {
            page,
            limit: 25,
            action: actionFilter || undefined,
            user_id: userFilter || undefined,
          },
        });

        setLogs(response.data?.data || []);
        setMeta(response.data?.meta || {});
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Could not load audit log');
        setLogs([]);
        setMeta({});
      } finally {
        setLoading(false);
      }
    };

    loadAuditLogs();
  }, [page, actionFilter, userFilter]);

  const visibleLogs = useMemo(() => {
    const query = localSearch.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((log) => {
      const haystack = [
        log.action,
        log.user?.full_name,
        log.user?.email,
        log.acting_as,
        log.resource_type,
        formatDetails(log.details),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, localSearch]);

  const summary = useMemo(() => {
    const currentWindow = visibleLogs;
    return {
      total: currentWindow.length,
      booking: currentWindow.filter((log) => extractCategory(log.action) === 'BOOKING').length,
      payment: currentWindow.filter((log) => extractCategory(log.action) === 'PAYMENT').length,
      security: currentWindow.filter((log) => ['USER', 'SYSTEM'].includes(extractCategory(log.action))).length,
    };
  }, [visibleLogs]);

  const exportCsv = () => {
    const header = ['time', 'action', 'actor', 'role', 'resource', 'details'];
    const rows = visibleLogs.map((log) => [
      formatDateTime(log.created_at),
      log.action,
      log.user?.full_name || '-',
      log.acting_as || '-',
      [log.resource_type, log.resource_id].filter(Boolean).join(':'),
      formatDetails(log.details),
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.map(toCsvValue).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Audit Log">
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Audit Log</div>
          <div style={styles.subTitle}>
            Immutable admin activity feed for bookings, payments, user changes, and system overrides.
          </div>
        </div>

        <button type="button" style={styles.primaryBtn} onClick={exportCsv}>
          Export Current View
        </button>
      </div>

      <div style={styles.summaryGrid}>
        {[
          { label: 'Visible Events', value: summary.total, color: '#e8a020' },
          { label: 'Booking Actions', value: summary.booking, color: '#6366f1' },
          { label: 'Payment Actions', value: summary.payment, color: '#22c55e' },
          { label: 'Security & System', value: summary.security, color: '#0ea5e9' },
        ].map((card) => (
          <div key={card.label} style={styles.summaryCard}>
            <div style={{ ...styles.summaryValue, color: card.color }}>{card.value}</div>
            <div style={styles.summaryLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.panel}>
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Filter by action code..."
            value={actionFilter}
            onChange={(event) => {
              setPage(1);
              setActionFilter(event.target.value);
            }}
          />

          <select
            style={styles.input}
            value={userFilter}
            onChange={(event) => {
              setPage(1);
              setUserFilter(event.target.value);
            }}
          >
            <option value="">All actors</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>

          <input
            style={styles.input}
            placeholder="Search current page..."
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
          />
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.timeline}>
          {visibleLogs.slice(0, 4).map((log) => {
            const category = extractCategory(log.action);
            const categoryStyle = CATEGORY_STYLES[category];
            return (
              <div key={log.id} style={styles.timelineCard}>
                <div style={styles.timelineTop}>
                  <span style={{ ...styles.badge, color: categoryStyle.color, background: categoryStyle.bg }}>
                    {category}
                  </span>
                  <span style={styles.timeText}>{formatDateTime(log.created_at)}</span>
                </div>
                <div style={styles.timelineAction}>{log.action}</div>
                <div style={styles.timelineBody}>{formatDetails(log.details)}</div>
                <div style={styles.timelineMeta}>
                  {log.user?.full_name || 'System actor'} {log.acting_as ? `· ${log.acting_as}` : ''}
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Actor</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Resource</th>
                <th style={styles.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={styles.emptyCell}>Loading audit events...</td>
                </tr>
              ) : visibleLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyCell}>No audit events match the current filters.</td>
                </tr>
              ) : (
                visibleLogs.map((log) => {
                  const category = extractCategory(log.action);
                  const categoryStyle = CATEGORY_STYLES[category];
                  return (
                    <tr key={log.id} style={styles.row}>
                      <td style={styles.td}>{formatDateTime(log.created_at)}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, color: categoryStyle.color, background: categoryStyle.bg }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={styles.td}>{log.user?.full_name || '-'}</td>
                      <td style={{ ...styles.td, textTransform: 'capitalize' }}>{log.acting_as || '-'}</td>
                      <td style={styles.td}>
                        {[log.resource_type, log.resource_id].filter(Boolean).join(':') || '-'}
                      </td>
                      <td style={styles.detailsCell}>{formatDetails(log.details)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.pagination}>
          <button
            type="button"
            style={styles.secondaryBtn}
            disabled={!meta.has_prev}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <div style={styles.pageLabel}>
            Page {meta.page || page} of {meta.total_pages || 1}
          </div>
          <button
            type="button"
            style={styles.secondaryBtn}
            disabled={!meta.has_next}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
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
  primaryBtn: {
    border: 'none',
    background: '#e8a020',
    color: '#0f121c',
    borderRadius: 10,
    padding: '11px 16px',
    fontWeight: 700,
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
  panel: {
    background: '#111621',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    padding: 16,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    borderRadius: 10,
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#e8eaf2',
  },
  errorBox: {
    margin: '0 16px 16px',
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    color: '#ef4444',
    borderRadius: 12,
    padding: '10px 12px',
  },
  timeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    padding: '0 16px 16px',
  },
  timelineCard: {
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
  },
  timelineTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  timelineAction: {
    marginTop: 12,
    fontWeight: 700,
    color: '#e8eaf2',
    fontSize: 14,
  },
  timelineBody: {
    marginTop: 8,
    fontSize: 12,
    color: '#8892a4',
    lineHeight: 1.6,
  },
  timelineMeta: {
    marginTop: 10,
    fontSize: 11,
    color: '#545f73',
  },
  timeText: {
    fontSize: 11,
    color: '#545f73',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 11,
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: 'auto',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#545f73',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  row: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '12px 16px',
    fontSize: 12,
    color: '#e8eaf2',
    verticalAlign: 'top',
  },
  detailsCell: {
    padding: '12px 16px',
    fontSize: 12,
    color: '#8892a4',
    maxWidth: 340,
    lineHeight: 1.5,
  },
  emptyCell: {
    padding: 40,
    textAlign: 'center',
    color: '#8892a4',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  secondaryBtn: {
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#181e2d',
    color: '#e8eaf2',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  pageLabel: {
    fontSize: 12,
    color: '#8892a4',
  },
};
