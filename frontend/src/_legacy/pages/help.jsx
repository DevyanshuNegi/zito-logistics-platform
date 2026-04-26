import Layout from '../components/layout';
import { useState } from 'react';
import api from '../api/axios';

const helpOptions = [
  { label: 'Contact Driver', action: 'contact_driver', desc: 'Message/call driver directly' },
  { label: 'Cargo delayed', action: 'delay', desc: 'Notify admin; trigger delay flag' },
  { label: 'Driver not responding', action: 'driver_no_response', desc: 'Admin alerted; driver pinged' },
  { label: 'Wrong pickup/delivery', action: 'wrong_location', desc: 'Request live location correction' },
  { label: 'Cancel trip', action: 'cancel', desc: 'Open cancellation flow with policy' },
  { label: 'Report emergency / SOS', action: 'sos', desc: 'Escalate with GPS to admin' },
  { label: 'Other issue', action: 'other', desc: 'Open free-text support ticket' },
];

export default function Help() {
  const [bookingId, setBookingId] = useState('');
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const trigger = async (action) => {
    if (!bookingId) {
      setMessage('Enter a booking ID first.');
      return;
    }
    setBusyAction(action);
    setMessage('');
    try {
      if (action === 'sos') {
        await api.post('/api/v1/help/sos', { booking_id: bookingId });
        setMessage('SOS sent. Booking frozen pending admin intervention.');
      } else {
        await api.post('/api/v1/help', { action, booking_id: bookingId });
        setMessage(`Help request submitted: ${action}`);
      }
    } catch (err) {
      setMessage(err?.response?.data?.error?.message || 'Failed to submit help request.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <Layout title="Help & SOS">
      <div style={s.card}>
        <h2 style={s.h2}>On-Trip Help & SOS</h2>
        <p style={s.muted}>Quick actions mirrored from PRD §19 for customers and drivers.</p>
        <div style={s.inputWrap}>
          <input
            style={s.input}
            placeholder="Enter booking ID"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
          />
        </div>
        {message && <p style={s.status}>{message}</p>}
        <div style={s.grid}>
          {helpOptions.map((o) => (
            <button key={o.action} style={s.option} onClick={() => trigger(o.action)} disabled={busyAction === o.action}>
              <div style={s.label}>{o.label}</div>
              <div style={s.desc}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}

const s = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 18,
  },
  h2: { margin: '0 0 6px', fontSize: 20, fontWeight: 800 },
  muted: { color: '#94a3b8', marginBottom: 14 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))',
    gap: 12,
  },
  inputWrap: {
    marginBottom: 12,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '8px 10px',
  },
  status: {
    marginBottom: 10,
    color: '#cbd5e1',
  },
  option: {
    textAlign: 'left',
    padding: 12,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    color: '#e2e8f0',
    cursor: 'pointer',
  },
  label: { fontWeight: 700, marginBottom: 4 },
  desc: { fontSize: 13, color: '#cbd5e1' },
};
