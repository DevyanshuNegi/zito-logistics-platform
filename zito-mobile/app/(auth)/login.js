import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { colors, API_URL } from '../../src/constants/theme';
import BrandLockup from '../../src/components/BrandLockup';

export default function LoginScreen() {
  const [step, setStep] = useState(1);
  const [contactType, setContactType] = useState('phone'); // 'phone' or 'email'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);
  const autoSubmittedOtpRef = useRef('');
  const { login } = useAuth();

  const startTimer = () => {
    clearInterval(timerRef.current);
    setTimer(60);
    timerRef.current = setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (contactType === 'phone') {
      if (!phone.trim()) {
        setError('Phone number is required.');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email and password are required.');
        return;
      }
    }

    setLoading(true);
    setError('');
    try {
      const contact = contactType === 'phone' ? phone.trim() : email.trim();
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          contactType === 'phone'
            ? { phone: contact }
            : { email: contact, password }
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Invalid credentials');
      }

      startTimer();
      setStep(2);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    setOtpSending(true);
    setError('');
    try {
      const contact = contactType === 'phone' ? phone.trim() : email.trim();
      await fetch(`${API_URL}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          contactType === 'phone'
            ? { phone: contact }
            : { email: contact }
        ),
      });
      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (_requestError) {
      setError('Failed to resend OTP. Try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = useCallback(async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const contact = contactType === 'phone' ? phone.trim() : email.trim();
      const response = await fetch(`${API_URL}/api/v1/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          contactType === 'phone'
            ? { phone: contact, otp: code }
            : { email: contact, otp: code }
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Invalid OTP');
      }

      const userData = data?.data?.user;
      const accessToken = data?.data?.accessToken;
      if (!userData || !accessToken) {
        throw new Error('Invalid server response');
      }

      await login(userData, accessToken);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [login, otp, phone, email, contactType]);

  const handleOtpChange = (value, index) => {
    const digitsOnly = value.replace(/\D/g, '');
    if (!digitsOnly) {
      const next = [...otp];
      next[index] = '';
      setOtp(next);
      return;
    }

    if (digitsOnly.length > 1) {
      const next = [...otp];
      digitsOnly
        .slice(0, 6)
        .split('')
        .forEach((digit, digitIndex) => {
          next[digitIndex] = digit;
        });
      setOtp(next);
      const nextFocusIndex = Math.min(digitsOnly.length, 5);
      otpRefs.current[nextFocusIndex]?.focus();
      return;
    }

    const next = [...otp];
    next[index] = digitsOnly;
    setOtp(next);
    if (digitsOnly && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    const code = otp.join('');
    if (step !== 2 || code.length !== 6 || loading) {
      return;
    }

    if (autoSubmittedOtpRef.current === code) {
      return;
    }

    autoSubmittedOtpRef.current = code;
    void handleVerifyOtp();
  }, [handleVerifyOtp, loading, otp, step]);

  useEffect(() => {
    if (otp.join('').length !== 6) {
      autoSubmittedOtpRef.current = '';
    }
  }, [otp]);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brandWrap}>
          <BrandLockup mode="hero" showCompany={false} />
        </View>

        <View style={s.stepRow}>
          {[1, 2].map((value) => (
            <View key={value} style={s.stepWrap}>
              <View style={[s.stepDot, step >= value && s.stepDotActive]}>
                <Text style={[s.stepNum, step >= value && s.stepNumActive]}>
                  {step > value ? 'OK' : value}
                </Text>
              </View>
              {value < 2 ? <View style={[s.stepLine, step > 1 && s.stepLineActive]} /> : null}
            </View>
          ))}
        </View>

        {error ? (
          <View style={s.errBox}>
            <Text style={s.errText}>{error}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View>
            <Text style={s.stepTitle}>Sign in to Zito</Text>
            
            {/* Contact type tabs */}
            <View style={s.tabRow}>
              <TouchableOpacity
                style={[s.tab, contactType === 'phone' && s.tabActive]}
                onPress={() => {
                  setContactType('phone');
                  setEmail('');
                  setPassword('');
                  setError('');
                }}>
                <Text style={[s.tabText, contactType === 'phone' && s.tabTextActive]}>
                  Phone Number
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, contactType === 'email' && s.tabActive]}
                onPress={() => {
                  setContactType('email');
                  setPhone('');
                  setError('');
                }}>
                <Text style={[s.tabText, contactType === 'email' && s.tabTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            {contactType === 'phone' ? (
              <>
                <Text style={s.label}>Phone Number</Text>
                <TextInput
                  style={s.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={[s.btn, loading && s.btnDim]} onPress={handleLogin} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={s.btnText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.label}>Email Address</Text>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                <Text style={s.label}>Password</Text>
                <View style={s.pwRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.textFaint}
                    secureTextEntry={!showPw}
                  />
                  <TouchableOpacity style={s.showBtn} onPress={() => setShowPw((current) => !current)}>
                    <Text style={s.showBtnText}>{showPw ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[s.btn, loading && s.btnDim]} onPress={handleLogin} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={s.btnText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <View>
            <Text style={s.stepTitle}>Verify your OTP</Text>
            <Text style={s.hint}>
              We sent a six-digit code to <Text style={s.hintStrong}>{contactType === 'phone' ? phone : email}</Text>
            </Text>

            <View style={s.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    otpRefs.current[index] = ref;
                  }}
                  style={s.otpBox}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(event) => handleOtpKeyPress(event, index)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? 6 : 1}
                  textAlign="center"
                  placeholderTextColor={colors.textFaint}
                  autoFocus={index === 0}
                  autoComplete={
                    index === 0
                      ? Platform.select({
                          android: 'sms-otp',
                          ios: 'one-time-code',
                          default: 'off',
                        })
                      : 'off'
                  }
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  importantForAutofill={index === 0 ? 'yes' : 'no'}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, loading && s.btnDim]}
              onPress={handleVerifyOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={s.btnText}>Verify and sign in</Text>
              )}
            </TouchableOpacity>

            <View style={s.resendRow}>
              {timer > 0 ? (
                <Text style={s.timerText}>Resend in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} disabled={otpSending}>
                  <Text style={s.resendText}>{otpSending ? 'Sending...' : 'Resend OTP'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={s.backBtn}
              onPress={() => {
                setStep(1);
                setError('');
                setOtp(['', '', '', '', '', '']);
              }}>
              <Text style={s.backText}>Back to password</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  brandWrap: { marginBottom: 28 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: colors.textFaint },
  stepNumActive: { color: colors.bg },
  stepLine: { width: 60, height: 2, backgroundColor: colors.border },
  stepLineActive: { backgroundColor: colors.primary },
  stepTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 20 },
  errBox: {
    backgroundColor: 'rgba(244,93,115,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errText: { color: colors.danger, fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.bg },
  label: { fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    padding: 14,
    fontSize: 15,
  },
  pwRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  showBtn: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  showBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDim: { opacity: 0.6 },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  hintStrong: { color: colors.text, fontWeight: '700' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 8 },
  otpBox: {
    flex: 1,
    aspectRatio: 0.85,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  resendRow: { alignItems: 'center', marginTop: 16 },
  timerText: { color: colors.textFaint, fontSize: 13 },
  resendText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: 14, padding: 10 },
  backText: { color: colors.textMuted, fontSize: 13 },
});
