// app/(auth)/login.js
// PRD Section 10, 11 — Multi-role auth with 2FA OTP
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors, API_URL } from '../../src/constants/theme';

export default function LoginScreen() {
  const [step, setStep]         = useState(1);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [timer, setTimer]       = useState(0);
  const [error, setError]       = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);
  const { login } = useAuth();
  const router = useRouter();

  const startTimer = () => {
    clearInterval(timerRef.current);
    setTimer(60);
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  };

  // Step 1: verify credentials — backend sends OTP automatically
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError('Email and password required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Invalid credentials');
      startTimer();
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (timer > 0) return;
    setOtpSending(true); setError('');
    try {
      await fetch(`${API_URL}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (e) {
      setError('Failed to resend OTP. Try again.');
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: verify OTP → get token → login
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Invalid OTP');

      const userData    = data?.data?.user;
      const accessToken = data?.data?.accessToken;
      if (!userData || !accessToken) throw new Error('Invalid server response');

      await login(userData, accessToken);
      // RootGuard will handle redirect based on role
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, i) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyPress = (e, i) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoBox}><Text style={s.logoText}>ZITO</Text></View>
          <Text style={s.logoSub}>VG GLOBAL LOGISTICS</Text>
          <Text style={s.tagline}>Move Heavy. Move Smart.</Text>
        </View>

        {/* Step dots */}
        <View style={s.stepRow}>
          {[1, 2].map(n => (
            <View key={n} style={s.stepWrap}>
              <View style={[s.stepDot, step >= n && s.stepDotActive]}>
                <Text style={[s.stepNum, step >= n && s.stepNumActive]}>{step > n ? '✓' : n}</Text>
              </View>
              {n < 2 && <View style={[s.stepLine, step > 1 && s.stepLineActive]} />}
            </View>
          ))}
        </View>

        {error ? <View style={s.errBox}><Text style={s.errText}>{error}</Text></View> : null}

        {/* STEP 1 */}
        {step === 1 && (
          <View>
            <Text style={s.stepTitle}>Sign In</Text>
            <Text style={s.label}>Email Address</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={colors.textFaint}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

            <Text style={s.label}>Password</Text>
            <View style={s.pwRow}>
              <TextInput style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPw} />
              <TouchableOpacity style={s.showBtn} onPress={() => setShowPw(v => !v)}>
                <Text style={s.showBtnText}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.btn, loading && s.btnDim]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.btnText}>Continue →</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <View>
            <Text style={s.stepTitle}>Verify OTP</Text>
            <Text style={s.hint}>Code sent to <Text style={{ color: colors.text, fontWeight: '700' }}>{email}</Text></Text>

            <View style={s.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => otpRefs.current[i] = r}
                  style={s.otpBox}
                  value={digit}
                  onChangeText={v => handleOtpChange(v, i)}
                  onKeyPress={e => handleOtpKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  placeholderTextColor={colors.textFaint}
                  autoFocus={i === 0}
                />
              ))}
            </View>

            <TouchableOpacity style={[s.btn, loading && s.btnDim]} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={s.btnText}>Verify & Sign In ✓</Text>}
            </TouchableOpacity>

            <View style={s.resendRow}>
              {timer > 0
                ? <Text style={s.timerText}>Resend in {timer}s</Text>
                : <TouchableOpacity onPress={handleResend} disabled={otpSending}>
                    <Text style={s.resendText}>{otpSending ? 'Sending...' : 'Resend OTP'}</Text>
                  </TouchableOpacity>
              }
            </View>

            <TouchableOpacity style={s.backBtn}
              onPress={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']); }}>
              <Text style={s.backText}>← Back to password</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  logoWrap:    { alignItems: 'center', marginBottom: 36 },
  logoBox:     { width: 80, height: 80, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText:    { fontSize: 28, fontWeight: '900', color: colors.bg, letterSpacing: 4 },
  logoSub:     { fontSize: 11, color: colors.textMuted, letterSpacing: 2.5, marginBottom: 4 },
  tagline:     { fontSize: 13, color: colors.textFaint, fontStyle: 'italic' },
  stepRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepWrap:    { flexDirection: 'row', alignItems: 'center' },
  stepDot:     { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive:{ backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum:     { fontSize: 13, fontWeight: '700', color: colors.textFaint },
  stepNumActive:{ color: colors.bg },
  stepLine:    { width: 60, height: 2, backgroundColor: colors.border },
  stepLineActive:{ backgroundColor: colors.primary },
  stepTitle:   { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  errBox:      { backgroundColor: 'rgba(239,68,68,0.1)', borderLeftWidth: 3, borderLeftColor: colors.danger, borderRadius: 8, padding: 12, marginBottom: 16 },
  errText:     { color: colors.danger, fontSize: 13 },
  label:       { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, padding: 14, fontSize: 15 },
  pwRow:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  showBtn:     { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  showBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  btn:         { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDim:      { opacity: 0.6 },
  btnText:     { color: colors.bg, fontSize: 16, fontWeight: '800' },
  hint:        { fontSize: 13, color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  otpRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  otpBox:      { flex: 1, aspectRatio: 0.85, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  resendRow:   { alignItems: 'center', marginTop: 16 },
  timerText:   { color: colors.textFaint, fontSize: 13 },
  resendText:  { color: colors.primary, fontSize: 13, fontWeight: '700' },
  backBtn:     { alignItems: 'center', marginTop: 14, padding: 10 },
  backText:    { color: colors.textMuted, fontSize: 13 },
});
