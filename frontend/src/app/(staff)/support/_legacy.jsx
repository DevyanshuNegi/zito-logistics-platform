import { useEffect, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const categories = [
  'cargo_issue',
  'driver_behaviour',
  'vehicle_issue',
  'billing_dispute',
  'platform_issue',
  'other',
];

const statusColors = {
  submitted:   '#f59e0b',
  under_review:'#3b82f6',
  awaiting_response: '#a855f7',
  resolved:    '#22c55e',
  closed:      '#94a3b8',
};

export default function Complaints() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('cargo_issue');
  const [description, setDescription] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComplaints = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/v1/complaints');
      const data = res.data?.data || res.data?.complaints || res.data || [];
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      // Graceful fallback if backend not ready
      setList([]);
      setError(err.response?.data?.error?.message || 'Could not load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadComplaints(); }, []);

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (!description.trim()) { setError('Description is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/complaints', {
        category,
        description,
        booking_id: bookingId || undefined,
      });
      setDescription('');
      setBookingId('');
      await loadComplaints();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout title="Complaints & Issues">
      <div style={s.container}>
        <div style={s.card}>
          <h2 style={s.h2}>File a Complaint</h2>
          <p style={s.muted}>Log operational issues so Ops can triage per PRD §18.2.</p>

          {error && <div style={s.error}>{error}</div>}

          <form onSubmit={submitComplaint}>
            <label style={s.label}>Category</label>
            <select style={s.input} value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>

            <label style={s.label}>Related Booking ID (optional)</label>
            <input
              style={s.input}
              value={bookingId}
              onChange={e => setBookingId(e.target.value)}
              placeholder="Booking UUID"
            />

            <label style={s.label}>Description</label>
            <textarea
              style={{ ...s.input, minHeight: 100 }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue, time, and impact"
              required
            />

            <button style={s.primary} type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Complaint'}
            </button>
          </form>
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Complaint Queue</h2>
          {loading && <div style={s.muted}>Loading…</div>}
          {!loading && list.length === 0 && (
            <div style={s.muted}>No complaints yet.</div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((c) => (
              <div key={c.id} style={s.item}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700 }}>{c.category?.replace('_',' ')}</div>
                  <div style={{ color: statusColors[c.status] || '#eab308', fontWeight: 700 }}>
                    {c.status || 'submitted'}
                  </div>
                </div>
                <div style={s.mutedSmall}>{c.booking_id && `Booking: ${c.booking_id}`}</div>
                <div style={s.desc}>{c.description}</div>
                <div style={s.mutedSmall}>
                  {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const s = {
  container: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
  },
  h2: { margin: '0 0 6px', fontSize: 18, fontWeight: 800 },
  muted: { color: '#94a3b8', fontSize: 13, marginBottom: 10 },
  mutedSmall: { color: '#94a3b8', fontSize: 12 },
  label: { display: 'block', marginTop: 10, marginBottom: 6, color: '#cbd5e1', fontSize: 13 },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#0f172a',
    color: '#e2e8f0',
    boxSizing: 'border-box',
  },
  primary: {
    marginTop: 14,
    width: '100%',
    padding: 12,
    border: 'none',
    borderRadius: 10,
    background: '#e8a020',
    color: '#0f121c',
    fontWeight: 800,
    cursor: 'pointer',
  },
  item: {
    padding: 12,
    borderRadius: 10,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
    color: '#e2e8f0',
  },
  desc: { marginTop: 6, marginBottom: 6, fontSize: 13, lineHeight: 1.4 },
  error: { marginBottom: 10, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: 10, borderRadius: 10 },
};
