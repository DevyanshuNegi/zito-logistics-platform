import { useNavigate } from 'react-router-dom';

export default function Terms() {
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
    divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px 0' },
  };

  return (
    <div style={S.wrapper}>
      <div style={S.container}>

        <button style={S.backBtn} onClick={() => navigate('/register?step=2')}>
          ← Back
        </button>

        <div style={S.header}>
          <div style={S.logo}>ZITO</div>
          <div style={S.title}>Terms & Conditions</div>
          <div style={S.date}>Last updated: March 2026 · Effective immediately upon registration</div>
        </div>

        <p style={S.p}>
          Welcome to ZITO Kenya. By registering, accessing, or using our platform
          (website, mobile application, or API), you agree to be bound by these Terms & Conditions.
          Please read them carefully before using our services.
        </p>

        <h2 style={S.h2}>1. About ZITO (VG GLOBAL LOGISTICS)</h2>
        <p style={S.p}>
          ZITO (VG GLOBAL LOGISTICS) is a technology platform that connects customers, agents, drivers,
          and transporters to facilitate logistics and delivery services across Kenya and East Africa.
          We operate as an intermediary between service providers and customers.
        </p>

        <h2 style={S.h2}>2. User Accounts & Registration</h2>
        <h3 style={S.h3}>2.1 Eligibility</h3>
        <p style={S.p}>You must be at least 18 years old to register on this platform. By registering, you confirm that all information provided is accurate, current, and complete.</p>

        <h3 style={S.h3}>2.2 Account Types</h3>
        <ul style={S.ul}>
          <li style={S.li}><span style={S.highlight}>Customer</span> — Personal or business customers booking delivery services</li>
          <li style={S.li}><span style={S.highlight}>Driver</span> — Licensed drivers providing delivery services</li>
          <li style={S.li}><span style={S.highlight}>Transporter</span> — Fleet owners providing vehicles and drivers</li>
          <li style={S.li}><span style={S.highlight}>Agent</span> — Logistics agents booking on behalf of multiple customers</li>
        </ul>

        <h3 style={S.h3}>2.3 Account Approval</h3>
        <p style={S.p}>
          All accounts require admin approval before full access is granted. We reserve the right
          to reject, suspend, or terminate any account at our discretion if terms are violated or
          documentation is found to be fraudulent.
        </p>

        <h3 style={S.h3}>2.4 Account Security</h3>
        <p style={S.p}>
          You are responsible for maintaining the confidentiality of your login credentials.
          Do not share your password or OTP with anyone. Notify us immediately at{' '}
          <span style={S.highlight}>support@ZITO.co.ke</span> if you suspect unauthorized access.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>3. Services</h2>
        <h3 style={S.h3}>3.1 Booking Services</h3>
        <p style={S.p}>
          ZITO facilitates logistics bookings including on-demand delivery,
          scheduled delivery, multi-stop deliveries, and cross-border shipments within the EAC region.
        </p>

        <h3 style={S.h3}>3.2 Service Availability</h3>
        <p style={S.p}>
          Services are available subject to driver availability, service area coverage, and
          operational hours. We do not guarantee immediate availability at all times.
        </p>

        <h3 style={S.h3}>3.3 Cargo Restrictions</h3>
        <p style={S.p}>The following items are strictly prohibited from being transported on our platform:</p>
        <ul style={S.ul}>
          <li style={S.li}>Illegal substances, narcotics, or controlled drugs</li>
          <li style={S.li}>Weapons, ammunition, or explosives</li>
          <li style={S.li}>Stolen goods or goods of illegal origin</li>
          <li style={S.li}>Hazardous materials without proper licensing and declaration</li>
          <li style={S.li}>Live animals without proper documentation</li>
          <li style={S.li}>Counterfeit goods or intellectual property violations</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>4. Payments & Pricing</h2>
        <h3 style={S.h3}>4.1 Payment Methods</h3>
        <p style={S.p}>
          Payment methods (Cash, M-Pesa, or Credit Terms) are assigned by administrators based
          on your contract type and creditworthiness. Customers cannot unilaterally change their
          assigned payment method.
        </p>

        <h3 style={S.h3}>4.2 Pricing</h3>
        <p style={S.p}>
          Prices are calculated based on distance, vehicle type, cargo weight, time of day,
          and applicable surcharges. All prices are displayed in Kenya Shillings (KES) and
          include applicable taxes unless otherwise stated.
        </p>

        <h3 style={S.h3}>4.3 Cancellation Policy</h3>
        <p style={S.p}>
          Bookings may be cancelled before a driver is assigned without charge. Cancellations
          after driver assignment may attract a cancellation fee. Trips in transit cannot be cancelled.
        </p>

        <h3 style={S.h3}>4.4 Refunds</h3>
        <p style={S.p}>
          Refund requests must be submitted within 7 days of the disputed transaction.
          Approved refunds will be processed within 5-10 business days to the original payment method.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>5. Driver & Transporter Obligations</h2>
        <ul style={S.ul}>
          <li style={S.li}>Maintain valid driving licence, insurance, and vehicle documentation at all times</li>
          <li style={S.li}>Treat customers and their cargo with professionalism and care</li>
          <li style={S.li}>Follow all traffic laws and road safety regulations</li>
          <li style={S.li}>Report any incidents, accidents, or cargo damage immediately</li>
          <li style={S.li}>Not misuse customer contact information provided through the platform</li>
          <li style={S.li}>Submit accurate Proof of Delivery documentation</li>
        </ul>

        <div style={S.divider} />

        <h2 style={S.h2}>6. Liability & Disclaimers</h2>
        <h3 style={S.h3}>6.1 Cargo Insurance</h3>
        <p style={S.p}>
          VG Global Logistics is not automatically liable for cargo loss or damage.
          Customers are encouraged to declare high-value goods and purchase cargo insurance
          as an add-on service at the time of booking.
        </p>

        <h3 style={S.h3}>6.2 Platform Liability</h3>
        <p style={S.p}>
          We are not liable for delays caused by traffic, weather, civil unrest, or other
          circumstances beyond our control. Our liability is limited to the value of the
          transportation service fee paid for the affected trip.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>7. Data Protection</h2>
        <p style={S.p}>
          We collect and process your personal data in accordance with the Kenya Data Protection
          Act 2019. For full details on how we handle your data, please read our{' '}
          <span style={{ ...S.highlight, cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate('/privacy?step=2')}>
            Privacy Policy
          </span>.
        </p>

        <div style={S.divider} />

        <h2 style={S.h2}>8. Termination</h2>
        <p style={S.p}>
          We reserve the right to suspend or terminate accounts that violate these terms,
          engage in fraudulent activity, or pose a risk to other users or the platform.
          Users may also close their accounts by contacting support.
        </p>

        <h2 style={S.h2}>9. Governing Law</h2>
        <p style={S.p}>
          These Terms & Conditions are governed by the laws of Kenya. Any disputes shall be
          subject to the jurisdiction of Kenyan courts.
        </p>

        <h2 style={S.h2}>10. Contact Us</h2>
        <p style={S.p}>
          For questions about these Terms, contact us at:<br />
          📧 <span style={S.highlight}>legal@ZITO.co.ke</span><br />
          📞 <span style={S.highlight}>+254 700 000 000</span><br />
          🏢 VG Global Logistics Kenya, Nairobi, Kenya
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