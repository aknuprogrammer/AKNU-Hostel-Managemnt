import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { LogOut, QrCode } from 'lucide-react';
import { AknuLogo } from './AknuLogo.js';

interface NavbarProps {
  onOpenRoleSwitcher?: () => void;
  onOpenDigitalId?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenDigitalId
}) => {
  const { user, logout } = useAuth();

  // Determine displayed Hostel Name / Wing Title
  const isSuperAdmin = user?.role === 'super_admin';
  const isBoys = user?.assignedCategory === 'boys' || (user?.role === 'student' && user?.student?.gender === 'male');
  const isGirls = user?.assignedCategory === 'girls' || (user?.role === 'student' && user?.student?.gender === 'female');

  // Specific hostel name if allocated or assigned
  const assignedHostels = user?.assignedHostels || [];
  const studentHostelName = user?.student?.hostel_name;
  const firstAssignedName = assignedHostels.length > 0 ? assignedHostels[0].name : null;

  let displayHostelName = 'Hostel Management';
  let badgeStyle = 'bg-slate-700/60 text-slate-200 border-slate-600';
  let dotColor = 'bg-slate-400';

  if (isSuperAdmin) {
    displayHostelName = 'All Hostels (Super Admin)';
    badgeStyle = 'bg-amber-500/20 text-amber-200 border-amber-400/40';
    dotColor = 'bg-amber-400';
  } else if (isBoys) {
    // If allocated or assigned a specific boys hostel, show its name, otherwise "Boys' Hostel"
    const specificName = studentHostelName || firstAssignedName;
    if (specificName) {
      displayHostelName = specificName.toLowerCase().includes('boys')
        ? specificName
        : `${specificName} (Boys' Hostel)`;
    } else {
      displayHostelName = "Boys' Hostel";
    }
    badgeStyle = 'bg-blue-500/25 text-blue-200 border-blue-400/40';
    dotColor = 'bg-blue-400';
  } else if (isGirls) {
    // If allocated or assigned a specific girls hostel, show its name, otherwise "Girls' Hostel"
    const specificName = studentHostelName || firstAssignedName;
    if (specificName) {
      displayHostelName = specificName.toLowerCase().includes('girls')
        ? specificName
        : `${specificName} (Girls' Hostel)`;
    } else {
      displayHostelName = "Girls' Hostel";
    }
    badgeStyle = 'bg-rose-500/25 text-rose-200 border-rose-400/40';
    dotColor = 'bg-rose-400';
  }

  return (
    <header className="bg-[#23395D] text-white shadow-md border-b border-[#192B47] sticky top-0 z-30">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Left: University Logo, University Name, Hostel Management & Boys/Girls Hostel Name */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Official University Emblem */}
            <div className="flex-shrink-0">
              <AknuLogo size="md" className="drop-shadow-md" />
            </div>

            {/* University & Hostel Details */}
            <div className="flex flex-col justify-center min-w-0">
              {/* Primary Line: University Name & Hostel Management */}
              <div className="flex items-center space-x-2">
                <span className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white leading-tight truncate">
                  Adikavi Nannaya University
                </span>
                <span className="text-[#D4AF37] font-bold text-xs sm:text-sm">•</span>
                <span className="text-xs sm:text-sm font-bold text-[#E0AD83] tracking-wide uppercase truncate">
                  Hostel Management
                </span>
              </div>

              {/* Secondary Line: Boys' / Girls' Hostel Name */}
              <div className="flex items-center space-x-2 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wide shadow-xs ${badgeStyle}`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                  <span className="truncate">{displayHostelName}</span>
                </span>
                
              </div>
            </div>
          </div>

          {/* Right: User profile, Student QR ID button & Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
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
              className="p-2 rounded-md bg-slate-800/80 hover:bg-red-900/40 text-slate-300 hover:text-red-300 border border-slate-700 transition cursor-pointer"
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
