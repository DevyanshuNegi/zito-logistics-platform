// src/pages/profile.jsx
import { useEffect, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

export default function Profile() {
  const [prefs, setPrefs] = useState({ email: true, sms: true, in_app: true });
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const loadPrefs = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/api/v1/profile/notifications');
      const data = res.data?.data || res.data || {};
      setPrefs({
        email: !!data.email,
        sms: !!data.sms,
        in_app: !!data.in_app,
      });
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/api/v1/profile/notifications', {
        email: prefs.email,
        sms: prefs.sms,
        in_app: prefs.in_app,
      });
      setMessage('Preferences updated.');
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async () => {
    if (!photoUrl) {
      setMessage('Enter a photo URL first.');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      await api.post('/api/v1/profile/photo', { photo_url: photoUrl });
      setMessage('Photo updated.');
      setPhotoUrl('');
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadPrefs();
  }, []);

  return (
    <Layout title="Profile & Preferences">
      {message && <div style={s.banner}>{message}</div>}

      <div style={s.card}>
        <h3 style={s.h3}>Notification Preferences</h3>
        {loading ? (
          <div style={s.muted}>Loading...</div>
        ) : (
          <div style={s.stack}>
            <label style={s.row}>
              <input
                type="checkbox"
                checked={prefs.email}
                onChange={(e) => setPrefs((p) => ({ ...p, email: e.target.checked }))}
              />
              <span style={s.label}>Email alerts</span>
            </label>
            <label style={s.row}>
              <input
                type="checkbox"
                checked={prefs.sms}
                onChange={(e) => setPrefs((p) => ({ ...p, sms: e.target.checked }))}
              />
              <span style={s.label}>SMS alerts</span>
            </label>
            <label style={s.row}>
              <input
                type="checkbox"
                checked={prefs.in_app}
                onChange={(e) => setPrefs((p) => ({ ...p, in_app: e.target.checked }))}
              />
              <span style={s.label}>In-app notifications</span>
            </label>
            <button style={s.primaryBtn} onClick={savePrefs} disabled={saving}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        )}
      </div>

      <div style={s.card}>
        <h3 style={s.h3}>Profile Photo</h3>
        <div style={s.row}>
          <input
            style={s.input}
            placeholder="https://example.com/photo.jpg"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
          <button style={s.secondaryBtn} onClick={uploadPhoto} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </Layout>
  );
}

const s = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  h3: { margin: '0 0 10px', color: '#e8eaf2' },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  stack: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { color: '#e8eaf2' },
  primaryBtn: {
    background: '#e8a020',
    border: 'none',
    color: '#111',
    padding: '9px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    width: 'fit-content',
  },
  secondaryBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf2',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  input: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#e8eaf2',
    padding: '8px 10px',
    minWidth: 260,
  },
  muted: { color: '#94a3b8' },
  banner: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    background: 'rgba(14,165,233,0.1)',
    border: '1px solid rgba(14,165,233,0.3)',
    color: '#bae6fd',
  },
};
