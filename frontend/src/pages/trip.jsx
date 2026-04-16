import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import MapView from '../components/mapview';
import api from '../api/axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function Trip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [offers, setOffers] = useState([]);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMsg, setOfferMsg] = useState('');
  const [offerLoading, setOfferLoading] = useState(false);
  const [podUrl, setPodUrl] = useState('');
  const [podMsg, setPodMsg] = useState('');
  const [podSaving, setPodSaving] = useState(false);

  const loadBooking = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/v1/bookings/${id}`);
      setB(res.data.data || res.data.booking || null);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load booking');
      setB(null);
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async () => {
    try {
      const res = await api.get(`/api/v1/bookings/${id}/offers`);
      const data = res.data?.data || res.data;
      setOffers(data?.offers || []);
    } catch {
      setOffers([]);
    }
  };

  useEffect(() => {
    if (id) {
      loadBooking();
      loadOffers();
    }
  }, [id]);

  const updateStatus = async (newStatus) => {
    try {
      setUpdating(true);
      setError('');
      await api.patch(`/api/v1/bookings/${id}/status`, { status: newStatus });
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update trip status');
    } finally {
      setUpdating(false);
    }
  };

  const driverAccept = async () => {
    try {
      setUpdating(true);
      setError('');
      await api.post(`/api/v1/bookings/${id}/driver-accept`);
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to accept booking');
    } finally {
      setUpdating(false);
    }
  };

  const driverReject = async () => {
    if (!window.confirm('Reject this trip assignment?')) return;
    try {
      setUpdating(true);
      setError('');
      await api.post(`/api/v1/bookings/${id}/driver-reject`);
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reject booking');
    } finally {
      setUpdating(false);
    }
  };

  const markDelivered = () => updateStatus('delivered');
  const markPickedUp = () => updateStatus('picked_up');
  const markInTransit = () => updateStatus('in_transit');
  const markCompleted = () => {
    if (!window.confirm('Mark trip complete?')) return;
    updateStatus('completed');
  };

  const uploadPod = async () => {
    if (!podUrl) { setError('Enter POD photo URL'); return; }
    setPodSaving(true);
    setError('');
    try {
      await api.post(`/api/v1/bookings/${id}/pod`, { pod_photo_url: podUrl });
      setPodMsg('POD uploaded');
      setPodUrl('');
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload POD');
    } finally {
      setPodSaving(false);
    }
  };

  const submitOffer = async (e) => {
    e.preventDefault();
    if (!offerPrice) { setError('Price is required'); return; }
    setOfferLoading(true);
    setError('');
    try {
      await api.post(`/api/v1/bookings/${id}/offers`, {
        price: Number(offerPrice),
        message: offerMsg || undefined,
      });
      setOfferPrice('');
      setOfferMsg('');
      await loadOffers();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to submit offer');
    } finally {
      setOfferLoading(false);
    }
  };

  const respondOffer = async (offerId, action) => {
    setOfferLoading(true);
    setError('');
    try {
      await api.patch(`/api/v1/bookings/${id}/offers/${offerId}`, { status: action });
      await Promise.all([loadOffers(), loadBooking()]);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to update offer');
    } finally {
      setOfferLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Trip Details">
        <div style={{ padding: 20, color: '#fff' }}>Loading booking...</div>
      </Layout>
    );
  }

  const openNavigation = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.pickup_address)}`;
    window.open(url, '_blank');
  };

  const callCustomer = () => {
    alert('Call feature coming soon');
  };

  return (
    <Layout title="Trip Details">

      <div style={{ padding: 20 }}>

        <h2 style={{ color: '#fff' }}>Trip #{b.reference}</h2>

        <MapView
          pickup={b.pickup_address}
          delivery={b.delivery_address}
        />

        <div style={{ marginTop: 20, color: '#fff' }}>
          <p><b>Pickup:</b> {b.pickup_address}</p>
          <p><b>Delivery:</b> {b.delivery_address}</p>
          <p><b>Fare:</b> KES {b.final_fare || b.estimated_fare || b.customer_rate}</p>
          <p><b>Status:</b> <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#e8a020' }}>{b.status?.replace('_', ' ')}</span></p>
        </div>

        {/* OFFERS / BIDDING */}
        <div style={{ marginTop: 18, padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
          <h3 style={{ color: '#fff', marginBottom: 8 }}>Offers & Bids</h3>
          {offers.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>No offers yet.</div>
          )}
          {offers.map((o) => (
            <div key={o.id} style={{ padding: 10, marginBottom: 8, borderRadius: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                <div>
                  <strong>KES {Number(o.price).toLocaleString()}</strong>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{o.role}</div>
                </div>
                <div style={{ fontSize: 12, textTransform: 'capitalize', color: o.status === 'accepted' ? '#22c55e' : o.status === 'rejected' ? '#ef4444' : '#eab308' }}>
                  {o.status}
                </div>
              </div>
              {o.message && <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>{o.message}</div>}
              {o.estimated_arrival_mins && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>ETA: {o.estimated_arrival_mins} mins</div>}

              {(user?.role === 'super_admin' || user?.role === 'operations_admin') && o.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#22c55e', color: '#0f172a', cursor: offerLoading ? 'not-allowed' : 'pointer', opacity: offerLoading ? 0.6 : 1 }}
                    disabled={offerLoading}
                    onClick={() => respondOffer(o.id, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#e2e8f0', cursor: offerLoading ? 'not-allowed' : 'pointer', opacity: offerLoading ? 0.6 : 1 }}
                    disabled={offerLoading}
                    onClick={() => respondOffer(o.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}

          {(user?.role === 'driver' || user?.role === 'transporter' || user?.role === 'agent') && (
            <form onSubmit={submitOffer} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="Your offer (KES)"
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#e2e8f0' }}
                  required
                />
              </div>
              <textarea
                value={offerMsg}
                onChange={(e) => setOfferMsg(e.target.value)}
                placeholder="Message (optional)"
                rows={2}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#e2e8f0', resize: 'vertical' }}
              />
              <button
                type="submit"
                style={{ marginTop: 8, width: '100%', padding: 11, border: 'none', borderRadius: 8, background: '#eab308', color: '#0f172a', fontWeight: 700, cursor: offerLoading ? 'not-allowed' : 'pointer', opacity: offerLoading ? 0.7 : 1 }}
                disabled={offerLoading}
              >
                {offerLoading ? 'Submitting...' : 'Submit Offer'}
              </button>
            </form>
          )}
        </div>

        {user?.role === 'driver' && (
          <div style={{ marginTop: 18, padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <h3 style={{ color: '#fff', marginBottom: 8 }}>Proof of Delivery</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={podUrl}
                onChange={(e) => setPodUrl(e.target.value)}
                placeholder="POD photo URL"
                style={{ flex: 1, minWidth: 260, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a', color: '#e2e8f0' }}
              />
              <button
                type="button"
                onClick={uploadPod}
                disabled={podSaving}
                style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#0b1224', fontWeight: 700, cursor: podSaving ? 'not-allowed' : 'pointer', opacity: podSaving ? 0.7 : 1 }}
              >
                {podSaving ? 'Uploading...' : 'Upload POD'}
              </button>
            </div>
            {podMsg && <div style={{ color: '#a5f3fc', marginTop: 6 }}>{podMsg}</div>}
          </div>
         )}\n\n        {Array.isArray(b.status_history) && b.status_history.length > 0 && (
          <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
            <h4 style={{ color: '#fff', marginBottom: 8 }}>Status Timeline</h4>
            {b.status_history.map((entry, idx) => (
              <div key={idx} style={{ marginBottom: 6, fontSize: 13, color: '#e2e8f0' }}>
                <strong>{entry.from?.replace('_', ' ')} → {entry.to?.replace('_', ' ')}</strong>
                <div>{new Date(entry.at).toLocaleString()}</div>
                {entry.by && <div style={{ fontSize: 11, color: '#94a3b8' }}>by {entry.by}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ACTIONS */}
        <div style={{ marginTop: 20 }}>

          <button
            style={{
              width: '100%',
              padding: 12,
              background: '#22c55e',
              border: 'none',
              borderRadius: 8,
              marginBottom: 10,
              cursor: 'pointer',
              color: '#000',
              fontWeight: 600
            }}
            onClick={callCustomer}
          >
            📞 Call Customer
          </button>

          <button
            style={{
              width: '100%',
              padding: 12,
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              marginBottom: 10,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
            onClick={openNavigation}
          >
            🗺️ Open Navigation
          </button>

          {b.status === 'assigned' && (
            <>
              <button
                style={{
                  width: '100%',
                  padding: 14,
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: 8,
                  marginBottom: 10,
                  cursor: updating ? 'not-allowed' : 'pointer',
                  opacity: updating ? 0.6 : 1,
                  color: '#000',
                  fontWeight: 600
                }}
                onClick={driverAccept}
                disabled={updating}
              >
                {updating ? '⏳ Accepting...' : '✅ Accept Trip'}
              </button>

              <button
                style={{
                  width: '100%',
                  padding: 14,
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 8,
                  marginBottom: 10,
                  cursor: updating ? 'not-allowed' : 'pointer',
                  opacity: updating ? 0.6 : 1,
                  color: '#fff',
                  fontWeight: 600
                }}
                onClick={driverReject}
                disabled={updating}
              >
                {updating ? '⏳ Rejecting...' : '✕ Reject Trip'}
              </button>
            </>
          )}

          {b.status === 'accepted' && (
            <button
              style={{
                width: '100%',
                padding: 14,
                background: '#facc15',
                border: 'none',
                borderRadius: 8,
                marginBottom: 10,
                cursor: updating ? 'not-allowed' : 'pointer',
                opacity: updating ? 0.6 : 1,
                color: '#000',
                fontWeight: 600
              }}
              onClick={markPickedUp}
              disabled={updating}
            >
              {updating ? '⏳ Picking up...' : '📦 Mark Picked Up'}
            </button>
          )}

          {b.status === 'picked_up' && (
            <button
              style={{
                width: '100%',
                padding: 14,
                background: '#3b82f6',
                border: 'none',
                borderRadius: 8,
                marginBottom: 10,
                cursor: updating ? 'not-allowed' : 'pointer',
                opacity: updating ? 0.6 : 1,
                color: '#fff',
                fontWeight: 600
              }}
              onClick={markInTransit}
              disabled={updating}
            >
              {updating ? '⏳ Starting...' : '🚚 Start Transit'}
            </button>
          )}

          {b.status === 'in_transit' && (
            <button
              style={{
                width: '100%',
                padding: 14,
                background: '#10b981',
                border: 'none',
                borderRadius: 8,
                marginBottom: 10,
                cursor: updating ? 'not-allowed' : 'pointer',
                opacity: updating ? 0.6 : 1,
                color: '#fff',
                fontWeight: 600
              }}
              onClick={markDelivered}
              disabled={updating}
            >
              {updating ? '⏳ Delivering...' : '📍 Mark Delivered'}
            </button>
          )}

          {b.status === 'delivered' && (
            <button
              style={{
                width: '100%',
                padding: 14,
                background: '#2563eb',
                border: 'none',
                borderRadius: 8,
                marginBottom: 10,
                cursor: updating ? 'not-allowed' : 'pointer',
                opacity: updating ? 0.6 : 1,
                color: '#fff',
                fontWeight: 600
              }}
              onClick={markCompleted}
              disabled={updating}
            >
              {updating ? '⏳ Completing...' : '✅ Complete Trip'}
            </button>
          )}

          {b.status === 'completed' && (
            <button
              style={{
                width: '100%',
                padding: 14,
                background: '#6b7280',
                border: 'none',
                borderRadius: 8,
                marginBottom: 10,
                color: '#fff',
                fontWeight: 600,
                cursor: 'default'
              }}
              disabled
            >
              ✓ Trip Completed
            </button>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 10,
              fontSize: 13
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={() => navigate(`/trip-charges?tripId=${b.id}`)}
            style={{
              width: '100%',
              padding: 12,
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#8b5cf6',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              marginBottom: 10
            }}
          >
            💰 Manage Charges
          </button>

        </div>

        <button
          style={{
            marginTop: 20,
            background: 'transparent',
            color: '#aaa'
          }}
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

      </div>

    </Layout>
  );
}



