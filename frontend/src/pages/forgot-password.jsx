import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep]         = useState(1); // 1=email, 2=otp, 3=new password, 4=success
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // ─── Resend timer ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    setResendTimer(600); // 10 minutes
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
    if (value && i < 5) document.getElementById(`rotp-${i + 1}`)?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0)
      document.getElementById(`rotp-${i - 1}`)?.focus();
  };

  // ─── Step 1: Send OTP ─────────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    try {
      await api.post('/api/v1/auth/forgot-password', { email: email.trim() });
      setStep(2);
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/api/v1/auth/forgot-password', { email: email.trim() });
      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (err) {
      setError('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ───────────────────────────────────────────────────────
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setStep(3);
  };

  // ─── Step 3: Reset password ───────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }
    if (newPass.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await api.post('/api/v1/auth/reset-password', {
        email:        email.trim(),
        otp:          otp.join(''),
        new_password: newPass,
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
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
      width: '100%', maxWidth: 400, background: '#181e2d',
      borderRadius: 18, padding: '32px 28px',
      boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
    },
    title:  { fontSize: 22, fontWeight: 800, color: '#e8eaf2', textAlign: 'center', marginBottom: 4 },
    sub:    { fontSize: 13, color: '#8892a4', textAlign: 'center', marginBottom: 24 },
    label:  { fontSize: 12, color: '#8892a4', marginBottom: 6, display: 'block' },
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
    hint: { fontSize: 12, color: '#545f73', textAlign: 'center', marginBottom: 16, lineHeight: 1.6 },
    otpRow: { display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 },
    otpBox: {
      width: 46, height: 54, textAlign: 'center', fontSize: 22, fontWeight: 700,
      background: '#111621', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, color: '#e8eaf2', outline: 'none',
    },
    resend: { textAlign: 'center', fontSize: 12, color: '#545f73', marginTop: 12 },
    resendLink: { color: '#e8a020', cursor: 'pointer', fontWeight: 600 },
    footer: { marginTop: 20, textAlign: 'center', fontSize: 12, color: '#545f73' },
    link:   { color: '#e8a020', cursor: 'pointer', fontWeight: 600 },
    stepIndicator: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 },
    stepDot: (active, done) => ({
      width: 8, height: 8, borderRadius: '50%',
      background: done ? '#22c55e' : active ? '#e8a020' : '#1e2636',
      transition: 'all 0.25s',
    }),
  };

  // ─── STEP 4: Success ──────────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div style={S.wrapper}>
        <div style={S.card}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e8eaf2', textAlign: 'center', marginBottom: 10 }}>
            Password Reset!
          </div>
          <div style={{ fontSize: 13, color: '#8892a4', textAlign: 'center', lineHeight: 1.7, marginBottom: 24 }}>
            Your password has been reset successfully. You can now log in with your new password.
          </div>
          <button style={S.primaryBtn} onClick={() => navigate('/login')}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrapper}>
      <div style={S.card}>

        <div style={S.title}>VG Logistics</div>
        <div style={S.sub}>
          {step === 1 && 'Reset your password'}
          {step === 2 && 'Enter the OTP sent to your email'}
          {step === 3 && 'Set your new password'}
        </div>

        {/* Step dots */}
        <div style={S.stepIndicator}>
          {[1, 2, 3].map(s => (
            <div key={s} style={S.stepDot(step === s, step > s)} />
          ))}
        </div>

        {error && <div style={S.error}>{error}</div>}

        {/* ── STEP 1: Email ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <div style={S.inputGroup}>
              <label style={S.label}>Email Address</label>
              <input
                type="email" style={S.input}
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
              />
            </div>
            <button type="submit" style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send Reset OTP →'}
            </button>
            <button type="button" style={S.ghostBtn} onClick={() => navigate('/login')}>
              ← Back to Login
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div style={S.hint}>
              OTP sent to <strong style={{ color: '#e8eaf2' }}>{email}</strong><br />
              Enter the 6-digit code below
            </div>
            <div style={S.otpRow}>
              {otp.map((digit, i) => (
                <input
                  key={i} id={`rotp-${i}`}
                  type="text" inputMode="numeric" maxLength={1}
                  style={S.otpBox} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <button type="submit" style={S.primaryBtn}>
              Verify OTP →
            </button>
            <div style={S.resend}>
              {resendTimer > 0 ? (
                <span>Resend in {Math.floor(resendTimer / 60)}:{String(resendTimer % 60).padStart(2, '0')}</span>
              ) : (
                <span>
                  Didn't receive it?{' '}
                  <span style={S.resendLink} onClick={handleResend}>Resend OTP</span>
                </span>
              )}
            </div>
            <button type="button" style={S.ghostBtn} onClick={() => { setStep(1); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        {/* ── STEP 3: New Password ── */}
        {step === 3 && (
          <form onSubmit={handleReset}>
            <div style={S.inputGroup}>
              <label style={S.label}>New Password</label>
              <div style={S.inputRow}>
                <input
                  type={showPass ? 'text' : 'password'}
                  style={{ ...S.input, flex: 1 }}
                  value={newPass} onChange={e => setNewPass(e.target.value)}
                  placeholder="Min. 6 characters" required
                />
                <button type="button" style={S.showBtn} onClick={() => setShowPass(v => !v)}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div style={S.inputGroup}>
              <label style={S.label}>Confirm New Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                style={S.input}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password" required
              />
            </div>
            <button type="submit" style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? 'Resetting…' : '✓ Reset Password'}
            </button>
            <button type="button" style={S.ghostBtn} onClick={() => { setStep(2); setError(''); }}>
              ← Back
            </button>
          </form>
        )}

        <div style={S.footer}>
          Remember your password?{' '}
          <span style={S.link} onClick={() => navigate('/login')}>Sign In</span>
        </div>

      </div>
    </div>
  );
}