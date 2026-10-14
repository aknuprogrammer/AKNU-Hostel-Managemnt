import React, { useState } from 'react';
import { useAuth, ROLE_PRESETS } from './context/AuthContext.js';
import { UserRole } from './types.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar, ActiveTab } from './components/Sidebar.js';
import { RoleSwitcherModal } from './components/RoleSwitcherModal.js';
import { DigitalIdCardModal } from './components/DigitalIdCardModal.js';
import { AknuLogo } from './components/AknuLogo.js';

import { DashboardPage } from './pages/DashboardPage.js';
import { MealScannerPage } from './pages/MealScannerPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { HostelsPage } from './pages/HostelsPage.js';
import { LeavePage } from './pages/LeavePage.js';
import { ComplaintsPage } from './pages/ComplaintsPage.js';
import { MessPage } from './pages/MessPage.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { SecurityPage } from './pages/SecurityPage.js';
import { StaffRecordsPage } from './pages/StaffRecordsPage.js';

import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading, login, quickSwitchRole } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showDigitalId, setShowDigitalId] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aknu_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aknu_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLoginFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-white">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide">Initializing AKNU Hostels Portal...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render Login Screen with Role Presets
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F3ED] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl w-full bg-white rounded-lg shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-[#DED8CF]">
          {/* Left Hero side */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#23395D] via-[#192B47] to-[#151A22] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#92582F]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Official University Emblem */}
              <div className="flex items-center space-x-3">
                <AknuLogo size="xl" />
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide leading-tight drop-shadow-sm">
                  ADIKAVI NANNAYA UNIVERSITY
                </h1>
                <p className="text-xs sm:text-sm text-[#E0AD83] font-bold tracking-widest uppercase mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E0AD83]" />
                  Hostel Management Portal
                </p>
              </div>

              <p className="text-sm text-[#DCE5F1] leading-relaxed">
                Centralized boys' and girls' hostel allocation system, biometric-verifiable cryptographic meal QR credentials, and university residential governance.
              </p>

              <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[#F0E0D2]">
                <span className="px-2.5 py-1 rounded-md bg-[#354D70]/60 border border-[#A9C0E4]/30">
                  Godavari & Krishna Bhavan
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#354D70]/60 border border-[#A9C0E4]/30">
                  Saraswati & Gautami Bhavan
                </span>
              </div>
            </div>

            <div className="relative z-10 pt-8 mt-6 border-t border-[#354D70] text-xs text-[#A9C0E4] space-y-0.5">
              <p className="font-bold text-white text-xs">Adikavi Nannaya University, Rajamahendravaram</p>
              <p className="text-[11px] text-[#A9C0E4]">Government of Andhra Pradesh • Academic Year 2026-27</p>
            </div>
          </div>

          {/* Right Login & 1-Click Role Presets */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between space-y-6 bg-white">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#202B3C]">
                Sign In to Your Account
              </h2>
              <p className="text-sm text-[#5C6675] mt-1.5">
                Enter your university staff or student credentials to access the portal.
              </p>

              {loginError && (
                <div className="mt-4 p-3.5 rounded-md bg-[#FEE2E2] border border-[#991B1B]/30 text-[#991B1B] text-xs sm:text-sm font-semibold flex items-center space-x-2">
                  <span className="font-bold">Error:</span>
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginFormSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#202B3C] block mb-1.5">
                    University Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-[#737C89] absolute left-3.5 top-3.5" />
                    <input
                      required
                      type="email"
                      placeholder="e.g. admin@aknu.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#FCFAF7] border border-[#DED8CF] rounded-md text-sm text-[#202B3C] placeholder-[#737C89] focus:outline-none focus:border-[#5276A5] focus:ring-2 focus:ring-[#5276A5]/20 shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-[#202B3C] block mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-[#737C89] absolute left-3.5 top-3.5" />
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3 bg-[#FCFAF7] border border-[#DED8CF] rounded-md text-sm text-[#202B3C] placeholder-[#737C89] focus:outline-none focus:border-[#5276A5] focus:ring-2 focus:ring-[#5276A5]/20 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-[#737C89] hover:text-[#202B3C] focus:outline-none transition p-0.5 rounded"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3.5 bg-[#23395D] hover:bg-[#192B47] text-white font-extrabold text-sm tracking-wide rounded-md shadow-md hover:shadow-lg transition transform active:scale-[0.99] flex items-center justify-center space-x-2 mt-2"
                >
                  <span>{loggingIn ? 'Authenticating...' : 'Sign In to Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* 1-Click Role Login Shortcuts for Evaluators */}
            <div className="pt-6 border-t border-[#E8E1D7]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-[#737C89] uppercase tracking-wider">
                  1-Click Active Role Logins
                </span>
                <span className="text-[11px] text-[#92582F] font-semibold bg-[#F0E0D2] px-2 py-0.5 rounded">
                  Quick Access
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.keys(ROLE_PRESETS).map((rKey) => {
                  const r = ROLE_PRESETS[rKey];
                  if (!r) return null;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => quickSwitchRole(rKey)}
                      className="p-2.5 rounded-md bg-[#FCFAF7] hover:bg-[#F0E0D2]/50 border border-[#DED8CF] hover:border-[#92582F] text-left transition shadow-2xs hover:shadow-xs group"
                    >
                      <span className="text-xs font-bold text-[#202B3C] group-hover:text-[#92582F] block truncate">
                        {r.label}
                      </span>
                      <span className="text-[10px] text-[#5C6675] font-mono block truncate mt-0.5">
                        {r.email.split('@')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Portal Layout
  return (
    <div className="min-h-screen bg-[#F7F3ED] flex flex-col">
      <Navbar
        onOpenRoleSwitcher={() => setShowRoleSwitcher(true)}
        onOpenDigitalId={() => setShowDigitalId(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <div className="flex-1 flex w-full">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenDigitalId={() => setShowDigitalId(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        <main className={`flex-1 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} p-4 sm:p-5 lg:p-6 min-w-0 overflow-y-auto transition-all duration-300 ease-in-out`}>
          {activeTab === 'dashboard' && <DashboardPage onNavigateTo={setActiveTab} />}
          {activeTab === 'meal-scanner' && <MealScannerPage />}
          {activeTab === 'students' && <StudentsPage />}
          {activeTab === 'hostels' && <HostelsPage />}
          {activeTab === 'staff-records' && <StaffRecordsPage />}
          {activeTab === 'leave' && <LeavePage />}
          {activeTab === 'complaints' && <ComplaintsPage />}
          {activeTab === 'mess' && <MessPage />}
          {activeTab === 'accounts' && <AccountsPage />}
          {activeTab === 'security' && <SecurityPage />}
        </main>
      </div>

      {/* Role Switcher Modal */}
      <RoleSwitcherModal
        isOpen={showRoleSwitcher}
        onClose={() => setShowRoleSwitcher(false)}
      />

      {/* Student Digital ID Card Modal */}
      <DigitalIdCardModal
        student={user.student || null}
        isOpen={showDigitalId}
        onClose={() => setShowDigitalId(false)}
      />
    </div>
  );
};
