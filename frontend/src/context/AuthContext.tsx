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

// Authorized system roles with active portal access presets
export const ROLE_PRESETS: Record<string, RolePreset> = {
  super_admin: {
    email: 'admin@aknu.edu.in',
    label: 'Super Admin',
    desc: 'Dr. K. S. Rao • Campus-wide governance (All Wings)',
    category: 'all'
  },
  chief_warden_boys: {
    email: 'chiefwarden.boys@aknu.edu.in',
    label: 'Chief Warden (Boys)',
    desc: 'Chief Warden • Boys Wing Admissions & Late Meal Approvals',
    category: 'boys'
  },
  chief_warden_girls: {
    email: 'chiefwarden.girls@aknu.edu.in',
    label: 'Chief Warden (Girls)',
    desc: 'Chief Warden • Girls Wing Admissions & Late Meal Approvals',
    category: 'girls'
  },
  assistant_warden_boys: {
    email: 'warden.boys@aknu.edu.in',
    label: 'Assistant Warden (Boys)',
    desc: 'Assistant Warden • Boys Hostel Inspection & Approvals',
    category: 'boys'
  },
  assistant_warden_girls: {
    email: 'warden.girls@aknu.edu.in',
    label: 'Assistant Warden (Girls)',
    desc: 'Assistant Warden • Girls Hostel Inspection & Approvals',
    category: 'girls'
  },
  junior_assistant_boys: {
    email: 'ja.boys@aknu.edu.in',
    label: 'Junior Assistant (Boys)',
    desc: 'Junior Assistant • Boys Room Allocation & Mess Face Scanning',
    category: 'boys'
  },
  junior_assistant_girls: {
    email: 'ja.girls@aknu.edu.in',
    label: 'Junior Assistant (Girls)',
    desc: 'Junior Assistant • Girls Room Allocation & Mess Face Scanning',
    category: 'girls'
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
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
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
