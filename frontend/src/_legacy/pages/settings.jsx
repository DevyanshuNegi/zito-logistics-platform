import { useState, useEffect } from 'react';
import Layout from '../components/layout';
import api from '../api/axios';

const TABS = [
  { key: 'pricing',       icon: '💰', label: 'Pricing'        },
  { key: 'business',      icon: '⚙',  label: 'Business Rules' },
  { key: 'notifications', icon: '🔔', label: 'Notifications'  },
  { key: 'integrations',  icon: '🔗', label: 'Integrations'   },
  { key: 'service_areas', icon: '🗺',  label: 'Service Areas'  },
  { key: 'account',       icon: '👤', label: 'Account'        },
];

const VEHICLE_TYPES = ['motorcycle', 'van', 'pickup', 'truck', 'articulated'];

function Toggle({ value, onChange }) {
  return (
    <div style={{ width: 44, height: 24, borderRadius: 99, background: value ? '#22c55e' : '#2a3347', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      onClick={() => onChange(!value)}>
      <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: 13, color: '#e8eaf2', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#545f73', marginTop: 3 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: '#111621', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      {title && <div style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf2', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{title}</div>}
      {children}
    </div>
  );
}

function Input({ value, onChange, prefix, suffix, type = 'text', style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden', ...style }}>
      {prefix && <span style={{ padding: '0 10px', color: '#545f73', fontSize: 13, borderRight: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{prefix}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e8eaf2', fontSize: 13, padding: '8px 10px', minWidth: 0, width: 100 }} />
      {suffix && <span style={{ padding: '0 10px', color: '#545f73', fontSize: 13, borderLeft: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{suffix}</span>}
    </div>
  );
}

function SaveBar({ saved, onSave }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
      {saved && <span style={{ fontSize: 12, color: '#22c55e', alignSelf: 'center' }}>✓ Saved</span>}
      <button style={ss.saveBtn} onClick={onSave}>Save Changes</button>
    </div>
  );
}

// ── PRICING TAB ────────────────────────────────────────────────────────────
function PricingTab() {
  const [rates, setRates] = useState({
    motorcycle:  { base: 500,  per_km: 20 },
    van:         { base: 1200, per_km: 45 },
    pickup:      { base: 1500, per_km: 55 },
    truck:       { base: 3000, per_km: 80 },
    articulated: { base: 6000, per_km: 120 },
  });
  const [surcharges, setSurcharges] = useState({ peak_pct: 25, weekend_pct: 15, holiday_pct: 30, night_pct: 20 });
  const [vat, setVat] = useState(16);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div>
      <Card title="Base Rates by Vehicle Type">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: '8px 12px', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#545f73', fontWeight: 600 }}>VEHICLE</div>
          <div style={{ fontSize: 11, color: '#545f73', fontWeight: 600 }}>BASE RATE (KES)</div>
          <div style={{ fontSize: 11, color: '#545f73', fontWeight: 600 }}>PER KM (KES)</div>
          {VEHICLE_TYPES.map(v => (
            <>
              <div key={v} style={{ fontSize: 13, color: '#e8eaf2', textTransform: 'capitalize', padding: '4px 0' }}>{v}</div>
              <Input key={`${v}_base`} value={rates[v]?.base || ''} prefix="KES" type="number"
                onChange={val => setRates(r => ({ ...r, [v]: { ...r[v], base: val } }))} />
              <Input key={`${v}_km`} value={rates[v]?.per_km || ''} suffix="/km" type="number"
                onChange={val => setRates(r => ({ ...r, [v]: { ...r[v], per_km: val } }))} />
            </>
          ))}
        </div>
      </Card>

      <Card title="Surcharges">
        <Row label="Peak Hours (6–9am, 5–8pm)" hint="Monday–Friday rush hours">
          <Input value={surcharges.peak_pct} suffix="%" type="number" style={{ width: 100 }}
            onChange={v => setSurcharges(s => ({ ...s, peak_pct: v }))} />
        </Row>
        <Row label="Weekend Surcharge" hint="Saturday and Sunday">
          <Input value={surcharges.weekend_pct} suffix="%" type="number" style={{ width: 100 }}
            onChange={v => setSurcharges(s => ({ ...s, weekend_pct: v }))} />
        </Row>
        <Row label="Public Holiday Surcharge">
          <Input value={surcharges.holiday_pct} suffix="%" type="number" style={{ width: 100 }}
            onChange={v => setSurcharges(s => ({ ...s, holiday_pct: v }))} />
        </Row>
        <Row label="Night Surcharge (10pm–5am)">
          <Input value={surcharges.night_pct} suffix="%" type="number" style={{ width: 100 }}
            onChange={v => setSurcharges(s => ({ ...s, night_pct: v }))} />
        </Row>
        <Row label="VAT Rate" hint="Kenya standard rate">
          <Input value={vat} suffix="%" type="number" style={{ width: 100 }}
            onChange={setVat} />
        </Row>
      </Card>

      <Card title="Commission Rates">
        <Row label="Agent Commission" hint="Default % of trip revenue paid to agents">
          <Input value="8" suffix="%" type="number" style={{ width: 100 }} onChange={() => {}} />
        </Row>
        <Row label="Driver Payout" hint="% of trip revenue paid to driver">
          <Input value="75" suffix="%" type="number" style={{ width: 100 }} onChange={() => {}} />
        </Row>
        <Row label="Transporter Settlement" hint="% paid to contracted vehicle owners">
          <Input value="70" suffix="%" type="number" style={{ width: 100 }} onChange={() => {}} />
        </Row>
      </Card>
      <SaveBar saved={saved} onSave={save} />
    </div>
  );
}

// ── BUSINESS RULES TAB ─────────────────────────────────────────────────────
function BusinessTab() {
  const [rules, setRules] = useState({
    driver_accept_timeout: 3,
    max_trip_distance_km: 500,
    max_vehicle_age_years: 10,
    min_driver_rating: 3.5,
    auto_assign: false,
    require_insurance: true,
    require_ntsa: true,
    require_good_conduct: true,
    allow_cash_payment: true,
    allow_mpesa_payment: true,
    allow_credit_payment: true,
    credit_default_limit: 50000,
    invoice_cycle: 'monthly',
    cancellation_window_hrs: 2,
    cancellation_fee_pct: 10,
  });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setRules(r => ({ ...r, [k]: v }));
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div>
      <Card title="Trip Rules">
        <Row label="Driver Acceptance Timeout" hint="Minutes driver has to accept or decline">
          <Input value={rules.driver_accept_timeout} suffix="min" type="number" style={{ width: 110 }}
            onChange={v => set('driver_accept_timeout', v)} />
        </Row>
        <Row label="Max Trip Distance" hint="Maximum distance per booking">
          <Input value={rules.max_trip_distance_km} suffix="km" type="number" style={{ width: 110 }}
            onChange={v => set('max_trip_distance_km', v)} />
        </Row>
        <Row label="Auto-Assign Trips" hint="Automatically assign to nearest available driver">
          <Toggle value={rules.auto_assign} onChange={v => set('auto_assign', v)} />
        </Row>
        <Row label="Cancellation Window" hint="Free cancellation within this period after booking">
          <Input value={rules.cancellation_window_hrs} suffix="hrs" type="number" style={{ width: 110 }}
            onChange={v => set('cancellation_window_hrs', v)} />
        </Row>
        <Row label="Cancellation Fee" hint="Charged after free window expires">
          <Input value={rules.cancellation_fee_pct} suffix="%" type="number" style={{ width: 110 }}
            onChange={v => set('cancellation_fee_pct', v)} />
        </Row>
      </Card>

      <Card title="Fleet Requirements">
        <Row label="Max Vehicle Age" hint="Vehicles older than this cannot be registered">
          <Input value={rules.max_vehicle_age_years} suffix="years" type="number" style={{ width: 110 }}
            onChange={v => set('max_vehicle_age_years', v)} />
        </Row>
        <Row label="Minimum Driver Rating" hint="Drivers below this are flagged for review">
          <Input value={rules.min_driver_rating} suffix="★" type="number" style={{ width: 110 }}
            onChange={v => set('min_driver_rating', v)} />
        </Row>
        <Row label="Require Valid Insurance" hint="Block vehicles with expired insurance">
          <Toggle value={rules.require_insurance} onChange={v => set('require_insurance', v)} />
        </Row>
        <Row label="Require NTSA Inspection" hint="Block vehicles without valid inspection">
          <Toggle value={rules.require_ntsa} onChange={v => set('require_ntsa', v)} />
        </Row>
        <Row label="Require Good Conduct Certificate" hint="Mandatory for all drivers">
          <Toggle value={rules.require_good_conduct} onChange={v => set('require_good_conduct', v)} />
        </Row>
      </Card>

      <Card title="Payment Rules">
        <Row label="Cash Payments"><Toggle value={rules.allow_cash_payment} onChange={v => set('allow_cash_payment', v)} /></Row>
        <Row label="M-Pesa Payments"><Toggle value={rules.allow_mpesa_payment} onChange={v => set('allow_mpesa_payment', v)} /></Row>
        <Row label="Credit Payments"><Toggle value={rules.allow_credit_payment} onChange={v => set('allow_credit_payment', v)} /></Row>
        <Row label="Default Credit Limit" hint="Applied to new credit-approved customers">
          <Input value={rules.credit_default_limit} prefix="KES" type="number" style={{ width: 150 }}
            onChange={v => set('credit_default_limit', v)} />
        </Row>
        <Row label="Invoice Cycle" hint="How often invoices are auto-generated">
          <select value={rules.invoice_cycle} onChange={e => set('invoice_cycle', e.target.value)}
            style={{ background: '#181e2d', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#e8eaf2', padding: '8px 12px', fontSize: 13, outline: 'none' }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Row>
      </Card>
      <SaveBar saved={saved} onSave={save} />
    </div>
  );
}

// ── NOTIFICATIONS TAB ──────────────────────────────────────────────────────
function NotificationsTab() {
  const [settings, setSettings] = useState({
    trip_assigned_push: true,  trip_assigned_sms: true,  trip_assigned_email: false,
    trip_started_push: true,   trip_started_sms: false,  trip_started_email: false,
    trip_completed_push: true, trip_completed_sms: true, trip_completed_email: true,
    payment_due_push: true,    payment_due_sms: true,    payment_due_email: true,
    verification_push: true,   verification_sms: false,  verification_email: true,
    driver_offline_push: true, driver_offline_sms: false,driver_offline_email: false,
  });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const events = [
    { key: 'trip_assigned',  label: 'Trip Assigned',         hint: 'When a booking is assigned to a driver' },
    { key: 'trip_started',   label: 'Trip Started',          hint: 'When driver marks trip as started' },
    { key: 'trip_completed', label: 'Trip Completed',        hint: 'On successful delivery' },
    { key: 'payment_due',    label: 'Payment Due',           hint: 'When invoice payment is overdue' },
    { key: 'verification',   label: 'Verification Pending',  hint: 'New verification requests' },
    { key: 'driver_offline', label: 'Driver Goes Offline',   hint: 'During an active trip' },
  ];

  return (
    <div>
      <Card title="Event Notification Channels">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', gap: '8px 0', alignItems: 'center', marginBottom: 8 }}>
          <div />
          {['Push', 'SMS', 'Email'].map(ch => (
            <div key={ch} style={{ textAlign: 'center', fontSize: 11, color: '#545f73', fontWeight: 600 }}>{ch}</div>
          ))}
        </div>
        {events.map(ev => (
          <div key={ev.key} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: 13, color: '#e8eaf2', fontWeight: 500 }}>{ev.label}</div>
              <div style={{ fontSize: 11, color: '#545f73', marginTop: 2 }}>{ev.hint}</div>
            </div>
            {['push', 'sms', 'email'].map(ch => (
              <div key={ch} style={{ display: 'flex', justifyContent: 'center' }}>
                <Toggle value={settings[`${ev.key}_${ch}`]}
                  onChange={v => set(`${ev.key}_${ch}`, v)} />
              </div>
            ))}
          </div>
        ))}
      </Card>
      <SaveBar saved={saved} onSave={save} />
    </div>
  );
}

// ── INTEGRATIONS TAB ───────────────────────────────────────────────────────
function IntegrationsTab() {
  const [keys, setKeys] = useState({
    google_maps: '', mpesa_consumer_key: '', mpesa_consumer_secret: '',
    mpesa_shortcode: '', mpesa_passkey: '', mpesa_env: 'sandbox',
    fcm_server_key: '', africastalking_key: '', africastalking_username: '',
    sendgrid_key: '', sendgrid_from: '',
  });
  const [show, setShow] = useState({});
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setKeys(s => ({ ...s, [k]: v }));
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const SecretInput = ({ label, hint, k }) => (
    <Row label={label} hint={hint}>
      <div style={{ display: 'flex', gap: 6 }}>
        <Input value={keys[k]} type={show[k] ? 'text' : 'password'} style={{ width: 220 }}
          onChange={v => set(k, v)} />
        <button style={ss.iconBtn} onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))}>
          {show[k] ? '🙈' : '👁'}
        </button>
      </div>
    </Row>
  );

  const StatusDot = ({ active }) => (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? '#22c55e' : '#545f73', display: 'inline-block', marginRight: 6, boxShadow: active ? '0 0 6px #22c55e' : 'none' }} />
  );

  return (
    <div>
      <Card title="Google Maps API">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusDot active={!!keys.google_maps} />
          <span style={{ fontSize: 12, color: keys.google_maps ? '#22c55e' : '#545f73' }}>{keys.google_maps ? 'Connected' : 'Not configured'}</span>
        </div>
        <SecretInput label="API Key" hint="Used for address autocomplete, routing, and live map" k="google_maps" />
      </Card>

      <Card title="M-Pesa (Daraja API)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusDot active={!!keys.mpesa_consumer_key} />
          <span style={{ fontSize: 12, color: keys.mpesa_consumer_key ? '#22c55e' : '#545f73' }}>{keys.mpesa_consumer_key ? 'Connected' : 'Not configured'}</span>
          <select value={keys.mpesa_env} onChange={e => set('mpesa_env', e.target.value)}
            style={{ marginLeft: 'auto', background: keys.mpesa_env === 'sandbox' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', border: 'none', color: keys.mpesa_env === 'sandbox' ? '#f59e0b' : '#22c55e', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </div>
        <SecretInput label="Consumer Key" hint="From Safaricom Daraja portal" k="mpesa_consumer_key" />
        <SecretInput label="Consumer Secret" k="mpesa_consumer_secret" />
        <Row label="Business Shortcode" hint="Paybill or Till number">
          <Input value={keys.mpesa_shortcode} style={{ width: 140 }} onChange={v => set('mpesa_shortcode', v)} />
        </Row>
        <SecretInput label="Lipa Na M-Pesa Passkey" k="mpesa_passkey" />
      </Card>

      <Card title="Firebase Cloud Messaging (FCM)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusDot active={!!keys.fcm_server_key} />
          <span style={{ fontSize: 12, color: keys.fcm_server_key ? '#22c55e' : '#545f73' }}>{keys.fcm_server_key ? 'Connected' : 'Not configured'}</span>
        </div>
        <SecretInput label="Server Key" hint="From Firebase Console → Project Settings → Cloud Messaging" k="fcm_server_key" />
      </Card>

      <Card title="Africa's Talking (SMS)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusDot active={!!keys.africastalking_key} />
          <span style={{ fontSize: 12, color: keys.africastalking_key ? '#22c55e' : '#545f73' }}>{keys.africastalking_key ? 'Connected' : 'Not configured'}</span>
        </div>
        <Row label="Username"><Input value={keys.africastalking_username} style={{ width: 180 }} onChange={v => set('africastalking_username', v)} /></Row>
        <SecretInput label="API Key" k="africastalking_key" />
      </Card>

      <Card title="SendGrid (Email)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <StatusDot active={!!keys.sendgrid_key} />
          <span style={{ fontSize: 12, color: keys.sendgrid_key ? '#22c55e' : '#545f73' }}>{keys.sendgrid_key ? 'Connected' : 'Not configured'}</span>
        </div>
        <SecretInput label="API Key" k="sendgrid_key" />
        <Row label="From Email"><Input value={keys.sendgrid_from} placeholder="no-reply@zitoafrica.com" style={{ width: 220 }} onChange={v => set('sendgrid_from', v)} /></Row>
      </Card>
      <SaveBar saved={saved} onSave={save} />
    </div>
  );
}

// ── SERVICE AREAS TAB ──────────────────────────────────────────────────────
function ServiceAreasTab() {
  const [areas, setAreas] = useState([
    { id: 1, name: 'Nairobi Metro',   region: 'Central',  active: true,  vehicles: ['motorcycle','van','pickup','truck'] },
    { id: 2, name: 'Mombasa',         region: 'Coast',    active: true,  vehicles: ['van','pickup','truck','articulated'] },
    { id: 3, name: 'Kisumu',          region: 'Western',  active: true,  vehicles: ['motorcycle','van','pickup'] },
    { id: 4, name: 'Nakuru',          region: 'Rift Valley', active: true, vehicles: ['van','pickup','truck'] },
    { id: 5, name: 'Eldoret',         region: 'North Rift', active: false, vehicles: ['pickup','truck'] },
    { id: 6, name: 'Nairobi–Mombasa', region: 'Highway',  active: true,  vehicles: ['truck','articulated'] },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newArea, setNewArea] = useState({ name: '', region: '' });

  const toggle = (id) => setAreas(a => a.map(x => x.id === id ? { ...x, active: !x.active } : x));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#8892a4' }}>{areas.filter(a => a.active).length} of {areas.length} areas active</div>
        <button style={ss.addBtn} onClick={() => setShowAdd(v => !v)}>+ Add Area</button>
      </div>

      {showAdd && (
        <div style={{ background: '#111621', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eaf2', marginBottom: 12 }}>New Service Area</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Input value={newArea.name} placeholder="Area name" onChange={v => setNewArea(a => ({ ...a, name: v }))} style={{ flex: 1 }} />
            <Input value={newArea.region} placeholder="Region" onChange={v => setNewArea(a => ({ ...a, region: v }))} style={{ flex: 1 }} />
            <button style={ss.saveBtn} onClick={() => { if (newArea.name) { setAreas(a => [...a, { id: Date.now(), ...newArea, active: true, vehicles: ['van','pickup'] }]); setShowAdd(false); setNewArea({ name: '', region: '' }); } }}>Add</button>
          </div>
        </div>
      )}

      {areas.map(area => (
        <div key={area.id} style={{ background: '#111621', border: `1px solid ${area.active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, opacity: area.active ? 1 : 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#e8eaf2' }}>{area.name}</div>
              <div style={{ fontSize: 12, color: '#545f73', marginTop: 2 }}>{area.region}</div>
            </div>
            <Toggle value={area.active} onChange={() => toggle(area.id)} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {VEHICLE_TYPES.map(v => {
              const on = area.vehicles.includes(v);
              return (
                <span key={v} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: on ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', color: on ? '#818cf8' : '#545f73', cursor: 'pointer', textTransform: 'capitalize' }}
                  onClick={() => setAreas(a => a.map(x => x.id === area.id ? { ...x, vehicles: on ? x.vehicles.filter(t => t !== v) : [...x.vehicles, v] } : x))}>
                  {v}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ACCOUNT TAB ────────────────────────────────────────────────────────────
function AccountTab() {
  const [profile, setProfile] = useState({ company_name: 'Zito Tech Africa Limited', email: 'info@zitoafrica.com', phone: '+254 700 000 000', address: 'Nairobi, Kenya', kra_pin: '', logo_url: '' });
  const [pwd, setPwd] = useState({ current: '', newp: '', confirm: '' });
  const [saved, setSaved] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  return (
    <div>
      <Card title="Company Profile">
        <Row label="Company Name"><Input value={profile.company_name} style={{ width: 220 }} onChange={v => set('company_name', v)} /></Row>
        <Row label="Admin Email"><Input value={profile.email} style={{ width: 220 }} onChange={v => set('email', v)} /></Row>
        <Row label="Phone"><Input value={profile.phone} style={{ width: 180 }} onChange={v => set('phone', v)} /></Row>
        <Row label="Address"><Input value={profile.address} style={{ width: 220 }} onChange={v => set('address', v)} /></Row>
        <Row label="KRA PIN"><Input value={profile.kra_pin} placeholder="P000000000A" style={{ width: 180 }} onChange={v => set('kra_pin', v)} /></Row>
        <SaveBar saved={saved} onSave={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }} />
      </Card>

      <Card title="Change Password">
        <Row label="Current Password"><Input value={pwd.current} type="password" style={{ width: 200 }} onChange={v => setPwd(p => ({ ...p, current: v }))} /></Row>
        <Row label="New Password"><Input value={pwd.newp} type="password" style={{ width: 200 }} onChange={v => setPwd(p => ({ ...p, newp: v }))} /></Row>
        <Row label="Confirm Password"><Input value={pwd.confirm} type="password" style={{ width: 200 }} onChange={v => setPwd(p => ({ ...p, confirm: v }))} /></Row>
        <SaveBar saved={pwdSaved} onSave={() => {
          if (pwd.newp && pwd.newp === pwd.confirm) { setPwdSaved(true); setPwd({ current: '', newp: '', confirm: '' }); setTimeout(() => setPwdSaved(false), 3000); }
        }} />
      </Card>

      <Card title="Danger Zone">
        <Row label="Export All Data" hint="Download a full backup of platform data">
          <button style={{ ...ss.iconBtn, padding: '7px 14px', fontSize: 12, color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)' }}>Export CSV</button>
        </Row>
        <Row label="Clear Test Data" hint="Remove all sandbox/demo records">
          <button style={{ ...ss.iconBtn, padding: '7px 14px', fontSize: 12, color: '#ef4444', borderColor: 'rgba(239,68,68,0.25)' }}>Clear Data</button>
        </Row>
      </Card>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState('pricing');

  return (
    <Layout title="Settings">
      <div style={{ display: 'flex', gap: 20, height: '100%' }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {TABS.map(t => (
            <div key={t.key}
              style={{ ...ss.tabItem, ...(tab === t.key ? ss.tabItemActive : {}) }}
              onClick={() => setTab(t.key)}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
          {tab === 'pricing'       && <PricingTab />}
          {tab === 'business'      && <BusinessTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'integrations'  && <IntegrationsTab />}
          {tab === 'service_areas' && <ServiceAreasTab />}
          {tab === 'account'       && <AccountTab />}
        </div>
      </div>
    </Layout>
  );
}

const ss = {
  tabItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', color: '#8892a4', fontSize: 13, marginBottom: 2, border: '1px solid transparent' },
  tabItemActive: { background: '#1f2840', color: '#e8eaf2', borderColor: 'rgba(255,255,255,0.07)' },
  saveBtn: { background: '#6366f1', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  addBtn: { background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer' },
  iconBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', color: '#8892a4', borderRadius: 8, padding: '7px 10px', fontSize: 14, cursor: 'pointer' },
};
