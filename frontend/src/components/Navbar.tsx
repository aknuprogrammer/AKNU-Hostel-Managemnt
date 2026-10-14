import React from 'react';
import { useAuth, ROLE_PRESETS } from '../context/AuthContext.js';
import { ShieldCheck, UserCircle, LogOut, RefreshCw, QrCode, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AknuLogo } from './AknuLogo.js';

interface NavbarProps {
  onOpenRoleSwitcher: () => void;
  onOpenDigitalId?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenRoleSwitcher,
  onOpenDigitalId,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#23395D] text-white shadow-md border-b border-[#192B47] sticky top-0 z-30">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end h-16 items-center">
          {/* User profile, Quick Role Switcher & Action buttons */}
          <div className="flex items-center space-x-3">
            {/* 1-Click Role Switcher Button for Evaluation */}
            {/* <button
              onClick={onOpenRoleSwitcher}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#192B47] hover:bg-[#354D70] text-[#F0E0D2] border border-[#354D70] text-xs font-semibold transition shadow-sm"
              title="Switch between active authorized roles"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-hover text-[#E0AD83]" />
              <span className="hidden md:inline">Switch Role:</span>
              <span className="bg-[#92582F] text-white px-1.5 py-0.2 rounded font-bold">
                {user ? ROLE_PRESETS[user.role]?.label || user.role : 'Guest'}
              </span>
            </button> */}

            {/* Student quick QR ID button */}
            {user?.role === 'student' && onOpenDigitalId && (
              <button
                onClick={onOpenDigitalId}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">My Digital ID</span>
              </button>
            )}

            {/* Active User Info */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-sm font-semibold text-white leading-tight">{user?.fullName}</span>
              <span className="text-[11px] text-slate-300">{user?.roleDisplay}</span>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-md bg-slate-800/80 hover:bg-red-900/40 text-slate-300 hover:text-red-300 border border-slate-700 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
