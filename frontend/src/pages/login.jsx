import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { getHomePathForRole, normalizeRole } from '../utils/roles';

// ─── 2FA Flow ─────────────────────────────────────────────────────────────────
//  Step 1 → Email/Mobile + Password  →  POST /api/v1/auth/login
//            If OK → auto sends OTP to email → moves to Step 2
//  Step 2 → Enter OTP                →  POST /api/v1/auth/verify-otp
//            Returns { data: { user, accessToken } } → login complete
//
// ─── FIX for "Illegal arguments: string, undefined" ──────────────────────────
//  Root cause: your /api/v1/auth/login returns a token immediately, but login(user, token)
//  was receiving undefined for token because of wrong response shape assumption.
//  FIX: Password step no longer calls login() — only OTP verify does.
//       This also properly enforces 2FA (token only after OTP).

export default function Login() {

  const [loginType, setLoginType]       = useState('email'); // 'email' | 'mobile'
  const [email, setEmail]               = useState('');
  const [mobile, setMobile]             = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep]                 = useState(1);       // 1=password, 2=OTP
  const [otp, setOtp]                   = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading]     = useState(false);
  const [resendTimer, setResendTimer]   = useState(0);
  const [pendingUserId, setPendingUserId] = useState('');
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const getIdentifier = () =>
    loginType === 'email'
      ? { email: email.trim() }
      : { mobile: mobile.trim() };

  // Tries all known API response shapes
  const extractAuthData = (resData) => {
    // Shape: { data: { user, accessToken } }  ← preferred
    if (resData?.data?.user && resData?.data?.accessToken)
      return { userData: resData.data.user, token: resData.data.accessToken };

    // Shape: { data: { user, token } }  ← backend compatibility
    if (resData?.data?.user && resData?.data?.token)
      return { userData: resData.data.user, token: resData.data.token };

    // Shape: { user, accessToken }
    if (resData?.user && resData?.accessToken)
      return { userData: resData.user, token: resData.accessToken };

    // Shape: { user, token }
    if (resData?.user && resData?.token)
      return { userData: resData.user, token: resData.token };

    // Shape: { data: { data: { user, accessToken } } }
    if (resData?.data?.data?.user && resData?.data?.data?.accessToken)
      return { userData: resData.data.data.user, token: resData.data.data.accessToken };

    // Nothing matched — print actual shape so you know what to fix
    console.error('⚠️ Unknown API response shape:', JSON.stringify(resData, null, 2));
    throw new Error('Unexpected server response. Check browser console.');
  };

  const extractPendingUserId = (resData) => {
    return (
      resData?.data?.user?.id ||
      resData?.user?.id ||
      resData?.data?.data?.user?.id ||
      ''
    );
  };

  const getApiErrorMessage = (err, fallback) => {
    if (!err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')) {
      return 'Backend API unreachable. Start backend server and retry.';
    }
    return err.response?.data?.message || err.response?.data?.error?.message || err.message || fallback;
  };

  const handleRoleNavigation = (role) => {
    navigate(getHomePathForRole(normalizeRole(role)), { replace: true });
  };

  const startResendTimer = () => {
    setResendTimer(300);
    const id = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ─── OTP box controls ─────────────────────────────────────────────────────────

  const handleOtpChange = (i, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[i] = value;
    setOtp(next);
    if (value && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0)
      document.getElementById(`otp-${i - 1}`)?.focus();
  };

  // ─── Step 1: Verify password credentials ─────────────────────────────────────
  // NOTE: We deliberately ignore the token returned here.
  //       Token is only issued after OTP is verified (true 2FA).

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Just verify credentials — discard any token returned
      const loginRes = await api.post('/api/v1/auth/login', { ...getIdentifier(), password });
      setPendingUserId(extractPendingUserId(loginRes.data));

      // Backend /auth/login generates the initial login OTP.
      // Avoid second generation here to prevent OTP mismatch.
      startResendTimer();
      setStep(2);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Send / Resend OTP ────────────────────────────────────────────────────────

  const doSendOtp = async () => {
    setOtpLoading(true);
    try {
      const identifier = getIdentifier();

    await api.post('/api/v1/auth/send-otp', {
      ...(pendingUserId ? { user_id: pendingUserId } : { contact: identifier.email || identifier.mobile }),
      type: 'login',
    });
      setOtp(['', '', '', '', '', '']);
      startResendTimer();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to send OTP. Try again.');
      setError(msg);
      throw err; // re-throw so Step 1 knows to stop
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try { await doSendOtp(); } catch (_) {}
  };

  // ─── Step 2: Verify OTP → get token → login ───────────────────────────────────

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) { setError('Please enter all 6 digits.'); return; }

    setLoading(true);
    setError('');
    try {
    const identifier = getIdentifier();

      const res = await api.post('/api/v1/auth/verify-otp', {
        ...(pendingUserId ? { user_id: pendingUserId } : {}),
        contact: identifier.email || identifier.mobile, // 🔥 FIX
        otp: otpValue,
        type: 'login',
      });

      // ✅ This is the ONLY place login() is called — token is now guaranteed valid
      const { userData, token } = extractAuthData(res.data);
      login(userData, token);
      setPendingUserId('');
      handleRoleNavigation(userData.role);

    } catch (err) {
      setError(getApiErrorMessage(err, 'OTP verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────────────────

  const S = {
    wrapper: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f121c',
      fontFamily: 'system-ui',
      padding: 16,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      background: '#181e2d',
      borderRadius: 18,
      padding: '32px 28px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
    },
    title:  { fontSize: 22, fontWeight: 800, color: '#e8eaf2', textAlign: 'center', marginBottom: 4 },
    sub:    { fontSize: 13, color: '#8892a4', textAlign: 'center', marginBottom: 20 },

    // ── Step indicator ──
    stepRow:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 24, gap: 0 },
    stepGroup: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 },
    stepDot: (active, done) => ({
      width: 30, height: 30, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
      background: done ? '#22c55e' : active ? '#e8a020' : '#1e2636',
      color: (done || active) ? '#0f121c' : '#545f73',
      transition: 'all 0.25s',
    }),
    stepLabel: (active) => ({
      fontSize: 10, fontWeight: 600,
      color: active ? '#e8eaf2' : '#545f73',
      whiteSpace: 'nowrap',
    }),
    stepLine: (done) => ({
      width: 52, height: 2, margin: '14px 6px 0',
      background: done ? '#22c55e' : '#1e2636',
      transition: 'background 0.25s', flexShrink: 0,
    }),

    // ── Tabs ──
    tabs: {
      display: 'flex', background: '#111621', borderRadius: 10,
      padding: 4, marginBottom: 20, gap: 4,
    },
    tab: (active, disabled) => ({
      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
      border: 'none', borderRadius: 7,
      cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? '#e8a020' : 'transparent',
      color: active ? '#0f121c' : disabled ? '#3a4358' : '#8892a4',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.18s',
    }),

    label:      { fontSize: 12, color: '#8892a4', marginBottom: 6, display: 'block' },
    inputGroup: { marginBottom: 16 },
    input: {
      width: '100%', padding: '11px 13px', fontSize: 14,
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#e8eaf2', boxSizing: 'border-box',
    },
    inputRow: { display: 'flex', gap: 8 },
    showBtn: {
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      color: '#8892a4', borderRadius: 8, padding: '0 14px',
      cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    },

    // ── OTP boxes ──
    otpRow: { display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 },
    otpBox: {
      width: 46, height: 54, textAlign: 'center', fontSize: 22, fontWeight: 700,
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#e8eaf2', outline: 'none',
    },
    hint:       { fontSize: 12, color: '#545f73', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 },
    resend:     { textAlign: 'center', fontSize: 12, color: '#545f73', marginTop: 12 },
    resendLink: { color: '#e8a020', cursor: 'pointer', fontWeight: 600 },

    primaryBtn: {
      width: '100%', padding: '13px', background: '#e8a020',
      border: 'none', borderRadius: 8, fontWeight: 700,
      fontSize: 15, color: '#0f121c', cursor: 'pointer',
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
    footer:     { marginTop: 22, textAlign: 'center', fontSize: 12, color: '#545f73' },
    forgotLink: { color: '#e8a020', cursor: 'pointer', fontWeight: 600 },
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.wrapper}>
      <div style={S.card}>

        <div style={S.title}>ZITO</div>
        <div style={S.sub}>Sign in to your account</div>

        {/* ── Step indicator ── */}
        <div style={S.stepRow}>
          <div style={S.stepGroup}>
            <div style={S.stepDot(step === 1, step > 1)}>{step > 1 ? '✓' : '1'}</div>
            <span style={S.stepLabel(step === 1)}>Password</span>
          </div>
          <div style={S.stepLine(step > 1)} />
          <div style={S.stepGroup}>
            <div style={S.stepDot(step === 2, false)}>2</div>
            <span style={S.stepLabel(step === 2)}>Verify OTP</span>
          </div>
        </div>

        {/* ── Email / Mobile toggle (locked on step 2) ── */}
        <div style={S.tabs}>
          <button
            style={S.tab(loginType === 'email', step === 2)}
            onClick={() => { if (step === 1) { setLoginType('email'); setError(''); } }}
          >
            📧 Email
          </button>
          <button
            style={S.tab(loginType === 'mobile', step === 2)}
            onClick={() => { if (step === 1) { setLoginType('mobile'); setError(''); } }}
          >
            📱 Mobile
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && <div style={S.error}>{error}</div>}

        {/* ════ STEP 1: Password ════ */}
        {step === 1 && (
          <form onSubmit={handlePasswordSubmit}>

            <div style={S.inputGroup}>
              <label style={S.label}>
                {loginType === 'email' ? 'Email Address' : 'Mobile Number'}
              </label>
              {loginType === 'email' ? (
                <input
                  type="email" style={S.input} value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                />
              ) : (
                <input
                  type="tel" style={S.input} value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="+254 712 345 678" required
                />
              )}
            </div>

            <div style={S.inputGroup}>
              <label style={S.label}>Password</label>
              <div style={S.inputRow}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...S.input, flex: 1 }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button" style={S.showBtn}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Checking…' : 'Continue →'}
            </button>

          </form>
        )}

        {/* ════ STEP 2: OTP ════ */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit}>

            <div style={S.hint}>
              {otpLoading
                ? '⏳ Sending OTP to your email…'
                : (
                  <>
                    OTP sent to{' '}
                    <strong style={{ color: '#e8eaf2' }}>
                      {loginType === 'email' ? email : mobile}
                    </strong>
                    <br />Enter the 6-digit code below
                  </>
                )
              }
            </div>

            <div style={S.otpRow}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  style={S.otpBox}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              style={{ ...S.primaryBtn, opacity: (loading || otpLoading) ? 0.7 : 1 }}
              disabled={loading || otpLoading}
            >
              {loading ? 'Verifying…' : 'Verify & Sign In ✓'}
            </button>

            <div style={S.resend}>
              {resendTimer > 0 ? (
                <span>Resend OTP in {Math.floor(resendTimer / 60)}:{String(resendTimer % 60).padStart(2, '0')}</span>
              ) : (
                <span>
                  Didn't receive it?{' '}
                  <span style={S.resendLink} onClick={handleResend}>
                    Resend OTP
                  </span>
                </span>
              )}
            </div>

            <button
              type="button"
              style={S.ghostBtn}
              onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']); setPendingUserId(''); }}
            >
              ← Back to password
            </button>

          </form>
        )}

        {/* ── Footer ── */}
        {/* ✅ ONLY CHANGE: links to /forgot-password instead of "Contact Support" */}
        <div style={S.footer}>
          <span>Forgot password? </span>
          <span style={S.forgotLink} onClick={() => navigate('/forgot-password')}>Reset it here</span>
        </div>

        {/* ✅ Register link */}
        <div style={{ ...S.footer, marginTop: 8 }}>
          <span>Don't have an account? </span>
          <span style={S.forgotLink} onClick={() => navigate('/register')}>Create Account</span>
        </div>

      </div>
    </div>
  );
}
