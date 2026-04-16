import { useEffect, useState } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export default function Marketplace() {
  const { user } = useAuth();
  const role = user?.role;
  const [tab, setTab] = useState('open');
  const [loads, setLoads] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [offersByBooking, setOffersByBooking] = useState({});
  const [offerForm, setOfferForm] = useState({});
  const [message, setMessage] = useState('');
  const [interest, setInterest] = useState({ lat: '', lng: '', radius_km: 10, note: '' });
  const [interestMsg, setInterestMsg] = useState('');
  const [myOffers, setMyOffers] = useState([]);
  const [myMeta, setMyMeta] = useState({});
  const [myStatus, setMyStatus] = useState('');

  const fetchLoads = async (page = 1) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/api/v1/driver/open-loads', { params: { page } });
      setLoads(res.data?.data || res.data || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to load marketplace loads');
    } finally {
      setLoading(false);
    }
  };

  const fetchOffers = async (bookingId) => {
    try {
      const res = await api.get(`/api/v1/booking/${bookingId}/offers`);
      setOffersByBooking((prev) => ({ ...prev, [bookingId]: res.data?.data?.offers || res.data?.offers || [] }));
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to load offers');
    }
  };

  const submitOffer = async (bookingId) => {
    const form = offerForm[bookingId] || {};
    if (!form.price) {
      setMessage('Enter a price before submitting.');
      return;
    }
    try {
      await api.post(`/api/v1/booking/${bookingId}/offers`, {
        price: Number(form.price),
        message: form.message || '',
        vehicle_id: form.vehicle_id || undefined,
        driver_id: form.driver_id || undefined,
      });
      setMessage('Offer submitted.');
      setOfferForm((prev) => ({ ...prev, [bookingId]: {} }));
      fetchOffers(bookingId);
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to submit offer');
    }
  };

  const respondOffer = async (bookingId, offerId, status) => {
    try {
      await api.patch(`/api/v1/booking/${bookingId}/offers/${offerId}`, { status });
      setMessage(`Offer ${status}.`);
      fetchOffers(bookingId);
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || `Failed to ${status} offer`);
    }
  };

  useEffect(() => {
    fetchLoads(1);
    loadInterest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'my') fetchMyOffers(1, myStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, myStatus]);

  const loadInterest = async () => {
    try {
      const res = await api.get('/api/v1/driver/location-interest');
      const li = res.data?.location_interest || res.data?.data?.location_interest;
      if (li) setInterest({ lat: li.lat || '', lng: li.lng || '', radius_km: li.radius_km || 10, note: li.note || '' });
    } catch (e) {
      // ignore missing interest
    }
  };

  const fetchMyOffers = async (page = 1, status = '') => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/api/v1/booking/offers/mine', { params: { page, status: status || undefined } });
      setMyOffers(res.data?.data || res.data || []);
      setMyMeta(res.data?.meta || {});
    } catch (e) {
      setMessage(e?.response?.data?.error?.message || 'Failed to load your bids');
    } finally {
      setLoading(false);
    }
  };

  const saveInterest = async () => {
    setInterestMsg('');
    if (!interest.lat || !interest.lng) { setInterestMsg('Enter latitude and longitude.'); return; }
    try {
      await api.post('/api/v1/driver/location-interest', {
        lat: Number(interest.lat),
        lng: Number(interest.lng),
        radius_km: Number(interest.radius_km) || 10,
        note: interest.note || '',
      });
      setInterestMsg('Saved your preferred route/location.');
    } catch (e) {
      setInterestMsg(e?.response?.data?.error?.message || 'Failed to save location interest');
    }
  };

  return (
    <Layout title="Marketplace">
      <div style={s.row}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ ...s.tabBtn, ...(tab === 'open' ? s.tabBtnActive : {}) }} onClick={() => setTab('open')}>Open Loads</button>
          <button style={{ ...s.tabBtn, ...(tab === 'my' ? s.tabBtnActive : {}) }} onClick={() => setTab('my')}>My Bids</button>
        </div>
        {tab === 'open' && (
          <div>
            <button style={s.secondaryBtn} onClick={() => fetchLoads(Math.max(1, (meta.page || 1) - 1))} disabled={loading || !meta.has_prev}>
              Prev
            </button>
            <button style={{ ...s.secondaryBtn, marginLeft: 8 }} onClick={() => fetchLoads((meta.page || 1) + 1)} disabled={loading || !meta.has_next}>
              Next
            </button>
          </div>
        )}
        {tab === 'my' && (
          <div>
            <select value={myStatus} onChange={e => setMyStatus(e.target.value)} style={s.select}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
            <button style={s.secondaryBtn} onClick={() => fetchMyOffers(Math.max(1, (myMeta.page || 1) - 1), myStatus)} disabled={loading || !myMeta.has_prev}>
              Prev
            </button>
            <button style={{ ...s.secondaryBtn, marginLeft: 8 }} onClick={() => fetchMyOffers((myMeta.page || 1) + 1, myStatus)} disabled={loading || !myMeta.has_next}>
              Next
            </button>
          </div>
        )}
      </div>

      {message && <div style={s.banner}>{message}</div>}
      {role === 'driver' && (
        <div style={s.card}>
          <div style={s.row}>
            <div>
              <div style={s.ref}>Location Interest</div>
              <div style={s.muted}>Helps surface loads on your preferred route.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input style={s.input} placeholder="Latitude" value={interest.lat} onChange={e => setInterest(i => ({ ...i, lat: e.target.value }))} />
            <input style={s.input} placeholder="Longitude" value={interest.lng} onChange={e => setInterest(i => ({ ...i, lng: e.target.value }))} />
            <input style={{ ...s.input, width: 120 }} type="number" placeholder="Radius km" value={interest.radius_km} onChange={e => setInterest(i => ({ ...i, radius_km: e.target.value }))} />
            <input style={{ ...s.input, minWidth: 220 }} placeholder="Note (route/road)" value={interest.note} onChange={e => setInterest(i => ({ ...i, note: e.target.value }))} />
            <button style={s.primaryBtn} onClick={saveInterest}>Save</button>
          </div>
          {interestMsg && <div style={{ ...s.muted, marginTop: 6 }}>{interestMsg}</div>}
        </div>
      )}

      {loading ? (
        <div style={s.muted}>Loading...</div>
      ) : tab === 'open' ? (
        <div style={s.list}>
          {loads.length === 0 && <div style={s.muted}>No open loads available.</div>}
          {loads.map((load) => (
            <div key={load.id} style={s.card}>
              <div style={s.row}>
                <div>
                  <div style={s.ref}>#{load.reference}</div>
                  <div style={s.kv}>{load.pickup_address} → {load.delivery_address}</div>
                  <div style={s.kv}>Vehicle: {load.vehicle_type || 'Any'}</div>
                  <div style={s.kv}>Customer Rate: KES {Number(load.customer_rate || 0).toLocaleString()}</div>
                </div>
                <button style={s.secondaryBtn} onClick={() => fetchOffers(load.id)}>
                  View Offers
                </button>
              </div>

              <div style={s.offerBox}>
                <div style={s.offerRow}>
                  <input
                    style={s.input}
                    type="number"
                    placeholder="Your price (KES)"
                    value={(offerForm[load.id]?.price) || ''}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, [load.id]: { ...prev[load.id], price: e.target.value } }))}
                  />
                  <input
                    style={s.input}
                    placeholder="Message (optional)"
                    value={(offerForm[load.id]?.message) || ''}
                    onChange={(e) => setOfferForm((prev) => ({ ...prev, [load.id]: { ...prev[load.id], message: e.target.value } }))}
                  />
                  <button style={s.primaryBtn} onClick={() => submitOffer(load.id)}>
                    Submit Offer
                  </button>
                </div>

                {offersByBooking[load.id] && offersByBooking[load.id].length > 0 && (
                  <div style={s.offersList}>
                    <div style={s.muted}>Offers</div>
                    {offersByBooking[load.id].map((o) => (
                      <div key={o.id} style={s.offerItem}>
                        <span>KES {Number(o.price || 0).toLocaleString()}</span>
                        <span style={s.badge}>{o.status}</span>
                        {o.message && <span style={s.muted}>{o.message}</span>}
                        {['super_admin','operations_admin','finance_admin'].includes(role) && o.status === 'pending' && (
                          <div style={s.actions}>
                            <button style={s.acceptBtn} onClick={() => respondOffer(load.id, o.id, 'accepted')}>Accept</button>
                            <button style={s.rejectBtn} onClick={() => respondOffer(load.id, o.id, 'rejected')}>Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={s.list}>
          {myOffers.length === 0 && <div style={s.muted}>No bids yet.</div>}
          {myOffers.map((o) => (
            <div key={o.id} style={s.card}>
              <div style={s.row}>
                <div>
                  <div style={s.ref}>Bid: KES {Number(o.price || 0).toLocaleString()}</div>
                  <div style={s.kv}>Status: <span style={s.badge}>{o.status}</span></div>
                  {o.message && <div style={s.kv}>{o.message}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={s.ref}>Load #{o.booking?.reference}</div>
                  <div style={s.kv}>{o.booking?.pickup_address} → {o.booking?.delivery_address}</div>
                  <div style={s.kv}>Vehicle: {o.booking?.vehicle_type || 'Any'}</div>
                  <div style={s.kv}>Customer Rate: KES {Number(o.booking?.customer_rate || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

const s = {
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  h2: { margin: 0, color: '#e8eaf2' },
  muted: { color: '#94a3b8' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
  },
  ref: { fontWeight: 800, color: '#e8eaf2' },
  kv: { color: '#cbd5e1', fontSize: 13 },
  offerBox: { marginTop: 10 },
  offerRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    color: '#e8eaf2',
    padding: '8px 10px',
    minWidth: 160,
  },
  primaryBtn: {
    background: '#e8a020',
    border: 'none',
    color: '#111',
    padding: '9px 14px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf2',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  offersList: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 },
  offerItem: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: '6px 8px',
    color: '#e8eaf2',
  },
  badge: {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  banner: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    background: 'rgba(14,165,233,0.1)',
    border: '1px solid rgba(14,165,233,0.3)',
    color: '#bae6fd',
  },
  actions: { display: 'flex', gap: 6, marginLeft: 'auto' },
  acceptBtn: {
    background: 'rgba(34,197,94,0.15)',
    color: '#22c55e',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
  },
  rejectBtn: {
    background: 'rgba(239,68,68,0.12)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
  },
  tabBtn: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: '#e8eaf2',
    cursor: 'pointer',
  },
  tabBtnActive: {
    background: '#e8a020',
    color: '#0b0e16',
    borderColor: 'rgba(232,160,32,0.6)',
    fontWeight: 700,
  },
  select: {
    background: '#181e2d',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#e8eaf2',
    borderRadius: 8,
    padding: '8px 10px',
    marginRight: 8,
  },
};
