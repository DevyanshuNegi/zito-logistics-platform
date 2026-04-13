// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await AsyncStorage.multiGet(['accessToken', 'user']);
        if (t[1] && u[1]) { setToken(t[1]); setUser(JSON.parse(u[1])); }
      } catch (e) { console.warn('Auth restore error:', e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const login = async (userData, accessToken) => {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData); setToken(accessToken);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['accessToken', 'user']);
    setUser(null); setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
