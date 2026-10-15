import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  LayoutDashboard,
  QrCode,
  Users,
  Building2,
  CalendarCheck,
  AlertCircle,
  UtensilsCrossed,
  ReceiptIndianRupee,
  ShieldAlert,
  CreditCard,
  Contact,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'meal-scanner'
  | 'students'
  | 'hostels'
  | 'staff-records'
  | 'leave'
  | 'complaints'
  | 'mess'
  | 'accounts'
  | 'security'
  | 'my-id';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenDigitalId: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenDigitalId,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { user } = useAuth();
  const role = user?.role || 'student';

  // Role permissions for sidebar tabs
  const canAccessDashboard = role !== 'student';
  const canAccessScanner = ['super_admin', 'chief_warden', 'hostel_warden', 'mess_manager'].includes(role);
  const canAccessStudents = ['super_admin', 'chief_warden', 'hostel_warden'].includes(role);
  const canAccessHostels = ['super_admin', 'chief_warden', 'hostel_warden'].includes(role);
  const canAccessStaff = ['super_admin', 'chief_warden', 'hostel_warden'].includes(role);
  const canAccessMess = ['super_admin', 'chief_warden', 'hostel_warden', 'mess_manager', 'student'].includes(role);
  const canAccessAccounts = ['super_admin', 'chief_warden', 'hostel_warden', 'student'].includes(role);
  const canAccessSecurity = ['super_admin', 'chief_warden', 'hostel_warden'].includes(role);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: canAccessDashboard },
    {
      id: 'meal-scanner',
      label: 'Meal QR Scanner',
      icon: QrCode,
      show: canAccessScanner,
      badge: 'Live'
    },
    { id: 'students', label: 'Student Records', icon: Users, show: canAccessStudents },
    { id: 'hostels', label: 'Hostels & Rooms', icon: Building2, show: canAccessHostels },
    { id: 'staff-records', label: 'Staff Directory', icon: Contact, show: canAccessStaff },
    { id: 'leave', label: 'Leave & Gate Pass', icon: CalendarCheck, show: true },
    {
      id: 'mess',
      label: role === 'student' ? 'Hostel Menu' : 'Mess Operations',
      icon: UtensilsCrossed,
      show: canAccessMess
    },
    { id: 'security', label: 'Visitor Logs', icon: ShieldAlert, show: canAccessSecurity }
  ];

  return (
    <aside
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      className={`fixed top-16 left-0 bottom-0 ${isCollapsed ? 'w-20' : 'w-64'
        } bg-[#23395D] text-[#DCE5F1] flex flex-col justify-between border-r border-[#192B47] shadow-xl z-20 overflow-y-auto no-scrollbar transition-all duration-300 ease-in-out`}
    >
      <div className={`${isCollapsed ? 'p-2' : 'p-3.5'} space-y-3`}>
        {/* Expand / Collapse Control Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#354D70]/40">
          {!isCollapsed && (
            <span className="text-[10px] font-bold tracking-wider text-[#A9C0E4] uppercase px-1">
              Hostel Navigation
            </span>
          )}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-lg text-[#F0E0D2] hover:text-white bg-[#192B47]/90 hover:bg-[#354D70] border border-[#354D70]/60 transition shadow-xs ${isCollapsed ? 'mx-auto' : ''
                }`}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[#E0AD83]" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-[#A9C0E4]" />
              )}
            </button>
          )}
        </div>

        {/* User Card */}
        {!isCollapsed ? (
          <div className="bg-[#192B47]/80 rounded-lg p-3 border border-[#354D70]/60 shadow-inner flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#92582F] to-[#C27D48] flex items-center justify-center font-bold text-white shadow shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{user?.fullName}</h4>
              <span className="text-[11px] text-[#F0E0D2] font-medium block truncate">
                {user?.roleDisplay}
              </span>
              {user?.assignedCategory === 'boys' && (
                <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/40 tracking-wider">
                  Boys Wing
                </span>
              )}
              {user?.assignedCategory === 'girls' && (
                <span className="inline-block mt-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/40 tracking-wider">
                  Girls Wing
                </span>
              )}

            </div>
          </div>
        ) : (
          <div className="relative group flex justify-center py-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#92582F] to-[#C27D48] flex items-center justify-center font-bold text-white shadow ring-2 ring-[#354D70] cursor-pointer">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#192B47] text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap z-50 border border-[#354D70] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
              <p className="font-bold">{user?.fullName}</p>
              <p className="text-[10px] text-[#E0AD83]">{user?.roleDisplay}</p>
            </div>
          </div>
        )}

        {/* Student Digital ID Card Quick Button */}
        {role === 'student' && (
          <>
            {!isCollapsed ? (
              <button
                onClick={onOpenDigitalId}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-[#92582F] hover:bg-[#754522] text-white font-semibold text-xs rounded-md shadow-md transition transform active:scale-95"
              >
                <CreditCard className="w-4 h-4 text-[#F0E0D2]" />
                <span>Show My QR Digital ID</span>
              </button>
            ) : (
              <div className="relative group flex justify-center">
                <button
                  onClick={onOpenDigitalId}
                  className="w-10 h-10 flex items-center justify-center bg-[#92582F] hover:bg-[#754522] text-white rounded-md shadow-md transition transform active:scale-95"
                  title="Show My QR Digital ID"
                  aria-label="Show My QR Digital ID"
                >
                  <CreditCard className="w-4 h-4 text-[#F0E0D2]" />
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#192B47] text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap z-50 border border-[#354D70] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                  Show My QR Digital ID
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation list */}
        <nav className="space-y-1">
          {!isCollapsed && (
            <p className="text-[10px] font-bold tracking-wider text-[#A9C0E4] uppercase px-3 mb-2">
              System Modules
            </p>
          )}
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => onSelectTab(item.id as ActiveTab)}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                      } rounded-md text-sm font-medium transition ${isActive
                        ? 'bg-[#354D70] text-white shadow-md border-l-4 border-[#92582F]'
                        : 'hover:bg-[#354D70]/60 hover:text-white text-[#DCE5F1]'
                      }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F0E0D2]' : 'text-[#A9C0E4]'}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge && (
                      <span className="text-[10px] bg-[#92582F]/30 text-[#F0E0D2] border border-[#92582F]/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        {item.badge}
                      </span>
                    )}
                    {isCollapsed && item.badge && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E0AD83] ring-2 ring-[#23395D]" />
                    )}
                  </button>

                  {/* Floating tooltip on hover in collapsed mode */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#192B47] text-white text-xs font-semibold rounded-md shadow-xl whitespace-nowrap z-50 border border-[#354D70] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="ml-2 text-[9px] bg-[#92582F] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>
      </div>

      {/* University Footer info */}
      {!isCollapsed ? (
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300">AKNU Centralized Hostels</p>
          <p className="text-[10px] text-slate-400">Session 2026-2027 • v1.0.0</p>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-800 text-center">
          <span className="text-[10px] font-bold text-[#A9C0E4] tracking-wider block">AKNU</span>
        </div>
      )}
    </aside>
  );
};
