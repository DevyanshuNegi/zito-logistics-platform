import { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

// Sparkline mini chart component
function Sparkline({ data = [], color = '#e8a020', height = 36 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const w = 80;
  const h = height;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const fill = `${pts} ${w},${h} 0,${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <polygon points={fill} fill={`url(#g${color.replace('#','')})`} />

      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Animated number
function CountUp({ target, prefix = '', suffix = '', duration = 1200 }) {

  const [val,setVal] = useState(0);

  useEffect(()=>{

    const start = Date.now();

    const tick = () => {

      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setVal(Math.round(eased * target));

      if(progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

  },[target]);

  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// Donut chart
function Donut({ segments, size = 80 }) {

  const r = 28;
  const cx = size/2;
  const cy = size/2;

  const circ = 2*Math.PI*r;

  const total = segments.reduce((s,seg)=>s+seg.value,0) || 1;

  let offset = 0;

  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
      {segments.map((seg,i)=>{

        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;

        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset*circ}
          />
        );

        offset += pct;

        return el;

      })}

      <circle cx={cx} cy={cy} r={22} fill="#111621"/>
    </svg>
  );
}

const RECENT_LIMIT = 6;
export default function Dashboard() {

  const [stats,setStats] = useState(null);
  const [bookings,setBookings] = useState([]);
  const [drivers,setDrivers] = useState([]);
  const [vehicles,setVehicles] = useState([]);
  const [transporters,setTransporters] = useState([]);
  const [charges,setCharges] = useState([]);

  const [loading,setLoading] = useState(true);
  const [now,setNow] = useState(new Date());

  // live clock
  useEffect(()=>{

    const t = setInterval(()=>{
      setNow(new Date());
    },1000);

    return ()=>clearInterval(t);

  },[]);


  const fetchAll = async () => {

    setLoading(true);

    try{

      const [b,d,v,t,c] = await Promise.all([

        api.get('/api/v1/bookings'),
        api.get('/api/v1/users?role=driver'),
        api.get('/api/v1/vehicles'),
        api.get('/api/v1/users?role=transporter'),
        api.get('/api/v1/trip-charges')

      ]);

      const bk = b.data.data || b.data || [];
      const dr = d.data.data || d.data || [];
      const vh = v.data.data || v.data || [];
      const tp = t.data.data || t.data || [];
      const ch = c.data.data || c.data || [];

      setBookings(bk);
      setDrivers(dr);
      setVehicles(vh);
      setTransporters(tp);
      setCharges(ch);


      // booking stats
      const completed  = bk.filter(x => x.status === 'completed');
      const inTransit  = bk.filter(x => x.status === 'in_transit');
      const pending    = bk.filter(x => x.status === 'pending');


      // revenue
      const revenue = completed.reduce(
        (s,x)=> s + (parseFloat(x.customer_rate || x.amount || x.total_amount) || 0),
        0
      );


      // transporter cost
      const transportCost = completed.reduce(
        (s,x)=> s + (parseFloat(x.hire_rate) || 0),
        0
      );


      // driver trip expenses
      const tripExpenses = ch.reduce(
        (s,x)=> s + (parseFloat(x.amount) || 0),
        0
      );


      // net profit
      const profit = revenue - transportCost - tripExpenses;


      const activeVeh = vh.filter(x => x.is_active);
      const availDrv  = dr.filter(x => x.is_available);


      setStats({

        completed:completed.length,
        inTransit:inTransit.length,
        pending:pending.length,

        revenue,
        transportCost,
        tripExpenses,
        profit,

        activeVeh:activeVeh.length,
        availDrv:availDrv.length,

        totalVeh:vh.length,
        totalDrv:dr.length

      });

    }

    catch(err){

      console.error(err);

    }

    finally{

      setLoading(false);

    }

  };


  useEffect(()=>{

    fetchAll();

  },[]);


  const ksh = n => `KES ${Number(n || 0).toLocaleString()}`;


  const greeting =
    now.getHours() < 12
      ? 'Good morning'
      : now.getHours() < 17
      ? 'Good afternoon'
      : 'Good evening';  return (
    <Layout>

      {/* HEADER */}

      <div style={s.header}>

        <div>
          <div style={s.greeting}>{greeting}, Admin 👋</div>

          <div style={s.dateBar}>
            {now.toLocaleDateString('en-KE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}

            <span style={s.clock}>
              {now.toLocaleTimeString('en-KE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        </div>

        <button style={s.refreshBtn} onClick={fetchAll}>
          ↻ Refresh
        </button>

      </div>


      {/* KPI CARDS */}

      <div style={s.kpiGrid}>

        {[
          { label: 'Total Revenue', value: stats?.revenue || 0, prefix: 'KES ', color: '#22c55e', icon: '💰' },

          { label: 'Transport Cost', value: stats?.transportCost || 0, prefix: 'KES ', color: '#ef4444', icon: '🚛' },

          { label: 'Trip Expenses', value: stats?.tripExpenses || 0, prefix: 'KES ', color: '#f59e0b', icon: '⛽' },

          { label: 'Net Profit', value: stats?.profit || 0, prefix: 'KES ', color: '#10b981', icon: '📈' },

          { label: 'Total Trips', value: bookings.length, color: '#e8a020', icon: '📋' },

          { label: 'Active Fleet', value: stats?.activeVeh || 0, color: '#2dd4bf', icon: '🚛' },

          { label: 'Available Drivers', value: stats?.availDrv || 0, color: '#6366f1', icon: '👤' }

        ].map((c,i)=>(
          
          <div key={i} style={s.kpiCard}>

            <div style={s.kpiTop}>

              <div>

                <div style={s.kpiLabel}>
                  {c.label}
                </div>

                <div style={{...s.kpiValue,color:c.color}}>
                  {loading ? '—' : <CountUp target={c.value} prefix={c.prefix}/>}
                </div>

              </div>

              <div style={s.kpiIcon}>
                {c.icon}
              </div>

            </div>

          </div>

        ))}

      </div>


      {/* ROW 2 */}

      <div style={s.row2}>

        <div style={s.chartCard}>
          <div style={s.cardTitle}>Trip Breakdown</div>
          <div style={{paddingTop:20}}>
            <Donut
              segments={[
                { value: stats?.completed || 0, color: '#22c55e' },
                { value: stats?.inTransit || 0, color: '#2dd4bf' },
                { value: stats?.pending || 0, color: '#f59e0b' }
              ]}
            />
          </div>
        </div>


        <div style={s.chartCard}>
          <div style={s.cardTitle}>Fleet</div>

          <div style={{marginTop:10}}>

            <div style={s.legendRow}>
              <span>Vehicles</span>
              <b>{vehicles.length}</b>
            </div>

            <div style={s.legendRow}>
              <span>Drivers</span>
              <b>{drivers.length}</b>
            </div>

            <div style={s.legendRow}>
              <span>Transporters</span>
              <b>{transporters.length}</b>
            </div>

          </div>

        </div>


        <div style={s.chartCard}>
          <div style={s.cardTitle}>Operations Now</div>

          <div style={{marginTop:10}}>

            <div style={s.legendRow}>
              <span>Trips In Transit</span>
              <b>{stats?.inTransit || 0}</b>
            </div>

            <div style={s.legendRow}>
              <span>Pending Trips</span>
              <b>{stats?.pending || 0}</b>
            </div>

            <div style={s.legendRow}>
              <span>Drivers Available</span>
              <b>{stats?.availDrv || 0}</b>
            </div>

          </div>

        </div>

      </div>      {/* ROW 3 */}

      <div style={s.row3}>

        <div style={{...s.panel,flex:2}}>

          <div style={s.panelHeader}>
            <div style={s.cardTitle}>Recent Trips</div>
            <span style={s.seeAll}>Last {RECENT_LIMIT}</span>
          </div>

          <table style={s.table}>

            <thead>
              <tr>
                <th style={s.th}>ID</th>
                <th style={s.th}>ROUTE</th>
                <th style={s.th}>AMOUNT</th>
              </tr>
            </thead>

            <tbody>

              {bookings.slice(0,RECENT_LIMIT).map(b=>(
                
                <tr key={b.id} style={s.tr}>

                  <td style={s.td}>
                    #{String(b.id).padStart(4,'0')}
                  </td>

                  <td style={s.td}>
                    {b.pickup_location} → {b.dropoff_location}
                  </td>

                  <td style={s.td}>
                    {ksh(b.amount || b.total_amount)}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>


        <div style={{...s.panel,flex:1}}>

          <div style={s.panelHeader}>
            <div style={s.cardTitle}>Driver Status</div>
          </div>

          {drivers.slice(0,5).map(d=>{

            const onTrip = !d.is_available;

            return(

              <div key={d.id} style={s.driverRow}>

                <div style={s.driverAvatar}>
                  {d.full_name?.slice(0,2)}
                </div>

                <div style={{flex:1}}>
                  {d.full_name}
                </div>

                <div style={s.statusPill}>
                  {onTrip ? '🚛 On Trip' : '✓ Free'}
                </div>

              </div>

            );

          })}

        </div>

      </div>

    </Layout>
  );
}


/* STYLES */

const s={

header:{
display:'flex',
justifyContent:'space-between',
marginBottom:20
},

greeting:{
fontSize:22,
fontWeight:800,
color:'#e8eaf2'
},

dateBar:{
fontSize:13,
color:'#8892a4'
},

clock:{
marginLeft:10,
fontFamily:'monospace'
},

refreshBtn:{
background:'transparent',
border:'1px solid #444',
padding:'6px 12px',
borderRadius:6,
color:'#aaa'
},

kpiGrid:{
display:'grid',
gridTemplateColumns:'repeat(4,1fr)',
gap:12,
marginBottom:20
},

kpiCard:{
background:'#111621',
padding:18,
borderRadius:10
},

kpiTop:{
display:'flex',
justifyContent:'space-between'
},

kpiLabel:{
fontSize:11,
color:'#8892a4'
},

kpiValue:{
fontSize:24,
fontWeight:800
},

kpiIcon:{
fontSize:20
},

row2:{
display:'grid',
gridTemplateColumns:'repeat(3,1fr)',
gap:12,
marginBottom:20
},

chartCard:{
background:'#111621',
padding:18,
borderRadius:10
},

cardTitle:{
fontWeight:700,
color:'#e8eaf2'
},

legendRow:{
display:'flex',
justifyContent:'space-between',
marginTop:6
},

row3:{
display:'flex',
gap:12
},

panel:{
background:'#111621',
borderRadius:10
},

panelHeader:{
padding:14,
borderBottom:'1px solid rgba(255,255,255,0.1)',
display:'flex',
justifyContent:'space-between'
},

seeAll:{
fontSize:12,
color:'#888'
},

table:{
width:'100%',
borderCollapse:'collapse'
},

th:{
textAlign:'left',
padding:'10px'
},

td:{
padding:'10px'
},

tr:{
borderBottom:'1px solid rgba(255,255,255,0.05)'
},

driverRow:{
display:'flex',
alignItems:'center',
padding:'10px'
},

driverAvatar:{
width:30,
height:30,
borderRadius:6,
background:'#333',
display:'flex',
alignItems:'center',
justifyContent:'center'
},

statusPill:{
fontSize:12
}

};