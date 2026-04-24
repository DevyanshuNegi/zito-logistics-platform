import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { normalizeRole } from '../utils/roles';

export const AuthContext = createContext<any>(null);

const normalizeUser = (userData: any) => {
  if (!userData) return null;

  return {
    ...userData,
    role: normalizeRole(userData.role) || 'customer',
  };
};

export const AuthProvider = ({ children }: any) => {

  const [user, setUser] = useState<any>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const savedUser  = localStorage.getItem('user');
    const savedToken = localStorage.getItem('accessToken');
    const savedAdminUser = localStorage.getItem('adminUser');

    if (savedUser && savedToken) {
      try {
        const parsedUser = normalizeUser(JSON.parse(savedUser));
        setUser(parsedUser);

        if (parsedUser?.role) {
          localStorage.setItem('userRole', parsedUser.role);
        }

        if (savedAdminUser) {
          setAdminUser(normalizeUser(JSON.parse(savedAdminUser)));
        }
      } catch {
        setUser(null);
      }
    }

    setLoading(false);

  }, []);


  const login = (userData: any, token: any) => {
    const normalizedUser = normalizeUser(userData);

    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('userRole', normalizedUser?.role || 'customer');

    if (normalizedUser?.admin_scope) {
      localStorage.setItem('adminScope', normalizedUser.admin_scope);
    }

    setAdminUser(null);
    setUser(normalizedUser);
  };


  const startViewAs = (targetUser: any) => {
    if (!user) return false;

    const normalizedTarget = normalizeUser(targetUser);
    localStorage.setItem('adminUser', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(normalizedTarget));
    localStorage.setItem('userRole', normalizedTarget?.role || 'customer');

    setAdminUser(user);
    setUser(normalizedTarget);
    return true;
  };

  const endViewAs = () => {
    if (!adminUser) return false;

    localStorage.removeItem('adminUser');
    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.setItem('userRole', adminUser?.role || 'customer');

    setUser(adminUser);
    setAdminUser(null);
    return true;
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
      localStorage.removeItem('adminUser');

      setUser(null);
      setAdminUser(null);

    }
  };


  const hasRole = (allowedRoles: any) => {

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
        adminUser,
        loading,
        login,
        logout,
        hasRole,
        startViewAs,
        endViewAs,
        isViewingAs: !!adminUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => useContext(AuthContext);