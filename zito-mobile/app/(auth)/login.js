import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { ApiError, api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';

const OTP_DIGITS = 6;
const LOGIN_SERVICE_UNAVAILABLE_MESSAGE =
  'Login service is temporarily unavailable. Please try again shortly.';
const LOGO_CYAN = '#12c8ff';
const LOGO_PURPLE = '#b13cff';

// Country codes database
const COUNTRY_CODES = [
  { code: '+254', country: 'Kenya', flag: 'KE' },
  { code: '+1', country: 'United States', flag: 'US' },
  { code: '+44', country: 'United Kingdom', flag: 'GB' },
  { code: '+91', country: 'India', flag: 'IN' },
  { code: '+27', country: 'South Africa', flag: 'ZA' },
  { code: '+234', country: 'Nigeria', flag: 'NG' },
  { code: '+256', country: 'Uganda', flag: 'UG' },
  { code: '+255', country: 'Tanzania', flag: 'TZ' },
];

function normalizePhoneContact(countryCode, phoneValue) {
  const countryDigits = countryCode.replace(/\D/g, '');
  let digits = phoneValue.replace(/\D/g, '');

  if (digits.startsWith(countryDigits)) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `${countryCode}${digits}`;
}

function maskContact(contact) {
  if (!contact) return '';
  if (contact.includes('@')) {
    const [localPart, domain = ''] = contact.split('@');
    const safeLocal =
      localPart.length <= 2
        ? `${localPart[0] ?? ''}*`
        : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 2))}`;
    return `${safeLocal}@${domain}`;
  }
  const compact = contact.replace(/\s+/g, '');
  if (compact.length <= 6) return compact;
  return `${compact.slice(0, 4)}${'*'.repeat(Math.max(compact.length - 6, 3))}${compact.slice(-2)}`;
}

function secondsUntil(isoValue) {
  if (!isoValue) return 0;
  const diffMs = new Date(isoValue).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

function emptyOtp() {
  return Array(OTP_DIGITS).fill('');
}

export default function LoginScreen() {
  const [step, setStep] = useState('contact');
  const [contactType, setContactType] = useState('phone');
  const [countryCode, setCountryCode] = useState('+254');
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
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [signupForm, setSignupForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [forgotStep, setForgotStep] = useState('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const otpRefs = useRef([]);
  const timerRef = useRef(null);
  const autoSubmittedOtpRef = useRef('');
  const { login } = useAuth();
  const selectedCountry = COUNTRY_CODES.find((item) => item.code === countryCode) || COUNTRY_CODES[0];

  const contactValue = useMemo(() => {
    if (contactType === 'phone') {
      return normalizePhoneContact(countryCode, phone);
    }
    return email.trim().toLowerCase();
  }, [contactType, countryCode, email, phone]);

  const stepOrder = useMemo(
    () => (contactType === 'email' ? ['contact', 'otp', 'password'] : ['contact', 'otp']),
    [contactType],
  );

  const currentStepIndex = Math.max(stepOrder.indexOf(step), 0);
  const canContinue =
    contactType === 'phone'
      ? phone.replace(/\D/g, '').length >= 9
      : /\S+@\S+\.\S+/.test(email);
  const canVerifyOtp = otp.join('').length === OTP_DIGITS;
  const canSubmitPassword = password.trim().length >= 6;
  const canSignup =
    signupForm.fullName.trim().length >= 2 &&
    signupForm.phone.replace(/\D/g, '').length >= 9 &&
    signupForm.password.trim().length >= 6;

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
      if (safeSeconds <= 0) return;

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
    console.warn('[LOGIN ERROR]', requestError?.message || requestError);
    if (requestError instanceof ApiError) {
      setError(requestError.message || fallbackMessage);
      return;
    }
    setError(requestError?.message || fallbackMessage);
  }, []);

  const showModalError = useCallback((requestError, fallbackMessage) => {
    console.warn('[AUTH MODAL ERROR]', requestError?.message || requestError);
    if (requestError instanceof ApiError) {
      setModalError(requestError.message || fallbackMessage);
      return;
    }
    setModalError(requestError?.message || fallbackMessage);
  }, []);

  const openSignup = useCallback(() => {
    setModalError('');
    setModalMessage('');
    setShowSignupModal(true);
  }, []);

  const openForgot = useCallback(() => {
    setModalError('');
    setModalMessage('');
    setForgotStep('email');
    setForgotOtp('');
    setForgotPassword('');
    setForgotToken('');
    setShowForgotModal(true);
  }, []);

  const completeLogin = useCallback(
    async (responsePayload) => {
      const userData = responsePayload?.data?.user;
      const accessToken = responsePayload?.data?.token || responsePayload?.data?.accessToken;

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
        setError(contactType === 'phone' ? 'Phone number is required.' : 'Email address is required.');
        return;
      }

      if (contactType === 'email' && !/\S+@\S+\.\S+/.test(contactValue)) {
        setError('Enter a valid email address.');
        return;
      }

      if (contactType === 'phone' && phone.replace(/\D/g, '').length < 9) {
        setError('Enter a valid phone number.');
        return;
      }

      const setBusy = resend ? setOtpSending : setLoading;
      setBusy(true);
      setError('');
      setInfoMessage('');

      try {
        const responsePayload = await api.post(
          '/auth/login',
          { contact: contactValue, method: 'otp' },
          { token: '', responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE }
        );

        const authData = responsePayload?.data || responsePayload;
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

        const resendDelay = authData?.resendAvailableAt ? secondsUntil(authData.resendAvailableAt) : 60;
        startTimer(resendDelay);
        setInfoMessage(
          resend
            ? `A fresh 6-digit code has been sent to ${maskContact(nextContact)}.`
            : `We sent a 6-digit code to ${maskContact(nextContact)}.`
        );
      } catch (requestError) {
        showError(
          requestError,
          resend ? 'Unable to resend the code right now.' : 'Unable to start sign in right now.'
        );
      } finally {
        setBusy(false);
      }
    },
    [contactType, contactValue, phone, resetOtp, showError, startTimer]
  );

  const handleVerifyOtp = useCallback(async (overrideCode) => {
    const code = (overrideCode || otp.join('')).replace(/\D/g, '').slice(0, OTP_DIGITS);

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
        '/auth/verify-otp',
        { otp: code },
        { token: '', headers: { Authorization: `Bearer ${tempToken}` }, responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE }
      );

      const authData = responsePayload?.data || responsePayload;
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

      await completeLogin({ data: authData });
    } catch (requestError) {
      showError(requestError, 'Unable to verify the code right now.');
    } finally {
      setLoading(false);
    }
  }, [clearTimer, completeLogin, contactValue, otp, pendingContact, resetOtp, resetTransientState, showError, tempToken]);

  const focusFirstOtpBox = useCallback(() => {
    requestAnimationFrame(() => {
      otpRefs.current[0]?.focus();
    });
  }, []);

  const handleResendOtp = useCallback(() => {
    if (otpSending) return;
    clearTimer();
    resetOtp();
    setError('');
    setInfoMessage('');
    focusFirstOtpBox();
    void requestOtp({ resend: true });
  }, [clearTimer, focusFirstOtpBox, otpSending, requestOtp, resetOtp]);

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
        '/auth/complete-email-login',
        { password: password.trim() },
        { token: '', headers: { Authorization: `Bearer ${tempToken}` }, responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE }
      );

      await completeLogin(responsePayload);
    } catch (requestError) {
      showError(requestError, 'Unable to complete sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (!canSignup) {
      setModalError('Enter your name, valid phone, and a password with at least 6 characters.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalMessage('');

    try {
      const normalizedSignupPhone = normalizePhoneContact(countryCode, signupForm.phone);
      const payload = {
        fullName: signupForm.fullName.trim(),
        phone: normalizedSignupPhone,
        password: signupForm.password.trim(),
        role: 'CUSTOMER',
      };

      if (signupForm.email.trim()) {
        payload.email = signupForm.email.trim().toLowerCase();
      }

      const responsePayload = await api.post('/auth/register', payload, {
        token: '',
        responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE,
      });

      setPhone(normalizedSignupPhone.replace(countryCode, ''));
      setContactType('phone');
      setShowSignupModal(false);
      setInfoMessage(responsePayload?.message || 'Registration submitted. Sign in after account activation.');
    } catch (requestError) {
      showModalError(requestError, 'Unable to create account right now.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleForgotEmailSubmit = async () => {
    if (!/\S+@\S+\.\S+/.test(forgotEmail.trim())) {
      setModalError('Enter a valid email address.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalMessage('');

    try {
      const responsePayload = await api.post(
        '/auth/forgot-password',
        { email: forgotEmail.trim().toLowerCase() },
        { token: '', responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE },
      );
      setForgotStep('otp');
      setModalMessage(responsePayload?.message || 'Reset code sent.');
    } catch (requestError) {
      showModalError(requestError, 'Unable to send reset code right now.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (overrideCode) => {
    const code = (overrideCode || forgotOtp).replace(/\D/g, '').slice(0, OTP_DIGITS);
    if (code.length !== OTP_DIGITS) {
      setModalError('Enter the 6-digit reset code.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalMessage('');

    try {
      const responsePayload = await api.post(
        '/auth/verify-reset-otp',
        { email: forgotEmail.trim().toLowerCase(), otp: code },
        { token: '', responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE },
      );
      const resetToken = responsePayload?.data?.resetToken || responsePayload?.resetToken;
      if (!resetToken) {
        throw new Error('Reset token missing from server response.');
      }
      setForgotToken(resetToken);
      setForgotStep('password');
      setModalMessage('Code verified. Enter a new password.');
    } catch (requestError) {
      showModalError(requestError, 'Unable to verify reset code right now.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    if (forgotPassword.trim().length < 6) {
      setModalError('Password must be at least 6 characters.');
      return;
    }

    setModalLoading(true);
    setModalError('');
    setModalMessage('');

    try {
      const responsePayload = await api.post(
        '/auth/reset-password',
        { token: forgotToken, newPassword: forgotPassword.trim() },
        { token: '', responseFallbackMessage: LOGIN_SERVICE_UNAVAILABLE_MESSAGE },
      );
      setShowForgotModal(false);
      setContactType('email');
      setEmail(forgotEmail.trim().toLowerCase());
      setInfoMessage(responsePayload?.message || 'Password updated. You can now sign in.');
    } catch (requestError) {
      showModalError(requestError, 'Unable to update password right now.');
    } finally {
      setModalLoading(false);
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
      const next = [...otp];
      digitsOnly.slice(0, OTP_DIGITS - index).split('').forEach((digit, digitIndex) => {
        const targetIndex = index + digitIndex;
        if (targetIndex < OTP_DIGITS) {
          next[targetIndex] = digit;
        }
      });
      setOtp(next);
      const code = next.join('');
      const focusIndex = Math.min(index + digitsOnly.length, OTP_DIGITS - 1);
      otpRefs.current[focusIndex]?.focus();
      if (code.length === OTP_DIGITS) {
        autoSubmittedOtpRef.current = code;
        void handleVerifyOtp(code);
      }
      return;
    }

    const next = [...otp];
    next[index] = digitsOnly;
    setOtp(next);

    const code = next.join('');
    if (code.length === OTP_DIGITS) {
      autoSubmittedOtpRef.current = code;
      void handleVerifyOtp(code);
      return;
    }

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
    if (step !== 'otp' || code.length !== OTP_DIGITS || loading) return;
    if (autoSubmittedOtpRef.current === code) return;

    autoSubmittedOtpRef.current = code;
    void handleVerifyOtp();
  }, [handleVerifyOtp, loading, otp, step]);

  useEffect(() => {
    if (otp.join('').length !== OTP_DIGITS) {
      autoSubmittedOtpRef.current = '';
    }
  }, [otp]);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.backdrop} pointerEvents="none">
        <View style={s.blueGlowLeft} />
        <View style={s.blueGlowRight} />
        <View style={s.networkLineOne} />
        <View style={s.networkLineTwo} />
        <View style={s.networkLineThree} />
        <View style={s.electricLineLeft} />
        <View style={s.electricLineRight} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* LOGO */}
        <View style={s.logoWrap}>
          <Image source={require('../../assets/images/zito-logo.png')} style={s.heroLogo} resizeMode="contain" />
        </View>

        {/* PROGRESS INDICATOR */}
        <View style={s.progressRow}>
          {stepOrder.map((stepName, index) => {
            const active = currentStepIndex >= index;
            const complete = currentStepIndex > index;
            return (
              <View key={stepName} style={s.progressWrap}>
                <View style={[s.progressDot, active && s.progressDotActive]}>
                  <Text style={[s.progressNum, active && s.progressNumActive]}>
                    {complete ? '✓' : index + 1}
                  </Text>
                </View>
                {index < stepOrder.length - 1 && <View style={[s.progressLine, complete && s.progressLineActive]} />}
              </View>
            );
          })}
        </View>

        {/* ERROR MESSAGE */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* INFO MESSAGE */}
        {infoMessage && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>{infoMessage}</Text>
          </View>
        )}

        {/* CONTACT STEP */}
        {step === 'contact' && (
          <View style={s.glassCard}>
            <View style={s.tabRow}>
              <TouchableOpacity
                style={[s.tab, contactType === 'phone' && s.tabActive]}
                onPress={() => {
                  if (contactType === 'phone') return;
                  resetTransientState();
                  setContactType('phone');
                  setEmail('');
                }}>
                <Text style={[s.tabText, contactType === 'phone' && s.tabTextActive]}>Phone Number</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, contactType === 'email' && s.tabActive]}
                onPress={() => {
                  if (contactType === 'email') return;
                  resetTransientState();
                  setContactType('email');
                  setPhone('');
                }}>
                <Text style={[s.tabText, contactType === 'email' && s.tabTextActive]}>Email</Text>
              </TouchableOpacity>
            </View>

            {contactType === 'phone' ? (
              <View style={s.phoneRow}>
                <TouchableOpacity style={s.countryButton} onPress={() => setShowCountryModal(true)}>
                  <View style={s.flagBox}>
                    <Text style={s.flagText}>{selectedCountry.code === '+254' ? 'KE' : selectedCountry.code.replace('+', '')}</Text>
                  </View>
                <Text style={s.countryButtonText}>{selectedCountry.code}</Text>
                  <Text style={s.countryArrow}>v</Text>
                </TouchableOpacity>

                <TextInput
                  style={[s.input, s.phoneInput]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="711000101"
                  placeholderTextColor="rgba(255,255,255,0.86)"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoComplete="tel"
                />
              </View>
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
                <Text style={s.helper}>We will send a code via email first, then ask for your password.</Text>
              </>
            )}

            <TouchableOpacity
              style={[s.btn, (loading || !canContinue) && s.btnDisabled]}
              onPress={() => requestOtp()}
              disabled={loading || !canContinue}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText}>Sign In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.forgotBtn} onPress={openForgot}>
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OTP STEP */}
        {step === 'otp' && (
          <View style={s.glassCard}>
            <Text style={s.stepTitle}>Enter OTP Code</Text>
            <Text style={s.stepSubtitle}>We sent 6 digits to {maskContact(pendingContact)}</Text>

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
                  maxLength={OTP_DIGITS}
                  textAlign="center"
                  placeholderTextColor={colors.textFaint}
                  autoFocus={index === 0}
                  autoComplete={index === 0 ? (Platform.select({ android: 'sms-otp', ios: 'one-time-code' })) : 'off'}
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[s.btn, (loading || !canVerifyOtp) && s.btnDisabled]}
              onPress={() => void handleVerifyOtp()}
              disabled={loading || !canVerifyOtp}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <View style={s.timerRow}>
              {timer > 0 ? (
                <>
                  <Text style={s.timerText}>Resend available in {timer}s</Text>
                  <TouchableOpacity onPress={handleResendOtp} disabled={otpSending} style={s.resendButton}>
                    <Text style={[s.resendText, otpSending && s.resendTextDisabled]}>
                      {otpSending ? 'Sending...' : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={handleResendOtp} disabled={otpSending}>
                  <Text style={[s.resendText, otpSending && s.resendTextDisabled]}>
                    {otpSending ? 'Sending...' : '↻ Resend OTP'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={s.backBtn} onPress={() => resetTransientState()}>
              <Text style={s.backBtnText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PASSWORD STEP */}
        {step === 'password' && (
          <View style={s.glassCard}>
            <Text style={s.stepTitle}>Email Password</Text>
            <Text style={s.stepSubtitle}>OTP verified for {maskContact(pendingContact)}</Text>

            <Text style={s.label}>Password</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={s.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPw(!showPw)}>
                <Text style={s.eyeBtnText}>{showPw ? '👁️‍🗨️' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.btn, (loading || !canSubmitPassword) && s.btnDisabled]}
              onPress={() => void handlePasswordSubmit()}
              disabled={loading || !canSubmitPassword}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText}>Complete Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.backBtn} onPress={() => resetTransientState()}>
              <Text style={s.backBtnText}>← Start Over</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={s.signupText}>
          {"Don't have an account? "}
          <Text style={s.signupLink} onPress={openSignup}>Sign Up</Text>
        </Text>
      </ScrollView>

      <Modal visible={showSignupModal} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.authModalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Create Customer Account</Text>
              <TouchableOpacity onPress={() => setShowSignupModal(false)}>
                <Text style={s.modalClose}>x</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.authModalBody} keyboardShouldPersistTaps="handled">
              {modalError ? <Text style={s.modalErrorText}>{modalError}</Text> : null}
              {modalMessage ? <Text style={s.modalInfoText}>{modalMessage}</Text> : null}
              <TextInput
                style={s.modalInput}
                value={signupForm.fullName}
                onChangeText={(value) => setSignupForm((current) => ({ ...current, fullName: value }))}
                placeholder="Full name"
                placeholderTextColor="rgba(255,255,255,0.48)"
              />
              <TextInput
                style={s.modalInput}
                value={signupForm.phone}
                onChangeText={(value) => setSignupForm((current) => ({ ...current, phone: value }))}
                placeholder="Phone number"
                placeholderTextColor="rgba(255,255,255,0.48)"
                keyboardType="phone-pad"
              />
              <TextInput
                style={s.modalInput}
                value={signupForm.email}
                onChangeText={(value) => setSignupForm((current) => ({ ...current, email: value }))}
                placeholder="Email optional"
                placeholderTextColor="rgba(255,255,255,0.48)"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={s.modalInput}
                value={signupForm.password}
                onChangeText={(value) => setSignupForm((current) => ({ ...current, password: value }))}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.48)"
                secureTextEntry
              />
              <TouchableOpacity
                style={[s.modalPrimaryButton, (modalLoading || !canSignup) && s.btnDisabled]}
                onPress={handleSignupSubmit}
                disabled={modalLoading || !canSignup}>
                {modalLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalPrimaryText}>Create Account</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showForgotModal} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.authModalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Text style={s.modalClose}>x</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.authModalBody} keyboardShouldPersistTaps="handled">
              {modalError ? <Text style={s.modalErrorText}>{modalError}</Text> : null}
              {modalMessage ? <Text style={s.modalInfoText}>{modalMessage}</Text> : null}
              {forgotStep === 'email' && (
                <>
                  <TextInput
                    style={s.modalInput}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="Email address"
                    placeholderTextColor="rgba(255,255,255,0.48)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={s.modalPrimaryButton} onPress={handleForgotEmailSubmit} disabled={modalLoading}>
                    {modalLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalPrimaryText}>Send Reset Code</Text>}
                  </TouchableOpacity>
                </>
              )}
              {forgotStep === 'otp' && (
                <>
                  <TextInput
                    style={[s.modalInput, s.modalOtpInput]}
                    value={forgotOtp}
                    onChangeText={(value) => {
                      const code = value.replace(/\D/g, '').slice(0, OTP_DIGITS);
                      setForgotOtp(code);
                      if (code.length === OTP_DIGITS) {
                        setTimeout(() => handleForgotOtpSubmit(code), 0);
                      }
                    }}
                    placeholder="000000"
                    placeholderTextColor="rgba(255,255,255,0.48)"
                    keyboardType="number-pad"
                    maxLength={OTP_DIGITS}
                  />
                  <TouchableOpacity style={s.modalPrimaryButton} onPress={() => handleForgotOtpSubmit()} disabled={modalLoading}>
                    {modalLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalPrimaryText}>Verify Code</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleForgotEmailSubmit} disabled={modalLoading}>
                    <Text style={s.modalLinkText}>Resend Code</Text>
                  </TouchableOpacity>
                </>
              )}
              {forgotStep === 'password' && (
                <>
                  <TextInput
                    style={s.modalInput}
                    value={forgotPassword}
                    onChangeText={setForgotPassword}
                    placeholder="New password"
                    placeholderTextColor="rgba(255,255,255,0.48)"
                    secureTextEntry
                  />
                  <TouchableOpacity style={s.modalPrimaryButton} onPress={handleForgotPasswordSubmit} disabled={modalLoading}>
                    {modalLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.modalPrimaryText}>Update Password</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COUNTRY CODE MODAL */}
      <Modal visible={showCountryModal} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalScroll}>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={s.countryItem}
                  onPress={() => {
                    setCountryCode(item.code);
                    setShowCountryModal(false);
                  }}>
                  <Text style={s.countryItemFlag}>{item.flag}</Text>
                  <View style={s.countryItemText}>
                    <Text style={s.countryItemName}>{item.country}</Text>
                    <Text style={s.countryItemCode}>{item.code}</Text>
                  </View>
                  {countryCode === item.code && <Text style={s.countryItemCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  progressWrap: { flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  progressDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressNum: { fontSize: 12, fontWeight: '700', color: colors.textFaint },
  progressNumActive: { color: '#fff', fontSize: 14 },
  progressLine: { width: 16, height: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.primary },

  errorBox: { backgroundColor: 'rgba(244,93,115,0.15)', borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#f45d73' },
  errorText: { color: '#f45d73', fontSize: 13, fontWeight: '600' },
  infoBox: { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#22c55e' },
  infoText: { color: '#22c55e', fontSize: 13, fontWeight: '600' },

  btnDisabled: { opacity: 0.5 },

  timerRow: { alignItems: 'center', marginBottom: 12 },
  timerText: { color: colors.textMuted, fontSize: 13 },
  resendButton: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12 },
  resendText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  resendTextDisabled: { opacity: 0.5 },

  backBtn: { paddingVertical: 12, alignItems: 'center' },
  backBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  eyeBtn: { marginLeft: 12, paddingHorizontal: 12 },
  eyeBtnText: { fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  modalClose: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
  modalScroll: { maxHeight: '100%' },

  countryItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryItemFlag: { fontSize: 24, marginRight: 12 },
  countryItemText: { flex: 1 },
  countryItemName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  countryItemCode: { fontSize: 12, color: colors.textMuted },
  countryItemCheck: { color: colors.primary, fontSize: 16, fontWeight: '700' },

  root: {
    flex: 1,
    backgroundColor: '#030814',
  },
  networkLineOne: {
    position: 'absolute',
    width: 760,
    height: 1,
    backgroundColor: 'rgba(76,201,255,0.28)',
    top: 292,
    left: -180,
    transform: [{ rotate: '-7deg' }],
  },
  networkLineTwo: {
    position: 'absolute',
    width: 760,
    height: 1,
    backgroundColor: 'rgba(76,201,255,0.20)',
    top: 374,
    left: -160,
    transform: [{ rotate: '13deg' }],
  },
  networkLineThree: {
    position: 'absolute',
    width: 620,
    height: 1,
    backgroundColor: 'rgba(100,220,255,0.18)',
    top: 430,
    left: -120,
    transform: [{ rotate: '-18deg' }],
  },
  electricLineLeft: {
    position: 'absolute',
    width: 180,
    height: 3,
    backgroundColor: '#1fbfff',
    left: -42,
    top: 315,
    shadowColor: '#23c9ff',
    shadowOpacity: 1,
    shadowRadius: 18,
    transform: [{ rotate: '6deg' }],
  },
  electricLineRight: {
    position: 'absolute',
    width: 160,
    height: 3,
    backgroundColor: '#18b8ff',
    right: -54,
    top: 356,
    shadowColor: '#23c9ff',
    shadowOpacity: 1,
    shadowRadius: 18,
    transform: [{ rotate: '-32deg' }],
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 44,
    paddingBottom: 22,
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroLogo: {
    width: '78%',
    maxWidth: 320,
    height: 102,
  },
  progressRow: {
    display: 'none',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 0,
    height: 92,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.18)',
    marginBottom: 0,
  },
  tab: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 10,
  },
  tabText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 20,
    fontWeight: '700',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    display: 'none',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 64,
    marginHorizontal: 28,
    marginBottom: 112,
  },
  flagBox: {
    width: 32,
    height: 24,
    borderRadius: 3,
    backgroundColor: '#0b0d12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  countryButtonText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 20,
    fontWeight: '600',
  },
  countryArrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    fontWeight: '700',
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  helper: {
    color: 'rgba(255,255,255,0.7)',
    marginHorizontal: 34,
    marginBottom: 36,
    textAlign: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  forgotBtn: {
    alignItems: 'center',
  },
  signupText: {
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    fontSize: 16,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginHorizontal: 28,
    marginBottom: 28,
  },
  otpBox: {
    flex: 1,
    height: 58,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.52)',
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 34,
    marginBottom: 32,
  },
  passwordInput: {
    flex: 1,
    height: 62,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.56)',
    color: '#fff',
    fontSize: 18,
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#02030a',
  },
  blueGlowLeft: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(18,200,255,0.22)',
    left: -250,
    top: -74,
  },
  blueGlowRight: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(177,60,255,0.20)',
    right: -214,
    bottom: -110,
  },
  glassCard: {
    minHeight: 420,
    maxHeight: 500,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,10,24,0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(18,200,255,0.62)',
    shadowColor: LOGO_CYAN,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    marginBottom: 42,
  },
  tabActive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderBottomWidth: 5,
    borderBottomColor: LOGO_CYAN,
  },
  tabTextActive: {
    color: LOGO_CYAN,
  },
  countryButton: {
    width: 138,
    height: 58,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    marginBottom: 0,
    backgroundColor: 'rgba(8,17,38,0.94)',
    borderWidth: 1.4,
    borderColor: 'rgba(18,200,255,0.48)',
  },
  input: {
    height: 58,
    borderRadius: 10,
    backgroundColor: 'rgba(8,17,38,0.94)',
    borderWidth: 1.4,
    borderColor: 'rgba(18,200,255,0.48)',
    color: '#fff',
    fontSize: 20,
    fontWeight: '400',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  btn: {
    height: 62,
    borderRadius: 10,
    backgroundColor: LOGO_CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 28,
    marginBottom: 20,
    shadowColor: LOGO_CYAN,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  forgotText: {
    color: '#d9f7ff',
    fontSize: 18,
    textDecorationLine: 'underline',
  },
  signupLink: {
    color: LOGO_PURPLE,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  authModalContent: {
    backgroundColor: '#050a18',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(18,200,255,0.35)',
    maxHeight: '86%',
  },
  authModalBody: {
    padding: 18,
    paddingBottom: 28,
    gap: 12,
  },
  modalInput: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(8,17,38,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(18,200,255,0.36)',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
  },
  modalOtpInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 4,
    fontWeight: '800',
  },
  modalPrimaryButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: LOGO_CYAN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalErrorText: {
    color: '#ff6b8a',
    fontSize: 13,
    fontWeight: '700',
  },
  modalInfoText: {
    color: LOGO_CYAN,
    fontSize: 13,
    fontWeight: '700',
  },
  modalLinkText: {
    color: LOGO_PURPLE,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 8,
  },
});
