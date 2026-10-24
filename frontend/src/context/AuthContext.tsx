import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types.js';
import { apiRequest, setStoredToken, clearStoredToken, getStoredToken } from '../services/api.js';

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: User;
  requiresPasswordChange?: boolean;
  identifier?: string;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<LoginResult | undefined>;
  quickSwitchRole: (role: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface RolePreset {
  email: string;
  label: string;
  desc: string;
  category: 'all' | 'boys' | 'girls';
}

// Authorized system role preset for initial administrative access
export const ROLE_PRESETS: Record<string, RolePreset> = {
  super_admin: {
    email: 'admin@aknu.edu.in',
    label: 'Super Admin',
    desc: 'Dr. K. S. Rao • Campus-wide governance (All Wings)',
    category: 'all'
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; user: User }>('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        clearStoredToken();
        setUser(null);
      }
    } catch (e) {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password = 'Aknu@2026!') => {
    setLoading(true);
    try {
      const res = await apiRequest<LoginResult>('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      if (res.requiresPasswordChange) {
        return res;
      }
      if (res.success && res.token && res.user) {
        setStoredToken(res.token);
        setUser(res.user);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const quickSwitchRole = async (role: string) => {
    const preset = ROLE_PRESETS[role];
    if (preset) {
      await login(preset.email, 'Aknu@2026!');
      try {
        const targetTab = role === 'student' ? 'mess' : 'dashboard';
        const targetUrl = targetTab === 'dashboard' ? '/' : `/${targetTab}`;
        window.history.replaceState({ tab: targetTab }, '', targetUrl);
      } catch {}
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    try {
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        window.history.replaceState({ tab: 'dashboard' }, '', '/');
      }
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, quickSwitchRole, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
