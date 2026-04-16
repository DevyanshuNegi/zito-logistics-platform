import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/*                                USER PICKER                                 */
/* -------------------------------------------------------------------------- */

function UserPicker({ role, onSelect }) {

  const [users,setUsers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState('');

  const roleConfig = {
    customer:{ label:'Customer', icon:'🛒', color:'#6366f1'},
    agent:{ label:'Agent', icon:'🤝', color:'#22c55e'}
  }[role] || { label:'Customer', icon:'🛒', color:'#6366f1' };

  useEffect(()=>{
    api.get(`/api/v1/users?role=${role}`)
      .then(res => {
        const data = res.data.data || res.data || [];
        setUsers(data);
      })
      .catch(console.error)
      .finally(()=>setLoading(false));
  },[role]);

  const filtered = users.filter(u=>{
    if(!search) return true;
    const q = search.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={cs.pickerWrap}>
      <div style={cs.pickerCard}>

        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{
            width:60, height:60, borderRadius:14,
            background:roleConfig.color+'20',
            color:roleConfig.color,
            display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:30,
            margin:'0 auto 12px'
          }}>
            {roleConfig.icon}
          </div>
          <div style={{fontWeight:800,fontSize:20,color:'#e8eaf2'}}>
            View as {roleConfig.label}
          </div>
          <div style={{fontSize:12,color:'#545f73',marginTop:4}}>
            Select a {roleConfig.label.toLowerCase()} to preview portal
          </div>
        </div>

        <input
          style={cs.searchInput}
          placeholder={`Search ${roleConfig.label.toLowerCase()}s...`}
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        <div style={cs.userList}>
          {loading ? (
            <div style={{textAlign:'center',padding:24,color:'#545f73'}}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{textAlign:'center',padding:24,color:'#545f73'}}>No users</div>
          ) : filtered.map(u=>{
            const initials=(u.full_name || '?')
              .split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            return(
              <div key={u.id} style={cs.userRow} onClick={()=>onSelect(u)}>
                <div style={{...cs.userAvatar, background:roleConfig.color+'18', color:roleConfig.color}}>
                  {initials}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,color:'#e8eaf2'}}>{u.full_name}</div>
                  <div style={{fontSize:12,color:'#545f73'}}>{u.email}</div>
                </div>
                <div style={{color:roleConfig.color,fontSize:18}}>→</div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   MAIN                                     */
/* -------------------------------------------------------------------------- */

export default function CustomerView({ role='customer' }) {

  const navigate = useNavigate();
  const [user,setUser] = useState(null);
  const [bookings,setBookings] = useState([]);

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if(userId){
      api.get(`/api/v1/users/${userId}`)
        .then(res => setUser(res.data.data || res.data))
        .catch(console.error);
    }
  },[]);

  useEffect(()=>{
    if (!user?.id) return;
    api.get('/api/v1/bookings', { params: { customer_id: user.id } })
      .then(res => setBookings(res.data.data || res.data || []))
      .catch(() => setBookings([]));
  },[user]);

  const handleSelect = (u) => {
    setUser(u);
  };

  const handleSwitch = () => {
    setUser(null);
    setBookings([]);
  };

  const activeTrips = bookings.filter(b => b.status === 'in_transit').length;
  const totalSpent  = bookings
    .filter(b => b.status === 'completed')
    .reduce((s, b) => s + (parseFloat(b.final_fare || b.estimated_fare) || 0), 0);

  return (
    <Layout title="Customer Portal">

      {/* BACK BUTTON */}
      <div style={{marginBottom:16}}>
        <button
          onClick={()=>navigate('/')}
          style={{
            background:'#1f2840',
            border:'1px solid rgba(255,255,255,0.1)',
            color:'#e8eaf2', padding:'8px 14px',
            borderRadius:8, cursor:'pointer'
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {!user ? (

        <UserPicker role={role} onSelect={handleSelect}/>

      ) : (

        <div style={{
          background:'#111621', padding:20,
          borderRadius:12, border:'1px solid rgba(255,255,255,0.07)'
        }}>

          {/* SWITCH BUTTON */}
          <button
            onClick={handleSwitch}
            style={{
              background:'#181e2d',
              border:'1px solid rgba(255,255,255,0.1)',
              color:'#e8eaf2', padding:'6px 12px',
              borderRadius:8, cursor:'pointer', marginBottom:10
            }}
          >
            ⇄ Switch User
          </button>

          {/* WELCOME */}
          <div style={{fontWeight:700, fontSize:18, color:'#e8eaf2', marginBottom:10}}>
            Welcome, {user.full_name}
          </div>

          {/* BOOK TRIP BUTTON */}
          <div style={{marginBottom:16}}>
            <button
              onClick={() => navigate('/create-booking')}
              style={{
                background:'#22c55e', border:'none',
                color:'#000', padding:'10px 16px',
                borderRadius:8, fontWeight:700, cursor:'pointer'
              }}
            >
              ➕ Book Trip
            </button>
          </div>

          {/* KPI GRID — only cards here, nothing else */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(3, 1fr)',
            gap:12,
            marginBottom:20
          }}>
            <div style={dash.card}>
              <div style={dash.label}>Total Bookings</div>
              <div style={dash.value}>{bookings.length}</div>
            </div>

            <div style={dash.card}>
              <div style={dash.label}>Active Trips</div>
              <div style={dash.value}>{activeTrips}</div>
            </div>

            <div style={dash.card}>
              <div style={dash.label}>Total Spent</div>
              <div style={dash.value}>KES {totalSpent.toLocaleString()}</div>
            </div>
          </div>

          {/* MY BOOKINGS LIST */}
          <div style={{marginTop:20}}>
            <div style={{fontWeight:700, marginBottom:10, color:'#e8eaf2'}}>
              My Bookings
            </div>

            {bookings.length === 0 ? (
              <div style={{color:'#545f73'}}>No bookings yet</div>
            ) : bookings.map(b => (
              <div key={b.id} style={{
                background:'#181e2d', padding:12,
                borderRadius:10, marginBottom:10
              }}>
                <div style={{color:'#e8eaf2'}}>
                  <b>{b.pickup_address}</b> → {b.delivery_address}
                </div>
                <div style={{color:'#8892a4', fontSize:13}}>Status: {b.status}</div>
                <div style={{color:'#8892a4', fontSize:13}}>
                  Fare: KES {b.final_fare || b.estimated_fare || '-'}
                </div>
              </div>
            ))}
          </div>

        </div>

      )}

    </Layout>
  );
}

export function AgentView(){
  return <CustomerView role="agent" />;
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const cs = {
  pickerWrap:  { display:'flex', justifyContent:'center', padding:20 },
  pickerCard:  { width:'100%', maxWidth:420, background:'#111621', borderRadius:20, padding:20 },
  searchInput: { width:'100%', padding:'10px 14px', background:'#181e2d', borderRadius:10, color:'#e8eaf2', marginBottom:12, border:'none' },
  userList:    { maxHeight:400, overflowY:'auto' },
  userRow:     { display:'flex', alignItems:'center', gap:12, padding:12, borderRadius:10, background:'#181e2d', marginBottom:6, cursor:'pointer' },
  userAvatar:  { width:40, height:40, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
};

const dash = {
  card:  { background:'#181e2d', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:16 },
  label: { fontSize:11, color:'#545f73', marginBottom:6 },
  value: { fontSize:22, fontWeight:800, color:'#22c55e' },
};