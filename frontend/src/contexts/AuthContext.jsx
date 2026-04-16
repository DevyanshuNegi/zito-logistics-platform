import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { normalizeRole } from '../utils/roles';

const AuthContext = createContext();

const normalizeUser = (userData) => {
  if (!userData) return null;

  return {
    ...userData,
    role: normalizeRole(userData.role) || 'customer',
  };
};

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const savedUser  = localStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken');

    if (savedUser && savedToken) {
      try {
        const parsedUser = normalizeUser(JSON.parse(savedUser));
        setUser(parsedUser);

        if (parsedUser?.role) {
          localStorage.setItem('userRole', parsedUser.role);
        }
      } catch {
        setUser(null);
      }
    }

    setLoading(false);

  }, []);


  const login = (userData, token) => {
    const normalizedUser = normalizeUser(userData);

    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('userRole', normalizedUser?.role || 'customer');

    if (normalizedUser?.admin_scope) {
      localStorage.setItem('adminScope', normalizedUser.admin_scope);
    }

    setUser(normalizedUser);
  };


  const logout = async () => {

    try {

      const token = localStorage.getItem('accessToken');

      if (token) {
        await api.post('/api/v1/auth/logout');
      }

    } catch {
      // ignore error
    } finally {

      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      localStorage.removeItem('adminScope');

      setUser(null);

    }
  };


  const hasRole = (allowedRoles) => {

    if (!user) return false;

    const role = normalizeRole(user.role || localStorage.getItem('userRole'));

    if (!role) return false;

    if (Array.isArray(allowedRoles)) {
      return allowedRoles.map(normalizeRole).includes(role);
    }

    return role === normalizeRole(allowedRoles);
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => useContext(AuthContext);
