import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';

const CHARGE_TYPES = [
  { value: 'fuel_advance', label: 'Fuel Advance ⛽' },
  { value: 'toll', label: 'Toll 🛣️' },
  { value: 'parking', label: 'Parking 🅿️' },
  { value: 'detention', label: 'Detention ⏱️' },
  { value: 'driver_settlement', label: 'Driver Settlement 👨‍✈️' },
  { value: 'other_expense', label: 'Other Expense 📦' },
];

export default function TripCharges() {

  const [searchParams] = useSearchParams();
  const queryTripId = searchParams.get('tripId');

  const [tripId, setTripId] = useState(queryTripId || '');
  const [driverId, setDriverId] = useState('');
  const [chargeType, setChargeType] = useState('fuel_advance');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadCharges = async () => {

    if(!tripId) return;

    try{

      const res = await api.get(`/api/v1/trip-charges/trip/${tripId}`);

      setCharges(res.data.data || []);

    }catch(err){

      console.error(err);

    }

  };

  useEffect(()=>{
    loadCharges();
  },[tripId]);

  const handleSubmit = async (e)=>{

    e.preventDefault();

    if(!tripId || !amount){
      alert("Trip ID and Amount required");
      return;
    }

    try{

      setLoading(true);

      await api.post('/api/v1/trip-charges',{
        trip_id:tripId,
        driver_id:driverId || null,
        charge_type:chargeType,
        amount:parseFloat(amount),
        description
      });

      setAmount('');
      setDescription('');

      loadCharges();

    }catch(err){

      console.error(err);

    }

    finally{
      setLoading(false);
    }

  };

  const totalExpense = charges.reduce((sum,c)=> sum + Number(c.amount),0);

  return (

  <Layout>

  <div style={s.header}>
    <div>
      <div style={s.title}>Trip Charges / Expenses</div>
      <div style={s.sub}>
        Record fuel advances, tolls, parking, detention and settlements
      </div>
    </div>
  </div>

  <div style={s.grid}>

    {/* FORM */}
    <div style={s.card}>

      <div style={s.cardTitle}>Add Charge</div>

      <form onSubmit={handleSubmit} style={s.form}>

        <input
          style={s.input}
          placeholder="Trip ID"
          value={tripId}
          onChange={e=>setTripId(e.target.value)}
        />

        <input
          style={s.input}
          placeholder="Driver ID (optional)"
          value={driverId}
          onChange={e=>setDriverId(e.target.value)}
        />

        <select
          style={s.input}
          value={chargeType}
          onChange={e=>setChargeType(e.target.value)}
        >
          {CHARGE_TYPES.map(c=>(
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <input
          style={s.input}
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={e=>setAmount(e.target.value)}
        />

        <textarea
          style={s.textarea}
          placeholder="Description"
          value={description}
          onChange={e=>setDescription(e.target.value)}
        />

        <button style={s.button} disabled={loading}>
          {loading ? "Saving..." : "Add Charge"}
        </button>

      </form>

    </div>

    {/* LIST */}
    <div style={s.card}>

      <div style={s.cardTitle}>Trip Charges</div>

      {!tripId
      ? <div style={s.empty}>Enter Trip ID to view charges</div>
      :
      charges.length === 0
      ? <div style={s.empty}>No charges recorded</div>
      :
      <div style={s.list}>

        {charges.map(c=>(
          <div key={c.id} style={s.row}>

            <div style={s.type}>{c.charge_type}</div>

            <div style={s.desc}>
              {c.description || '—'}
            </div>

            <div style={s.amount}>
              KES {Number(c.amount).toLocaleString()}
            </div>

          </div>
        ))}

        <div style={s.total}>
          Total Expense: KES {totalExpense.toLocaleString()}
        </div>

      </div>
      }

    </div>

  </div>

  </Layout>
  );
}

const s = {

header:{
display:'flex',
justifyContent:'space-between',
marginBottom:20
},

title:{
fontWeight:700,
fontSize:18,
color:'#e8eaf2'
},

sub:{
fontSize:13,
color:'#8892a4',
marginTop:4
},

grid:{
display:'grid',
gridTemplateColumns:'1fr 1fr',
gap:20
},

card:{
background:'#111621',
border:'1px solid rgba(255,255,255,0.07)',
borderRadius:12,
padding:20
},

cardTitle:{
fontWeight:600,
fontSize:14,
marginBottom:16,
color:'#e8eaf2'
},

form:{
display:'flex',
flexDirection:'column',
gap:10
},

input:{
background:'#181e2d',
border:'1px solid rgba(255,255,255,0.08)',
borderRadius:8,
padding:10,
color:'#e8eaf2'
},

textarea:{
background:'#181e2d',
border:'1px solid rgba(255,255,255,0.08)',
borderRadius:8,
padding:10,
color:'#e8eaf2',
resize:'vertical'
},

button:{
background:'#6366f1',
border:'none',
padding:10,
borderRadius:8,
color:'#fff',
cursor:'pointer',
marginTop:6
},

list:{
display:'flex',
flexDirection:'column',
gap:8
},

row:{
display:'grid',
gridTemplateColumns:'120px 1fr 120px',
gap:10,
background:'#181e2d',
padding:10,
borderRadius:8
},

type:{
fontWeight:600,
color:'#8892a4'
},

desc:{
fontSize:12,
color:'#545f73'
},

amount:{
textAlign:'right',
fontWeight:700,
color:'#22c55e'
},

total:{
marginTop:12,
textAlign:'right',
fontWeight:700,
color:'#e8a020'
},

empty:{
color:'#545f73',
textAlign:'center',
padding:20
}

};