import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  const S = {
    wrapper: {
      minHeight: '100vh', background: '#0f121c',
      fontFamily: 'system-ui', padding: '40px 16px',
    },
    container: {
      maxWidth: 780, margin: '0 auto',
      background: '#181e2d', borderRadius: 16,
      padding: '40px 48px', boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
    },
    header: { marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 24 },
    logo:   { fontSize: 20, fontWeight: 800, color: '#e8a020', marginBottom: 8 },
    title:  { fontSize: 28, fontWeight: 800, color: '#e8eaf2', marginBottom: 8 },
    date:   { fontSize: 13, color: '#545f73' },
    h2:     { fontSize: 18, fontWeight: 700, color: '#e8a020', margin: '28px 0 12px' },
    h3:     { fontSize: 15, fontWeight: 700, color: '#e8eaf2', margin: '20px 0 8px' },
    p:      { fontSize: 14, color: '#8892a4', lineHeight: 1.8, marginBottom: 12 },
    li:     { fontSize: 14, color: '#8892a4', lineHeight: 1.8, marginBottom: 6, paddingLeft: 16 },
    ul:     { paddingLeft: 16, marginBottom: 12 },
    backBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
      color: '#8892a4', padding: '8px 16px', borderRadius: 8,
      cursor: 'pointer', fontSize: 13, marginBottom: 32,
    },
    highlight: { color: '#e8a020', fontWeight: 600 },
    divider:   { height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0' },
    infoBox: {
      background: 'rgba(232,160,32,0.06)', border: '1px solid rgba(232,160,32,0.15)',
      borderRadius: 10, padding: '14px 18px', marginBottom: 20,
      fontSize: 13, color: '#8892a4', lineHeight: 1.7,
    },
  };

  return (
    <div style={S.wrapper}>
      <div style={S.container}>

        <button style={S.backBtn} onClick={() => navigate('/register?step=2')}>
          ← Back
        </button>

        <div style={S.header}>
          <div style={S.logo}>VG Global Logistics</div>
          <div style={S.title}>Privacy Policy</div>
          <div style={S.date}>Last updated: March 2026 · Compliant with Kenya Data Protection Act 2019</div>
        </div>

        <div style={S.infoBox}>
          🔒 VG Global Logistics is committed to protecting your personal data. This Privacy Policy
          explains what data we collect, how we use it, and your rights under the Kenya Data
          Protection Act 2019 (DPA).
        </div>

        <h2 style={S.h2}>1. Who We Are</h2>
        <p style={S.p}>
          VG Global Logistics Kenya is the Data Controller responsible for your personal data
          collected through our platform. Contact our Data Protection Officer at:{' '}
          <span style={S.highlight}>privacy@vglogistics.co.ke</span>
        </p>

        <h2 style={S.h2}>2. Data We Collect</h2>
        <h3 style={S.h3}>2.1 Registration Data</h3>
        <ul style={S.ul}>
          <li style={S.li}>Full legal name, email address, phone number</li>
          <li style={S.li}>National ID / Passport number (for identity verification)</li>
          <li style={S.li}>KRA PIN (for business customers and drivers in Kenya)</li>
          <li style={S.li}>Driving licence details (for drivers)</li>
          <li style={S.li}>Company registration details (for business accounts)</li>
          <li style={S.li}>Emergency contact information (for drivers)</li>
        </ul>

        <h3 style={S.h3}>2.2 Operational Data</h3>
        <ul style={S.ul}>
          <li style={S.li}>Pickup and delivery addresses for bookings</li>
          <li style={S.li}>GPS location data during active trips (drivers only)</li>
          <li style={S.li}>Booking history, trip details, and payment records</li>
          <li style={S.li}>Proof of delivery photos and digital signatures</li>
          <li style={S.li}>Communication records between users and support</li>
        </ul>

        <h3 style={S.h3}>2.3 Technical Data</h3>
        <ul style={S.ul}>
          <li style={S.li}>IP address, device type, browser type</li>
          <li style={S.li}>Login timestamps and session activity</li>
          <li style={S.li}>App usage patterns and feature interactions</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>3. How We Use Your Data</h2>
        <ul style={S.ul}>
          <li style={S.li}><span style={S.highlight}>Service delivery</span> — Processing bookings, assigning drivers, tracking deliveries</li>
          <li style={S.li}><span style={S.highlight}>Identity verification</span> — Confirming user identities and documents during registration</li>
          <li style={S.li}><span style={S.highlight}>Payments</span> — Processing M-Pesa, cash, and credit transactions</li>
          <li style={S.li}><span style={S.highlight}>Communication</span> — Sending OTP codes, booking confirmations, and service updates</li>
          <li style={S.li}><span style={S.highlight}>Safety & Security</span> — Preventing fraud, detecting suspicious activity</li>
          <li style={S.li}><span style={S.highlight}>Legal compliance</span> — Meeting KRA, NTSA, and other regulatory requirements</li>
          <li style={S.li}><span style={S.highlight}>Platform improvement</span> — Analyzing usage patterns to improve our services</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>4. Legal Basis for Processing</h2>
        <p style={S.p}>We process your data under the following legal bases (Kenya DPA 2019):</p>
        <ul style={S.ul}>
          <li style={S.li}><span style={S.highlight}>Consent</span> — You agreed to our Terms & Conditions at registration</li>
          <li style={S.li}><span style={S.highlight}>Contract performance</span> — To fulfill the logistics services you requested</li>
          <li style={S.li}><span style={S.highlight}>Legal obligation</span> — To comply with Kenyan law (tax, transport regulations)</li>
          <li style={S.li}><span style={S.highlight}>Legitimate interest</span> — To prevent fraud and ensure platform safety</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>5. Data Sharing</h2>
        <p style={S.p}>We share your data only when necessary:</p>
        <ul style={S.ul}>
          <li style={S.li}><span style={S.highlight}>Drivers</span> — Customers' pickup/delivery addresses and contact for active trips only</li>
          <li style={S.li}><span style={S.highlight}>Customers</span> — Driver name, photo, vehicle details, and phone for active trips only</li>
          <li style={S.li}><span style={S.highlight}>Safaricom</span> — Phone number and amount for M-Pesa payment processing</li>
          <li style={S.li}><span style={S.highlight}>Government authorities</span> — When legally required (court orders, regulatory compliance)</li>
          <li style={S.li}><span style={S.highlight}>Service providers</span> — Cloud infrastructure, database, and email delivery providers under Data Processing Agreements</li>
        </ul>
        <p style={S.p}>We do <span style={S.highlight}>NOT</span> sell your personal data to third parties for marketing purposes.</p>

        <div style={S.divider} />

        <h2 style={S.h2}>6. GPS & Location Data</h2>
        <p style={S.p}>
          Driver GPS location is tracked only during active trips. Location data is used to:
          show customers real-time delivery progress, detect route deviations, and ensure
          delivery completion. Location tracking stops when a trip is completed or cancelled.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>7. Data Retention</h2>
        <ul style={S.ul}>
          <li style={S.li}>Account data — retained while account is active + 3 years after closure</li>
          <li style={S.li}>Trip records — retained for 7 years (tax/legal compliance)</li>
          <li style={S.li}>Payment records — retained for 7 years (KRA requirement)</li>
          <li style={S.li}>GPS location history — retained for 90 days then deleted</li>
          <li style={S.li}>OTP codes — deleted immediately after use or expiry</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>8. Your Rights (Kenya DPA 2019)</h2>
        <p style={S.p}>You have the following rights regarding your personal data:</p>
        <ul style={S.ul}>
          <li style={S.li}><span style={S.highlight}>Right to access</span> — Request a copy of all data we hold about you</li>
          <li style={S.li}><span style={S.highlight}>Right to rectification</span> — Request correction of inaccurate data</li>
          <li style={S.li}><span style={S.highlight}>Right to erasure</span> — Request deletion of your data (subject to legal retention requirements)</li>
          <li style={S.li}><span style={S.highlight}>Right to data portability</span> — Receive your data in a structured, machine-readable format</li>
          <li style={S.li}><span style={S.highlight}>Right to object</span> — Object to certain types of processing</li>
          <li style={S.li}><span style={S.highlight}>Right to withdraw consent</span> — Withdraw consent at any time (does not affect past processing)</li>
        </ul>
        <p style={S.p}>
          To exercise any of these rights, email us at{' '}
          <span style={S.highlight}>privacy@vglogistics.co.ke</span>.
          We will respond within 30 days.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>9. Data Security</h2>
        <p style={S.p}>
          We implement industry-standard security measures including HTTPS encryption,
          bcrypt password hashing, JWT token authentication, and rate limiting.
          All sensitive data is stored in encrypted databases hosted in secure cloud environments.
        </p>
        <p style={S.p}>
          In the event of a data breach affecting your personal data, we will notify you
          within 72 hours as required by the Kenya Data Protection Act 2019.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>10. Cookies & Tracking</h2>
        <p style={S.p}>
          Our web platform uses browser localStorage to store your authentication token
          (JWT) for session management. No third-party advertising cookies are used.
          We use basic analytics to improve platform performance.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>11. Children's Privacy</h2>
        <p style={S.p}>
          Our platform is not intended for persons under 18 years of age. We do not
          knowingly collect data from minors. If you believe a minor has registered,
          contact us immediately.
        </p>

        <h2 style={S.h2}>12. Changes to This Policy</h2>
        <p style={S.p}>
          We may update this Privacy Policy periodically. We will notify registered users
          of significant changes via email. Continued use of the platform after changes
          constitutes acceptance of the updated policy.
        </p>

        <h2 style={S.h2}>13. Contact & Complaints</h2>
        <p style={S.p}>
          For privacy-related questions or complaints:<br />
          📧 <span style={S.highlight}>privacy@vglogistics.co.ke</span><br />
          📞 <span style={S.highlight}>+254 700 000 000</span><br />
          🏢 VG Global Logistics Kenya, Nairobi, Kenya
        </p>
        <p style={S.p}>
          You may also file a complaint with the{' '}
          <span style={S.highlight}>Office of the Data Protection Commissioner (ODPC)</span> Kenya
          if you believe your data rights have been violated.
        </p>

        <div style={S.divider} />

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button style={{ ...S.backBtn, margin: '0 auto' }} onClick={() => navigate('/register?step=2')}>
           ← Go Back
          </button>
        </div>

      </div>
    </div>
  );
}
