'use client';

import { useState, useEffect } from 'react';
import api from '@/api/axios'; // Will need to ensure it's alias mapped properly or use relative

// Make sure to align aliases if needed. In Vite it was `import api from '../api/axios'`
// We'll use relative path to be safe, assuming `src/app/(dashboard)/page.tsx` is depth 3, so `../../../api/axios` or `@/api/axios` assuming we have paths in tsconfig. 

// Sparkline mini chart component
function Sparkline({ data = [], color = '#e8a020', height = 36 }: { data?: number[], color?: string, height?: number }) {
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
function CountUp({ target, prefix = '', suffix = '', duration = 1200 }: { target: number, prefix?: string, suffix?: string, duration?: number }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if(progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// Donut chart
function Donut({ segments, size = 80 }: { segments: { value: number, color: string }[], size?: number }) {
  const r = 28;
  const cx = size/2;
  const cy = size/2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
      {segments.map((seg, i) => {
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
  const [bookings, setBookings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // NOTE: Update paths for @/api/axios once aliased. Assuming api setup works.
      // We will mock or catch safely if api module is not ready yet.
      const [b, d, v, t, c] = await Promise.all([
        api.get('/api/v1/bookings').catch(() => ({ data: [] })),
        api.get('/api/v1/users?role=driver').catch(() => ({ data: [] })),
        api.get('/api/v1/vehicles').catch(() => ({ data: [] })),
        api.get('/api/v1/users?role=transporter').catch(() => ({ data: [] })),
        api.get('/api/v1/trip-charges').catch(() => ({ data: [] }))
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
    } catch(err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Compute metrics
  const completed  = bookings.filter(x => x.status === 'completed');
  const inTransit  = bookings.filter(x => x.status === 'in_transit');
  const pending    = bookings.filter(x => x.status === 'pending');

  const revenue = completed.reduce((s, x) => s + (parseFloat(x.customer_rate || x.amount || x.total_amount) || 0), 0);
  const transportCost = completed.reduce((s, x) => s + (parseFloat(x.hire_rate) || 0), 0);
  const tripExpenses = charges.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const netProfit = revenue - transportCost - tripExpenses;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[#545f73]">
        Loading dashboard metrics...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Metrics Overview</h1>
          <p className="text-[#8892a4] text-sm">
            Live operations update: {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button 
          onClick={fetchAll}
          className="self-start px-4 py-2 border border-[#rgba(255,255,255,0.1)] rounded-md text-[#8892a4] text-sm font-semibold hover:bg-[#rgba(255,255,255,0.05)] transition-colors"
        >
          <span className="mr-2">🔄</span>Refresh
        </button>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Bookings', val: bookings.length, sub: `${inTransit.length} en route`, color: '#3b82f6', trend: [10, 15, 8, 12, 10, Number(bookings.length)] },
          { label: 'Fleet Availability', val: vehicles.length, sub: 'Total vehicles', color: '#10b981', trend: [50, 52, 48, 51, 50, Number(vehicles.length)] },
          { label: 'Active Drivers', val: drivers.length, sub: 'Total registered', color: '#c084fc', trend: [20, 22, 21, 23, 24, Number(drivers.length)] },
          { label: 'Total Revenue', val: revenue, pre: 'KES ', sub: 'Completed trips', color: '#f59e0b', trend: [2000, 2500, 2100, 3000, Number(revenue)] },
        ].map((card, i) => (
          <div key={i} className="bg-[#111621] rounded-xl border border-[rgba(255,255,255,0.05)] p-5 flex flex-col justify-between shadow-lg hover:border-[rgba(255,255,255,0.1)] transition-colors">
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs uppercase tracking-wider text-[#545f73] font-bold">{card.label}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
            </div>
            
            <div className="flex flex-row justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-white mb-1">
                  <CountUp target={card.val} prefix={card.pre} />
                </div>
                <div className="text-xs text-[#8892a4]">{card.sub}</div>
              </div>
              <Sparkline data={card.trend} color={card.color} height={32} />
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS / SECONDARY METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PROFIT MARGINS */}
        <div className="bg-[#111621] rounded-xl border border-[rgba(255,255,255,0.05)] p-6 col-span-1 shadow-lg">
          <h2 className="text-[13px] uppercase font-bold text-[#8892a4] mb-6 tracking-wide">Financial Breakdown</h2>
          
          <div className="flex items-center gap-6 mb-6">
            <Donut 
              segments={[
                { value: transportCost, color: '#dc2626' },
                { value: tripExpenses, color: '#f59e0b' },
                { value: Math.max(netProfit, 0), color: '#10b981' },
              ]}
              size={100}
            />
            <div>
              <div className="text-sm font-bold text-white mb-2">Net Profit</div>
              <div className="text-lg font-bold text-[#10b981]">
                KES <CountUp target={Math.max(netProfit, 0)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.05)] pb-2">
              <span className="text-[#8892a4]">Gross Revenue</span>
              <span className="text-white font-bold">KES {revenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.05)] pb-2">
              <span className="text-[#8892a4]">Partner Pay</span>
              <span className="text-[#dc2626] font-bold">- KES {transportCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-[rgba(255,255,255,0.05)] pb-2">
              <span className="text-[#8892a4]">Trip Expenses</span>
              <span className="text-[#f59e0b] font-bold">- KES {tripExpenses.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* RECENT BOOKINGS */}
        <div className="bg-[#111621] rounded-xl border border-[rgba(255,255,255,0.05)] p-6 col-span-2 shadow-lg">
          <h2 className="text-[13px] uppercase font-bold text-[#8892a4] mb-6 tracking-wide">Recent Bookings</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.05)]">
                  <th className="py-3 font-semibold text-[#545f73] uppercase text-xs tracking-wide">ID</th>
                  <th className="py-3 font-semibold text-[#545f73] uppercase text-xs tracking-wide">Customer</th>
                  <th className="py-3 font-semibold text-[#545f73] uppercase text-xs tracking-wide">Route</th>
                  <th className="py-3 font-semibold text-[#545f73] uppercase text-xs tracking-wide">Status</th>
                  <th className="py-3 font-semibold text-[#545f73] uppercase text-xs tracking-wide text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#545f73]">No recent bookings found.</td>
                  </tr>
                ) : (
                  bookings.slice(0, RECENT_LIMIT).map((b, i) => (
                    <tr key={b.id || i} className="border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="py-4 text-[#8892a4]">#{b.id?.substring(0,6) || b.booking_ref}</td>
                      <td className="py-4 font-medium text-[#e8eaf2]">{b.customer_name || 'N/A'}</td>
                      <td className="py-4 text-[#8892a4]">{b.pickup_location?.name || 'Unknown'} ➔ {b.dropoff_location?.name || 'Unknown'}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          b.status === 'completed' ? 'bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.2)]' :
                          b.status === 'in_transit' ? 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6] border border-[rgba(59,130,246,0.2)]' :
                          'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)]'
                        }`}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-white">
                        KES {parseFloat(b.customer_rate || b.amount || b.total_amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}