'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearOtpSession,
  clearPendingRegistration,
  clearSession,
  getOtpSession,
  getPendingRegistration,
  getStoredSession,
  persistOtpSession,
  persistPendingRegistration,
  persistSession,
  type OtpSession,
  type PendingRegistration,
  type SessionUser,
  type StoredSession,
} from '@/lib/api';

type AuthContextValue = {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  otpSession: ReturnType<typeof getOtpSession>;
  pendingRegistration: PendingRegistration | null;
  login: (session: StoredSession) => void;
  logout: () => void;
  saveOtpSession: (session: OtpSession) => void;
  clearOtp: () => void;
  savePendingRegistration: (registration: PendingRegistration) => void;
  clearPending: () => void;
  refreshFromStorage: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [otpSession, setOtpSession] = useState(getOtpSession());
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(
    getPendingRegistration(),
  );

  const refreshFromStorage = () => {
    const session = getStoredSession();
    setUser(session.user);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    setOtpSession(getOtpSession());
    setPendingRegistration(getPendingRegistration());
  };

  useEffect(() => {
    refreshFromStorage();
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    refreshToken,
    loading,
    otpSession,
    pendingRegistration,
    login: (session) => {
      persistSession(session);
      clearOtpSession();
      setOtpSession(null);
      setUser(session.user);
      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken ?? null);
    },
    logout: () => {
      clearSession();
      clearOtpSession();
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setOtpSession(null);
    },
    saveOtpSession: (session) => {
      persistOtpSession(session);
      setOtpSession(getOtpSession());
    },
    clearOtp: () => {
      clearOtpSession();
      setOtpSession(null);
    },
    savePendingRegistration: (registration) => {
      persistPendingRegistration(registration);
      setPendingRegistration(registration);
    },
    clearPending: () => {
      clearPendingRegistration();
      setPendingRegistration(null);
    },
    refreshFromStorage,
  }), [accessToken, loading, otpSession, pendingRegistration, refreshToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return context;
}
