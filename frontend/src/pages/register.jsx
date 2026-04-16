import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// ─── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  { value: 'customer_personal', api: 'customer',    label: 'Personal Customer',  icon: '👤', desc: 'Send & receive goods personally' },
  { value: 'customer_business', api: 'customer',    label: 'Business Customer',  icon: '🏢', desc: 'Company shipping & logistics'   },
  { value: 'agent',             api: 'agent',       label: 'Agent',              icon: '🤝', desc: 'Book on behalf of customers'    },
  { value: 'driver',            api: 'driver',      label: 'Driver',             icon: '🚛', desc: 'Deliver goods & earn income'    },
  { value: 'transporter',       api: 'transporter', label: 'Transporter',        icon: '🏭', desc: 'Own vehicles, provide transport'},
];

// ─── Kenya counties (all 47) ──────────────────────────────────────────────────
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa',
  'Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi',
  'Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos',
  'Makueni','Mandera','Marsabit','Meru','Migori','Mombasa',"Murang'a",
  'Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri',
  'Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia',
  'Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

// ─── NTSA Licence classes ─────────────────────────────────────────────────────
const LICENSE_CLASSES = ['A','B','C','D','E','F','G'];

// ─── Countries (flag + dial code) ────────────────────────────────────────────
const COUNTRIES = [
  { code: 'KE', name: 'Kenya',          dial: '+254', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda',         dial: '+256', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania',       dial: '+255', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda',         dial: '+250', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia',       dial: '+251', flag: '🇪🇹' },
  { code: 'SS', name: 'South Sudan',    dial: '+211', flag: '🇸🇸' },
  { code: 'SO', name: 'Somalia',        dial: '+252', flag: '🇸🇴' },
  { code: 'BI', name: 'Burundi',        dial: '+257', flag: '🇧🇮' },
  { code: 'CD', name: 'DR Congo',       dial: '+243', flag: '🇨🇩' },
  { code: 'NG', name: 'Nigeria',        dial: '+234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',          dial: '+233', flag: '🇬🇭' },
  { code: 'ZA', name: 'South Africa',   dial: '+27',  flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt',          dial: '+20',  flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco',        dial: '+212', flag: '🇲🇦' },
  { code: 'SN', name: 'Senegal',        dial: '+221', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire",  dial: '+225', flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroon',       dial: '+237', flag: '🇨🇲' },
  { code: 'ZM', name: 'Zambia',         dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe',       dial: '+263', flag: '🇿🇼' },
  { code: 'MZ', name: 'Mozambique',     dial: '+258', flag: '🇲🇿' },
  { code: 'AO', name: 'Angola',         dial: '+244', flag: '🇦🇴' },
  { code: 'MG', name: 'Madagascar',     dial: '+261', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi',         dial: '+265', flag: '🇲🇼' },
  { code: 'BW', name: 'Botswana',       dial: '+267', flag: '🇧🇼' },
  { code: 'NA', name: 'Namibia',        dial: '+264', flag: '🇳🇦' },
  { code: 'IN', name: 'India',          dial: '+91',  flag: '🇮🇳' },
  { code: 'CN', name: 'China',          dial: '+86',  flag: '🇨🇳' },
  { code: 'AE', name: 'UAE',            dial: '+971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '+44',  flag: '🇬🇧' },
  { code: 'US', name: 'United States',  dial: '+1',   flag: '🇺🇸' },
  { code: 'DE', name: 'Germany',        dial: '+49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',         dial: '+33',  flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',          dial: '+39',  flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands',    dial: '+31',  flag: '🇳🇱' },
  { code: 'SG', name: 'Singapore',      dial: '+65',  flag: '🇸🇬' },
  { code: 'AU', name: 'Australia',      dial: '+61',  flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',         dial: '+1',   flag: '🇨🇦' },
  { code: 'BR', name: 'Brazil',         dial: '+55',  flag: '🇧🇷' },
  { code: 'JP', name: 'Japan',          dial: '+81',  flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea',    dial: '+82',  flag: '🇰🇷' },
  { code: 'PK', name: 'Pakistan',       dial: '+92',  flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh',     dial: '+880', flag: '🇧🇩' },
  { code: 'PH', name: 'Philippines',    dial: '+63',  flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia',      dial: '+62',  flag: '🇮🇩' },
];

export default function Register() {
  const navigate = useNavigate();

  const [step, setStep]         = useState(1);
  const [role, setRole]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false); // ✅ T&C

  const [form, setForm] = useState({
    full_name:         '',
    email:             '',
    phone:             '',
    password:          '',
    confirm:           '',
    country:           'KE',
    county:            '',
    national_id:       '',
    company_name:      '',
    business_reg_no:   '',
    kra_pin:           '',
    license_number:    '',
    license_class:     '',
    license_expiry:    '',
    agency_type:       '',
    emergency_name:    '',  // ✅ Emergency contact name
    emergency_phone:   '',  // ✅ Emergency contact phone
    emergency_relation:'',  // ✅ Relationship to driver
  });

  // ─── Derived flags ────────────────────────────────────────────────────────────
  const isCompany     = role && ['customer_business', 'transporter', 'agent'].includes(role.value);
  const needNatID     = role && ['driver', 'transporter', 'customer_personal'].includes(role.value);
  const isDriver      = role?.value === 'driver';
  const isTransporter = role?.value === 'transporter';
  const isAgent       = role?.value === 'agent';
  const isKenya       = form.country === 'KE';

  const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0];
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6)       { setError('Password must be at least 6 characters.'); return; }
    if (!form.phone.trim())             { setError('Phone number is required.'); return; }
    if (!agreedToTerms)                 { setError('Please accept the Terms & Conditions to continue.'); return; }

    setLoading(true);
    try {
      await api.post('/api/v1/auth/register', {
        full_name:    form.full_name.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim(),
        password:     form.password,
        role:         role.api,
        account_type: role.value,
        country:      form.country,
        ...(form.county            && { county:            form.county.trim()            }),
        ...(form.national_id       && { national_id:       form.national_id.trim()       }),
        ...(form.company_name      && { company_name:      form.company_name.trim()      }),
        ...(form.business_reg_no   && { business_reg_no:   form.business_reg_no.trim()   }),
        ...(form.kra_pin           && { kra_pin:           form.kra_pin.trim()           }),
        ...(form.license_number    && { license_number:    form.license_number.trim()    }),
        ...(form.license_class     && { license_class:     form.license_class            }),
        ...(form.license_expiry    && { license_expiry:    form.license_expiry           }),
        ...(form.agency_type       && { agency_type:       form.agency_type              }),
        ...(form.emergency_name    && { emergency_contact: `${form.emergency_name} (${form.emergency_relation}) — ${form.emergency_phone}` }),
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const S = {
    wrapper: {
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0f121c',
      fontFamily: 'system-ui', padding: 16,
    },
    card: {
      width: '100%', maxWidth: 440, background: '#181e2d',
      borderRadius: 18, padding: '32px 28px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
    },
    title:      { fontSize: 22, fontWeight: 800, color: '#e8eaf2', textAlign: 'center', marginBottom: 4 },
    sub:        { fontSize: 13, color: '#8892a4', textAlign: 'center', marginBottom: 24 },
    label:      { fontSize: 12, color: '#8892a4', marginBottom: 6, display: 'block' },
    hint:       { fontSize: 11, color: '#545f73', marginTop: 4 },
    inputGroup: { marginBottom: 14 },
    input: {
      width: '100%', padding: '11px 13px', fontSize: 14,
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#e8eaf2', boxSizing: 'border-box',
    },
    select: {
      width: '100%', padding: '11px 13px', fontSize: 14,
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#e8eaf2', boxSizing: 'border-box',
    },
    inputRow:   { display: 'flex', gap: 8 },
    showBtn: {
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      color: '#8892a4', borderRadius: 8, padding: '0 14px',
      cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    },
    primaryBtn: {
      width: '100%', padding: '13px', background: '#e8a020',
      border: 'none', borderRadius: 8, fontWeight: 700,
      fontSize: 15, color: '#0f121c', cursor: 'pointer', marginTop: 4,
    },
    ghostBtn: {
      width: '100%', padding: '11px', marginTop: 10,
      background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#8892a4', fontSize: 13, cursor: 'pointer',
    },
    error: {
      color: '#ef4444', fontSize: 13, marginBottom: 14,
      background: 'rgba(239,68,68,0.09)', padding: '9px 12px',
      borderRadius: 8, borderLeft: '3px solid #ef4444',
    },
    footer:     { marginTop: 20, textAlign: 'center', fontSize: 12, color: '#545f73' },
    link:       { color: '#e8a020', cursor: 'pointer', fontWeight: 600 },
    roleGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
    roleCard: (active) => ({
      padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
      border: active ? '2px solid #e8a020' : '1.5px solid rgba(255,255,255,0.08)',
      background: active ? 'rgba(232,160,32,0.08)' : '#111621',
      transition: 'all 0.18s', textAlign: 'left',
    }),
    roleIcon:  { fontSize: 22, marginBottom: 6, display: 'block' },
    roleLabel: { fontSize: 13, fontWeight: 700, color: '#e8eaf2', marginBottom: 3 },
    roleDesc:  { fontSize: 11, color: '#545f73', lineHeight: 1.4 },
    selectedBadge: {
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(232,160,32,0.08)',
      border: '1px solid rgba(232,160,32,0.25)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 20,
    },
    divider:      { height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' },
    sectionTitle: {
      fontSize: 11, fontWeight: 700, color: '#545f73',
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
    },
    infoBox: {
      background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.15)',
      borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: '#8892a4',
    },
    // T&C checkbox row
    checkRow: {
      display: 'flex', alignItems: 'flex-start', gap: 10,
      marginBottom: 16, marginTop: 4,
    },
    checkBox: { width: 16, height: 16, marginTop: 2, cursor: 'pointer', accentColor: '#e8a020' },
    checkLabel: { fontSize: 12, color: '#8892a4', lineHeight: 1.5 },
  };

  // ─── STEP 1: Role selection ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={S.wrapper}>
        <div style={S.card}>
          <div style={S.title}>VG Logistics</div>
          <div style={S.sub}>Create your account — select your role</div>
          <div style={S.roleGrid}>
            {ROLES.map(r => (
              <button key={r.value} style={S.roleCard(role?.value === r.value)} onClick={() => setRole(r)}>
                <span style={S.roleIcon}>{r.icon}</span>
                <div style={S.roleLabel}>{r.label}</div>
                <div style={S.roleDesc}>{r.desc}</div>
              </button>
            ))}
          </div>
          <button style={{ ...S.primaryBtn, opacity: role ? 1 : 0.4 }} disabled={!role} onClick={() => role && setStep(2)}>
            Continue →
          </button>
          <div style={S.footer}>
            Already have an account?{' '}
            <span style={S.link} onClick={() => navigate('/login')}>Sign In</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── STEP 3: Success ──────────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={S.wrapper}>
        <div style={S.card}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf2', textAlign: 'center', marginBottom: 10 }}>
            Registration Successful!
          </div>
          <div style={{ fontSize: 13, color: '#8892a4', textAlign: 'center', lineHeight: 1.7, marginBottom: 24 }}>
            Your account has been created. An admin will review and approve your profile.
            You can log in now and check your approval status.
          </div>
          <div style={{ background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: '#e8a020', fontWeight: 700, marginBottom: 4 }}>What happens next?</div>
            <div style={{ fontSize: 12, color: '#8892a4', lineHeight: 1.7 }}>
              1. Admin reviews your details<br />
              2. You receive a notification on approval<br />
              3. Full access unlocked after approval
            </div>
          </div>
          <button style={S.primaryBtn} onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>
    );
  }

  // ─── STEP 2: Registration form ────────────────────────────────────────────────
  return (
    <div style={S.wrapper}>
      <div style={{ ...S.card, maxHeight: '95vh', overflowY: 'auto' }}>
        <div style={S.title}>VG Logistics</div>
        <div style={S.sub}>Fill in your details to get started</div>

        {/* Selected role badge */}
        <div style={S.selectedBadge}>
          <span style={{ fontSize: 20 }}>{role.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e8a020' }}>{role.label}</div>
            <div style={{ fontSize: 11, color: '#545f73' }}>{role.desc}</div>
          </div>
          <button onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#545f73', fontSize: 12, cursor: 'pointer' }}>
            Change
          </button>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit}>

          {/* ── Personal Info ── */}
          <div style={S.sectionTitle}>Personal Information</div>

          <div style={S.inputGroup}>
            <label style={S.label}>Full Legal Name</label>
            <input type="text" style={S.input} value={form.full_name}
              onChange={set('full_name')} placeholder="As per National ID / Passport" required />
          </div>

          <div style={S.inputGroup}>
            <label style={S.label}>Email Address</label>
            <input type="email" style={S.input} value={form.email}
              onChange={set('email')} placeholder="you@example.com" required />
          </div>

          {/* Country selector */}
          <div style={S.inputGroup}>
            <label style={S.label}>Country</label>
            <select style={S.select} value={form.country} onChange={set('country')}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dial})</option>
              ))}
            </select>
          </div>

          {/* Kenya county — only when Kenya selected */}
          {isKenya && (
            <div style={S.inputGroup}>
              <label style={S.label}>County</label>
              <select style={S.select} value={form.county} onChange={set('county')}>
                <option value="">Select county</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Phone with dial code prefix */}
          <div style={S.inputGroup}>
            <label style={S.label}>Phone Number {isKenya ? '(M-Pesa registered)' : ''}</label>
            <div style={S.inputRow}>
              <input type="text" style={{ ...S.input, width: 80, flex: 'none', color: '#8892a4', textAlign: 'center' }}
                value={selectedCountry.dial} readOnly />
              <input type="tel" style={{ ...S.input, flex: 1 }} value={form.phone}
                onChange={set('phone')} placeholder="712 345 678" required />
            </div>
            {isKenya && <div style={S.hint}>Must be your M-Pesa registered number</div>}
          </div>

          {/* National ID */}
          {needNatID && (
            <div style={S.inputGroup}>
              <label style={S.label}>National ID / Passport Number</label>
              <input type="text" style={S.input} value={form.national_id}
                onChange={set('national_id')} placeholder="Enter your ID number" required />
            </div>
          )}

          {/* ── Business / Agent / Transporter fields ── */}
          {isCompany && (
            <>
              <div style={S.divider} />
              <div style={S.sectionTitle}>{isAgent ? 'Agency Details' : isTransporter ? 'Business Details' : 'Company Details'}</div>

              <div style={S.inputGroup}>
                <label style={S.label}>{isAgent ? 'Agency / Company Name' : 'Company Name'}</label>
                <input type="text" style={S.input} value={form.company_name}
                  onChange={set('company_name')} placeholder="Registered company name" required />
              </div>

              <div style={S.inputGroup}>
                <label style={S.label}>Business Registration Number</label>
                <input type="text" style={S.input} value={form.business_reg_no}
                  onChange={set('business_reg_no')}
                  placeholder={isKenya ? 'Certificate of Incorporation No.' : 'Company registration number'} />
                {isKenya && <div style={S.hint}>From your Certificate of Incorporation or Business Name Registration</div>}
              </div>

              {isKenya && (
                <div style={S.inputGroup}>
                  <label style={S.label}>KRA PIN</label>
                  <input type="text" style={S.input} value={form.kra_pin}
                    onChange={set('kra_pin')} placeholder="e.g. P051234567X" />
                  <div style={S.hint}>Kenya Revenue Authority PIN — required for tax compliance</div>
                </div>
              )}

              {isAgent && (
                <div style={S.inputGroup}>
                  <label style={S.label}>Agency Type</label>
                  <select style={S.select} value={form.agency_type} onChange={set('agency_type')}>
                    <option value="">Select agency type</option>
                    <option value="logistics">Logistics Agent</option>
                    <option value="freight">Freight Forwarder</option>
                    <option value="clearing">Clearing Agent</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* ── Driver fields ── */}
          {isDriver && (
            <>
              <div style={S.divider} />
              <div style={S.sectionTitle}>Driver Details</div>

              {isKenya && (
                <div style={S.infoBox}>
                  🪪 Your driving licence will be verified with NTSA before activation.
                </div>
              )}

              <div style={S.inputGroup}>
                <label style={S.label}>Driving Licence Number</label>
                <input type="text" style={S.input} value={form.license_number}
                  onChange={set('license_number')}
                  placeholder={isKenya ? 'NTSA licence number' : 'Driving licence number'} required />
              </div>

              <div style={S.inputRow}>
                <div style={{ ...S.inputGroup, flex: 1 }}>
                  <label style={S.label}>Licence Class</label>
                  <select style={S.select} value={form.license_class} onChange={set('license_class')} required>
                    <option value="">Select class</option>
                    {LICENSE_CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                  </select>
                </div>
                <div style={{ ...S.inputGroup, flex: 1 }}>
                  <label style={S.label}>Licence Expiry</label>
                  <input type="date" style={S.input} value={form.license_expiry}
                    onChange={set('license_expiry')} required />
                </div>
              </div>

              {isKenya && (
                <div style={S.inputGroup}>
                  <label style={S.label}>KRA PIN (optional)</label>
                  <input type="text" style={S.input} value={form.kra_pin}
                    onChange={set('kra_pin')} placeholder="e.g. P051234567X" />
                </div>
              )}

              {/* ✅ Emergency contact — required for drivers */}
              <div style={S.divider} />
              <div style={S.sectionTitle}>Emergency Contact</div>
              <div style={S.infoBox}>
                🚨 Required for safety — in case of accidents or emergencies on the road.
              </div>

              <div style={S.inputGroup}>
                <label style={S.label}>Contact Full Name</label>
                <input type="text" style={S.input} value={form.emergency_name}
                  onChange={set('emergency_name')} placeholder="Full name of emergency contact" required />
              </div>

              <div style={S.inputRow}>
                <div style={{ ...S.inputGroup, flex: 1 }}>
                  <label style={S.label}>Phone Number</label>
                  <input type="tel" style={S.input} value={form.emergency_phone}
                    onChange={set('emergency_phone')} placeholder="+254 7XX XXX XXX" required />
                </div>
                <div style={{ ...S.inputGroup, flex: 1 }}>
                  <label style={S.label}>Relationship</label>
                  <select style={S.select} value={form.emergency_relation} onChange={set('emergency_relation')} required>
                    <option value="">Select</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── Transporter KRA ── */}
          {isTransporter && isKenya && (
            <>
              <div style={S.divider} />
              <div style={S.sectionTitle}>Owner Identification</div>
              <div style={S.inputGroup}>
                <label style={S.label}>KRA PIN</label>
                <input type="text" style={S.input} value={form.kra_pin}
                  onChange={set('kra_pin')} placeholder="e.g. P051234567X" />
                <div style={S.hint}>Required for payment processing and tax compliance</div>
              </div>
            </>
          )}

          {/* ── Password ── */}
          <div style={S.divider} />
          <div style={S.sectionTitle}>Account Security</div>

          <div style={S.inputGroup}>
            <label style={S.label}>Password</label>
            <div style={S.inputRow}>
              <input type={showPass ? 'text' : 'password'} style={{ ...S.input, flex: 1 }}
                value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required />
              <button type="button" style={S.showBtn} onClick={() => setShowPass(v => !v)}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={S.inputGroup}>
            <label style={S.label}>Confirm Password</label>
            <input type={showPass ? 'text' : 'password'} style={S.input}
              value={form.confirm} onChange={set('confirm')} placeholder="Re-enter password" required />
          </div>

          {/* ✅ Terms & Conditions checkbox */}
          <div style={S.checkRow}>
            <input
              type="checkbox"
              id="terms"
              style={S.checkBox}
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
            />
            <label htmlFor="terms" style={S.checkLabel}>
              I agree to the{' '}
              <span
                style={{ color: '#e8a020', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => navigate('/terms', { state: { from: 'register-step-2' } })}
              >
                Terms & Conditions
              </span>
              {' '}and{' '}
              <span
                style={{ color: '#e8a020', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => navigate('/privacy?from=register&step=2')}
              >
                Privacy Policy
              </span>
              {' '}of VG Global Logistics
            </label>
          </div>

          <button type="submit" style={{ ...S.primaryBtn, opacity: (loading || !agreedToTerms) ? 0.7 : 1 }} disabled={loading || !agreedToTerms}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <button type="button" style={S.ghostBtn} onClick={() => setStep(1)}>
            ← Back
          </button>

        </form>

        <div style={S.footer}>
          Already have an account?{' '}
          <span style={S.link} onClick={() => navigate('/login')}>Sign In</span>
        </div>
      </div>
    </div>
  );
}