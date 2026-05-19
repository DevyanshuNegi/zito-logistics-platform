import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ApiError, api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import BrandLockup from '../../src/components/BrandLockup';

const OTP_DIGITS = 6;
const LOGIN_SERVICE_UNAVAILABLE_MESSAGE =
  'Login service is temporarily unavailable. Please try again shortly.';

function maskContact(contact) {
  if (!contact) {
    return '';
  }

  if (contact.includes('@')) {
    const [localPart, domain = ''] = contact.split('@');
    const safeLocal =
      localPart.length <= 2
        ? `${localPart[0] ?? ''}*`
        : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 2))}`;
    return `${safeLocal}@${domain}`;
  }

  const compact = contact.replace(/\s+/g, '');
  if (compact.length <= 6) {
    return compact;
  }

  return `${compact.slice(0, 4)}${'*'.repeat(Math.max(compact.length - 6, 3))}${compact.slice(-2)}`;
}

function secondsUntil(isoValue) {
  if (!isoValue) {
    return 0;
  }

  const diffMs = new Date(isoValue).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

function emptyOtp() {
  return Array(OTP_DIGITS).fill('');
}

export default function LoginScreen() {
  const [step, setStep] = useState('contact');
  const [contactType, setContactType] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState(emptyOtp());
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [pendingContact, setPendingContact] = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);
  const autoSubmittedOtpRef = useRef('');
  const { login } = useAuth();

  const contactValue = useMemo(() => {
    if (contactType === 'phone') {
      return phone.trim();
    }

    return email.trim().toLowerCase();
  }, [contactType, email, phone]);

  const stepOrder = useMemo(
    () => (contactType === 'email' ? ['contact', 'otp', 'password'] : ['contact', 'otp']),
    [contactType],
  );

  const currentStepIndex = Math.max(stepOrder.indexOf(step), 0);
  const canContinue =
    contactType === 'phone'
      ? contactValue.replace(/\D/g, '').length >= 9
      : /\S+@\S+\.\S+/.test(contactValue);
  const canVerifyOtp = otp.join('').length === OTP_DIGITS;
  const canSubmitPassword = password.trim().length >= 6;
  const verificationTarget = pendingContact || contactValue;

  const clearTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const resetOtp = useCallback(() => {
    autoSubmittedOtpRef.current = '';
    setOtp(emptyOtp());
  }, []);

  const resetTransientState = useCallback(() => {
    clearTimer();
    setStep('contact');
    setTempToken('');
    setPendingContact('');
    setPassword('');
    setShowPw(false);
    setTimer(0);
    setError('');
    setInfoMessage('');
    resetOtp();
  }, [clearTimer, resetOtp]);

  const startTimer = useCallback(
    (seconds = 60) => {
      clearTimer();
      const safeSeconds = Math.max(0, seconds);
      setTimer(safeSeconds);

      if (safeSeconds <= 0) {
        return;
      }

      timerRef.current = setInterval(() => {
        setTimer((current) => {
          if (current <= 1) {
            clearTimer();
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    },
    [clearTimer],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const showError = useCallback((requestError, fallbackMessage) => {
    if (requestError instanceof ApiError) {
      setError(requestError.message || fallbackMessage);
      return;
    }

    setError(requestError?.message || fallbackMessage);
  }, []);

  const completeLogin = useCallback(
    async (responsePayload) => {
      const userData = responsePayload?.data?.user;
      const accessToken =
        responsePayload?.data?.token || responsePayload?.data?.accessToken;

      if (!userData || !accessToken) {
        throw new Error('Login response is missing account details.');
      }

      await login(userData, accessToken);
    },
    [login],
  );

  const requestOtp = useCallback(
    async ({ resend = false } = {}) => {
      if (!contactValue) {
        setError(
          contactType === 'phone'
            ? 'Phone number is required.'
            : 'Email address is required.',
        );
        return;
      }

      if (contactType === 'email' && !/\S+@\S+\.\S+/.test(contactValue)) {
        setError('Enter a valid email address.');
        return;
      }

      if (contactType === 'phone' && contactValue.replace(/\D/g, '').length < 9) {
        setError('Enter a valid phone number.');
        return;
      }

      const setBusy = resend ? setOtpSending : setLoading;
      setBusy(true);
      setError('');
      setInfoMessage('');

      try {
        const responsePayload = await api.post(
          '/api/v1/auth/login',
          { contact: contactValue, method: 'otp' },
          {
            token: '',
            responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
          },
        );
        const authData = responsePayload?.data;
        const nextTempToken = authData?.temp_token;
        const nextContact = authData?.contact || contactValue;

        if (!nextTempToken) {
          throw new Error('Temporary login token missing from server response.');
        }

        setTempToken(nextTempToken);
        setPendingContact(nextContact);
        setStep('otp');
        setPassword('');
        setShowPw(false);
        resetOtp();

        const resendDelay = authData?.resendAvailableAt
          ? secondsUntil(authData.resendAvailableAt)
          : 60;
        startTimer(resendDelay);
        setInfoMessage(
          resend
            ? `A fresh 6-digit code has been sent to ${maskContact(nextContact)}.`
            : `We sent a 6-digit code to ${maskContact(nextContact)}.`,
        );
      } catch (requestError) {
        showError(
          requestError,
          resend
            ? 'Unable to resend the code right now.'
            : 'Unable to start sign in right now.',
        );
      } finally {
        setBusy(false);
      }
    },
    [contactType, contactValue, resetOtp, showError, startTimer],
  );

  const handleContinue = async () => {
    await requestOtp();
  };

  const handleResend = async () => {
    if (timer > 0 || otpSending) {
      return;
    }

    await requestOtp({ resend: true });
  };

  const handleVerifyOtp = useCallback(async () => {
    const code = otp.join('');

    if (code.length < OTP_DIGITS) {
      setError('Enter all 6 digits.');
      return;
    }

    if (!tempToken) {
      resetTransientState();
      setError('Your login session expired. Request a fresh code and try again.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const responsePayload = await api.post(
        '/api/v1/auth/verify-otp',
        { otp: code },
        {
          token: '',
          headers: { Authorization: `Bearer ${tempToken}` },
          responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
        },
      );
      const authData = responsePayload?.data;

      if (authData?.requiresPassword) {
        if (!authData?.temp_token) {
          throw new Error('Password verification token missing from server response.');
        }

        clearTimer();
        setTimer(0);
        setTempToken(authData.temp_token);
        setPendingContact(authData.contact || pendingContact || contactValue);
        setStep('password');
        setPassword('');
        setShowPw(false);
        resetOtp();
        setInfoMessage('OTP verified. Enter your email password to complete sign in.');
        return;
      }

      await completeLogin(responsePayload);
    } catch (requestError) {
      showError(requestError, 'Unable to verify the code right now.');
    } finally {
      setLoading(false);
    }
  }, [
    clearTimer,
    completeLogin,
    contactValue,
    otp,
    pendingContact,
    resetOtp,
    resetTransientState,
    showError,
    tempToken,
  ]);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    if (!tempToken) {
      resetTransientState();
      setError('Your login session expired. Start again and request a fresh code.');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const responsePayload = await api.post(
        '/api/v1/auth/complete-email-login',
        { password: password.trim() },
        {
          token: '',
          headers: { Authorization: `Bearer ${tempToken}` },
          responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
        },
      );
      await completeLogin(responsePayload);
    } catch (requestError) {
      showError(requestError, 'Unable to complete sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    const digitsOnly = value.replace(/\D/g, '');

    if (!digitsOnly) {
      const next = [...otp];
      next[index] = '';
      setOtp(next);
      return;
    }

    if (digitsOnly.length > 1) {
      const next = emptyOtp();
      digitsOnly
        .slice(0, OTP_DIGITS)
        .split('')
        .forEach((digit, digitIndex) => {
          next[digitIndex] = digit;
        });
      setOtp(next);
      otpRefs.current[Math.min(digitsOnly.length, OTP_DIGITS - 1)]?.focus();
      return;
    }

    const next = [...otp];
    next[index] = digitsOnly;
    setOtp(next);

    if (digitsOnly && index < OTP_DIGITS - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    const code = otp.join('');

    if (step !== 'otp' || code.length !== OTP_DIGITS || loading) {
      return;
    }

    if (autoSubmittedOtpRef.current === code) {
      return;
    }

    autoSubmittedOtpRef.current = code;
    void handleVerifyOtp();
  }, [handleVerifyOtp, loading, otp, step]);

  useEffect(() => {
    if (otp.join('').length !== OTP_DIGITS) {
      autoSubmittedOtpRef.current = '';
    }
  }, [otp]);

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.brandWrap}>
          <BrandLockup mode="hero" showCompany={false} showTagline={false} showDescriptor={false} />
        </View>

        <View style={s.stepRow}>
          {stepOrder.map((stepName, index) => {
            const active = currentStepIndex >= index;
            const complete = currentStepIndex > index;

            return (
              <View key={stepName} style={s.stepWrap}>
                <View style={[s.stepDot, active && s.stepDotActive]}>
                  <Text style={[s.stepNum, active && s.stepNumActive]}>
                    {complete ? 'OK' : index + 1}
                  </Text>
                </View>
                {index < stepOrder.length - 1 ? (
                  <View style={[s.stepLine, complete && s.stepLineActive]} />
                ) : null}
              </View>
            );
          })}
        </View>

        {infoMessage ? (
          <View style={s.infoBox}>
            <Text style={s.infoText}>{infoMessage}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={s.errBox}>
            <Text style={s.errText}>{error}</Text>
          </View>
        ) : null}

        {step === 'contact' ? (
          <View>
            <Text style={s.stepTitle}>Sign in to Zito</Text>

            <View style={s.tabRow}>
              <TouchableOpacity
                style={[s.tab, contactType === 'phone' && s.tabActive]}
                onPress={() => {
                  if (contactType === 'phone') {
                    return;
                  }

                  resetTransientState();
                  setContactType('phone');
                  setEmail('');
                }}>
                <Text style={[s.tabText, contactType === 'phone' && s.tabTextActive]}>
                  Phone Number
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, contactType === 'email' && s.tabActive]}
                onPress={() => {
                  if (contactType === 'email') {
                    return;
                  }

                  resetTransientState();
                  setContactType('email');
                  setPhone('');
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
                  placeholder="+254711000101"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                />
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
                <Text style={s.helper}>
                  We will send a one-time code first. If your email account uses a
                  password, you will enter it after OTP verification.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[s.btn, (loading || !canContinue) && s.btnDim]}
              onPress={handleContinue}
              disabled={loading || !canContinue}>
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={s.btnText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 'otp' ? (
          <View>
            <Text style={s.stepTitle}>Verify your OTP</Text>
            <Text style={s.hint}>
              We sent a six-digit code to{' '}
              <Text style={s.hintStrong}>{maskContact(verificationTarget)}</Text>
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
                  maxLength={index === 0 ? OTP_DIGITS : 1}
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
              style={[s.btn, (loading || !canVerifyOtp) && s.btnDim]}
              onPress={() => {
                void handleVerifyOtp();
              }}
              disabled={loading || !canVerifyOtp}>
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
                clearTimer();
                setTimer(0);
                setStep('contact');
                setTempToken('');
                setPendingContact('');
                setPassword('');
                setShowPw(false);
                setError('');
                setInfoMessage('');
                resetOtp();
              }}>
              <Text style={s.backText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 'password' ? (
          <View>
            <Text style={s.stepTitle}>Complete email sign in</Text>
            <Text style={s.hint}>
              OTP is verified for{' '}
              <Text style={s.hintStrong}>{maskContact(verificationTarget)}</Text>.
              Enter your password to finish signing in.
            </Text>

            <Text style={s.label}>Password</Text>
            <View style={s.pwRow}>
              <TextInput
                style={[s.input, s.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity
                style={s.showBtn}
                onPress={() => setShowPw((current) => !current)}>
                <Text style={s.showBtnText}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.btn, (loading || !canSubmitPassword) && s.btnDim]}
              onPress={() => {
                void handlePasswordSubmit();
              }}
              disabled={loading || !canSubmitPassword}>
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={s.btnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.backBtn}
              onPress={() => {
                resetTransientState();
                setContactType('email');
              }}>
              <Text style={s.backText}>Start again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  brandWrap: { marginBottom: 28, alignItems: 'center' },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
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
  stepLine: { width: 46, height: 2, backgroundColor: colors.border },
  stepLineActive: { backgroundColor: colors.primary },
  stepTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 20 },
  infoBox: {
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  errBox: {
    backgroundColor: 'rgba(244,93,115,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
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
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  pwRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  showBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
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
