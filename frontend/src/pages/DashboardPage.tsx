import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../services/api.js';
import {
  Users,
  Building2,
  UtensilsCrossed,
  AlertCircle,
  CalendarCheck,
  Clock,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Megaphone
} from 'lucide-react';
import {
  Button,
  Badge
} from '../components/ui/index.js';

interface DashboardStats {
  totalStudents: number;
  totalHostels: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  todayMealsCount: number;
  activeComplaintsCount: number;
  pendingLeavesCount: number;
  activeSession: any;
  announcements: any[];
  recentAudits: any[];
  hostels?: any[];
  assignedCategory?: 'boys' | 'girls' | 'all';
}

export const DashboardPage: React.FC<{ onNavigateTo: (tab: any) => void }> = ({ onNavigateTo }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
      if (res.success) {
        setStats(res.data);
      }
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'student') {
      onNavigateTo('mess');
      return;
    }
    fetchStats();
  }, [user?.role]);

  if (user?.role === 'student') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aknu-blue"></div>
      </div>
    );
  }

  const role = user?.role || 'student';

  return (
    <div className="space-y-3">
      {/* Welcome Banner */}
      

      {/* ACTIVE MEAL SESSION STATUS BAR */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">
                Active Meal Session: {stats?.activeSession ? stats.activeSession.name : 'Counter Closed'}
              </h3>
              <Badge
                variant={stats?.activeSession ? 'success' : 'neutral'}
                dot={!!stats?.activeSession}
              >
                {stats?.activeSession ? 'Serving Now' : 'Closed'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats?.activeSession
                ? `Service window: ${stats.activeSession.start_time} - ${stats.activeSession.end_time} • Grace: ${stats.activeSession.grace_minutes}m`
                : 'Next configured meal service will open automatically according to the schedule.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 self-end sm:self-center">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Today's Meals Recorded</span>
            <span className="text-lg font-extrabold text-aknu-blue">{stats?.todayMealsCount || 0}</span>
          </div>
        </div>
      </div>

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Total Students */}
        <div
          onClick={() => onNavigateTo('students')}
          className="bg-white rounded-lg p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Residents</span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-extrabold text-slate-900">{stats?.totalStudents || 0}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Active hostel boarders
            </p>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div
          onClick={() => onNavigateTo('hostels')}
          className="bg-white rounded-lg p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bed Occupancy</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-extrabold text-slate-900">{stats?.occupancyRate || 0}%</h3>
              <span className="text-xs text-slate-500 font-medium">
                {stats?.occupiedBeds} / {stats?.totalBeds} beds
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${stats?.occupancyRate || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pending Leaves */}
        <div
          onClick={() => onNavigateTo('leave')}
          className="bg-white rounded-lg p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Leave Requests</span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-extrabold text-slate-900">{stats?.pendingLeavesCount || 0}</h3>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              Pending warden approval
            </p>
          </div>
        </div>

        {/* Active Complaints */}
        <div
          onClick={() => onNavigateTo('complaints')}
          className="bg-white rounded-lg p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Open Complaints</span>
            <div className="w-8 h-8 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-extrabold text-slate-900">{stats?.activeComplaintsCount || 0}</h3>
            <p className="text-[11px] text-red-500 font-medium mt-0.5">
              Requires maintenance dispatch
            </p>
          </div>
        </div>
      </div>

      {/* University Hostels Snapshot */}
      <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {(user?.assignedCategory === 'boys' || stats?.assignedCategory === 'boys')
                ? "Boys' Hostel Wing Buildings"
                : (user?.assignedCategory === 'girls' || stats?.assignedCategory === 'girls')
                ? "Girls' Hostel Wing Buildings"
                : "University Hostel Buildings"}
            </h3>
            <p className="text-xs text-slate-500">
              {(user?.assignedCategory === 'boys' || stats?.assignedCategory === 'boys')
                ? "Adikavi Nannaya University Boys' Campus Jurisdiction"
                : (user?.assignedCategory === 'girls' || stats?.assignedCategory === 'girls')
                ? "Adikavi Nannaya University Girls' Campus Jurisdiction"
                : "Adikavi Nannaya University Boys' and Girls' Campuses"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onNavigateTo('hostels')}
          >
            View All Hostels →
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {stats?.hostels && stats.hostels.length > 0 ? (
            stats.hostels.map((h: any) => {
              const occRate = h.total_beds > 0 ? Math.round((h.occupied_beds / h.total_beds) * 100) : 0;
              const isBoys = h.category === 'boys';
              return (
                <div
                  key={h.id}
                  onClick={() => onNavigateTo('hostels')}
                  className={`p-4 rounded-md border cursor-pointer hover:shadow-xs transition ${
                    isBoys ? 'border-blue-100/80 bg-blue-50/30' : 'border-purple-100/80 bg-purple-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant={isBoys ? 'primary' : 'neutral'}>{h.code || (isBoys ? 'BH' : 'GH')}</Badge>
                    <span className="text-[11px] text-slate-500 font-medium capitalize">
                      {isBoys ? "Boys' Wing" : "Girls' Wing"}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 mt-2 truncate" title={h.name}>
                    {h.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Capacity: {h.total_beds} beds • {h.occupied_beds} occupied ({occRate}%)
                  </p>
                  <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    Active Residential Wing
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
              No hostels registered in this category yet. Click "View All Hostels" to create one.
            </div>
          )}
        </div>
      </div>

      {/* Announcements & Administrative Audits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-2.5">
        {/* Announcements */}
        <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            <Megaphone className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-base text-slate-900">Official Announcements</h3>
          </div>
          <div className="space-y-2.5">
            {stats?.announcements && stats.announcements.length > 0 ? (
              stats.announcements.map((ann: any) => (
                <div key={ann.id} className="p-3 rounded-md bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">{ann.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{ann.message}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No active announcements</p>
            )}
          </div>
        </div>

        {/* Recent Audit Trail for Admins */}
        <div className="bg-white rounded-lg p-5 shadow-sm border border-slate-200/80">
          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-aknu-blue" />
            <h3 className="font-bold text-base text-slate-900">Security & Operational Audit Log</h3>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {stats?.recentAudits && stats.recentAudits.length > 0 ? (
              stats.recentAudits.map((al: any) => (
                <div key={al.id} className="text-xs p-2 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{al.action}</span>
                    <span className="text-[10px] text-slate-400 block">By: {al.user_name || 'System'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(al.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                Audit logs are restricted to University Administration and Chief Warden personas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
