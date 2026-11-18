import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { apiRequest } from '../services/api.js';
import { MessMenu, InventoryItem } from '../types.js';
import {
  UtensilsCrossed, Package, Trash2, Plus, AlertTriangle, CheckCircle, Clock, Pencil, Sparkles,
  Users, Calendar, Printer, Check, X, Search, ChefHat, Coffee, Sun, Moon, RefreshCw, SlidersHorizontal, Info, UserCheck, UserX
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Checkbox
} from '../components/ui/index.js';

export const MessPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useConfirm();
  const isStudent = user?.role === 'student';
  const isGirlsStudent = isStudent && (
    user?.student?.gender?.toLowerCase() === 'female' ||
    (user?.student?.hostel_name || '').toLowerCase().includes('girl') ||
    user?.assignedCategory === 'girls'
  );

  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'menu' | 'inventory' | 'wastage'>('attendance');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [menus, setMenus] = useState<MessMenu[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Daily Student Meal Attendance & Kitchen Food Preparation state
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [attendanceCounts, setAttendanceCounts] = useState<any>(null);
  const [attendanceRoster, setAttendanceRoster] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [studentMyMeal, setStudentMyMeal] = useState<{
    date: string;
    breakfast: boolean;
    lunch: boolean;
    snacks: boolean;
    dinner: boolean;
    isOnLeave: boolean;
    leaveType?: string;
  }>({
    date: todayStr,
    breakfast: true,
    lunch: true,
    snacks: true,
    dinner: true,
    isOnLeave: false
  });
  const [togglingMeal, setTogglingMeal] = useState<string | null>(null);
  const [showPrintSlip, setShowPrintSlip] = useState(false);

  // Meal sessions for menu editing
  const [mealSessions, setMealSessions] = useState<any[]>([
    { id: 'ms-breakfast', name: 'Morning Breakfast', code: 'breakfast', start_time: '07:00', end_time: '10:00' },
    { id: 'ms-lunch', name: 'Afternoon Lunch', code: 'lunch', start_time: '12:00', end_time: '15:00' },
    { id: 'ms-snacks', name: 'Evening Snacks', code: 'snacks', start_time: '16:30', end_time: '18:00' },
    { id: 'ms-dinner', name: 'Night Dinner', code: 'dinner', start_time: '19:00', end_time: '22:30' }
  ]);

  // Menu Add / Edit Modal state
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({
    hostelId: '',
    dayOfWeek: 'Monday',
    mealSessionId: 'ms-breakfast',
    menuItems: '',
    isSpecial: false
  });
  const [savingMenu, setSavingMenu] = useState(false);

  // Wastage Log state
  const [wastageData, setWastageData] = useState({
    mealSessionId: 'ms-lunch',
    weightKg: 12.5,
    reason: 'Excess rice & curry after scheduled service'
  });

  // Inventory transaction modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockTx, setStockTx] = useState({
    inventoryItemId: '',
    transactionType: 'IN',
    quantity: 50,
    notes: 'Weekly fresh delivery'
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    fetchHostels();
    fetchMealSessions();
  }, []);

  const fetchMealSessions = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/mess/sessions');
      if (res.success && res.data.length > 0) {
        setMealSessions(res.data);
      }
    } catch (e) {
      // Fallback already initialized in state
    }
  };

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          if (isStudent) {
            const matched = isGirlsStudent
              ? res.data.find((h) => h.category === 'girls' || h.name.toLowerCase().includes('girl'))
              : res.data.find((h) => h.category === 'boys' || h.name.toLowerCase().includes('boy'));
            setSelectedHostel(matched?.id || res.data[0].id);
          } else {
            setSelectedHostel((prev) => prev || res.data[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching hostels:', e);
    }
  };

  // Enforce student's exact hostel lock
  useEffect(() => {
    if (isStudent && hostels.length > 0) {
      const matched = isGirlsStudent
        ? hostels.find((h) => h.category === 'girls' || h.name.toLowerCase().includes('girl'))
        : hostels.find((h) => h.category === 'boys' || h.name.toLowerCase().includes('boy'));
      if (matched && selectedHostel !== matched.id) {
        setSelectedHostel(matched.id);
      }
    }
  }, [isStudent, isGirlsStudent, hostels]);

  useEffect(() => {
    if (selectedHostel) {
      fetchMenus();
      fetchInventory();
    } else {
      setMenus([]);
      setInventory([]);
      setLoading(false);
    }
  }, [selectedDay, selectedHostel]);

  // Attendance Fetch Effect
  useEffect(() => {
    if (isStudent) {
      fetchMyMealAttendance();
    } else {
      fetchAttendanceCounts();
      fetchAttendanceRoster();
    }
  }, [selectedDate, selectedHostel, activeSubTab, isStudent]);

  const fetchAttendanceCounts = async () => {
    try {
      setLoadingAttendance(true);
      const url = `/mess/attendance/counts?date=${selectedDate}${selectedHostel ? `&hostelId=${selectedHostel}` : ''}`;
      const res = await apiRequest<{ success: boolean; data: any }>(url);
      if (res.success) {
        setAttendanceCounts(res.data);
      }
    } catch (e) {
      console.error('Error fetching attendance counts:', e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const fetchAttendanceRoster = async () => {
    if (isStudent) return;
    try {
      const url = `/mess/attendance/roster?date=${selectedDate}${selectedHostel ? `&hostelId=${selectedHostel}` : ''}${rosterSearch ? `&search=${encodeURIComponent(rosterSearch)}` : ''}`;
      const res = await apiRequest<{ success: boolean; data: any[] }>(url);
      if (res.success) {
        setAttendanceRoster(res.data);
      }
    } catch (e) {
      console.error('Error fetching attendance roster:', e);
    }
  };

  const fetchMyMealAttendance = async () => {
    if (!isStudent) return;
    try {
      const res = await apiRequest<{ success: boolean; data: any }>(`/mess/attendance/my-status?date=${selectedDate}`);
      if (res.success) {
        setStudentMyMeal(res.data);
      }
    } catch (e) {
      console.error('Error fetching student meal status:', e);
    }
  };

  const handleToggleMyMeal = async (mealKey: 'breakfast' | 'lunch' | 'snacks' | 'dinner', currentVal: boolean) => {
    setTogglingMeal(mealKey);
    const nextVal = !currentVal;
    try {
      setStudentMyMeal((prev) => ({ ...prev, [mealKey]: nextVal }));
      const res = await apiRequest<{ success: boolean; message: string }>('/mess/attendance/toggle-my-meal', {
        method: 'POST',
        body: {
          date: selectedDate,
          meal: mealKey,
          attending: nextVal
        }
      });
      if (res.success) {
        await showSuccess(res.message, 'Meal Attendance Updated');
      }
    } catch (err: any) {
      setStudentMyMeal((prev) => ({ ...prev, [mealKey]: currentVal }));
      await showError(err.message || 'Failed to update meal attendance');
    } finally {
      setTogglingMeal(null);
    }
  };

  const handleStaffToggleStudentMeal = async (studentId: string, mealKey: 'breakfast' | 'lunch' | 'snacks' | 'dinner', currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      setAttendanceRoster((prev) =>
        prev.map((r) => (r.studentId === studentId ? { ...r, [mealKey]: nextVal, source: 'WARDEN_OVERRIDE' } : r))
      );
      await apiRequest('/mess/attendance/staff-override', {
        method: 'POST',
        body: {
          studentId,
          date: selectedDate,
          [mealKey]: nextVal
        }
      });
      fetchAttendanceCounts();
    } catch (err: any) {
      await showError('Failed to update student attendance: ' + err.message);
      fetchAttendanceRoster();
    }
  };

  const handleBulkMarkAttendance = async (attending: boolean) => {
    if (!selectedHostel) {
      await showError('Please select a specific hostel first');
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/mess/attendance/staff-bulk', {
        method: 'POST',
        body: {
          hostelId: selectedHostel,
          date: selectedDate,
          meal: 'all',
          attending
        }
      });
      if (res.success) {
        await showSuccess(res.message, 'Bulk Attendance Updated');
        fetchAttendanceCounts();
        fetchAttendanceRoster();
      }
    } catch (err: any) {
      await showError(err.message || 'Bulk mark failed');
    }
  };

  const fetchMenus = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: MessMenu[] }>(
        `/mess/menu?hostelId=${selectedHostel}&dayOfWeek=${selectedDay}`
      );
      if (res.success) {
        setMenus(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (isStudent) return; // Never fetch or expose inventory for students
    try {
      const res = await apiRequest<{ success: boolean; data: InventoryItem[] }>(
        `/mess/inventory?hostelId=${selectedHostel}`
      );
      if (res.success) {
        setInventory(res.data);
        if (res.data.length > 0 && !stockTx.inventoryItemId) {
          setStockTx((prev) => ({ ...prev, inventoryItemId: res.data[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/mess/wastage', {
        method: 'POST',
        body: {
          hostelId: selectedHostel,
          mealSessionId: wastageData.mealSessionId,
          weightKg: wastageData.weightKg,
          reason: wastageData.reason
        }
      });
      if (res.success) {
        await showSuccess(res.message, 'Wastage Logged');
      }
    } catch (err: any) {
      await showError('Error: ' + err.message);
    }
  };

  const handleStockTx = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/mess/inventory/transactions', {
        method: 'POST',
        body: stockTx
      });
      if (res.success) {
        await showSuccess(res.message, 'Inventory Stock Updated');
        setShowStockModal(false);
        fetchInventory();
      }
    } catch (err: any) {
      await showError('Error: ' + err.message);
    }
  };

  const handleOpenAddMenu = (existingMenu?: MessMenu) => {
    if (existingMenu) {
      setMenuForm({
        hostelId: selectedHostel,
        dayOfWeek: selectedDay,
        mealSessionId: existingMenu.meal_session_id,
        menuItems: existingMenu.menu_items || '',
        isSpecial: existingMenu.is_special || false
      });
    } else {
      setMenuForm({
        hostelId: selectedHostel,
        dayOfWeek: selectedDay,
        mealSessionId: mealSessions[0]?.id || 'ms-breakfast',
        menuItems: '',
        isSpecial: false
      });
    }
    setShowMenuModal(true);
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuForm.menuItems.trim()) {
      await showError('Please enter menu items');
      return;
    }
    const targetHostel = menuForm.hostelId || selectedHostel;
    if (!targetHostel) {
      await showError('Please select a hostel');
      return;
    }

    setSavingMenu(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/mess/menu', {
        method: 'POST',
        body: {
          hostelId: targetHostel,
          dayOfWeek: menuForm.dayOfWeek,
          mealSessionId: menuForm.mealSessionId,
          menuItems: menuForm.menuItems.trim(),
          isSpecial: menuForm.isSpecial
        }
      });

      if (res.success) {
        await showSuccess(res.message || 'Menu updated successfully', 'Menu Saved');
        setShowMenuModal(false);
        fetchMenus();
      }
    } catch (err: any) {
      await showError('Failed to save menu: ' + err.message);
    } finally {
      setSavingMenu(false);
    }
  };

  const isMessAdmin = ['super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'].includes(user?.role || '');
  const isMessManager = isMessAdmin;
  const currentHostelObj = hostels.find((h) => h.id === selectedHostel);

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {isStudent ? 'Dining Menus & Mess Schedule' : 'Mess Operations & Dining Menus'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isStudent
              ? `Daily timetable and meal schedule for ${currentHostelObj?.name || (isGirlsStudent ? 'Girls Hostel' : 'International Boys Hostel')}.`
              : 'Weekly menu management, grocery stock replenishment, and daily kitchen food wastage logs.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* For students: REMOVE DROPDOWN. Display allocated hostel badge and resident photo */}
          {isStudent ? (
            <div className="flex items-center space-x-3 bg-[#F7F3ED] border border-[#DED8CF] px-3.5 py-2 rounded-lg">
              {(user?.student?.photo_url || user?.photo_url) ? (
                <img
                  src={user.student?.photo_url || user.photo_url}
                  alt={user.fullName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#92582F] shadow-xs shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#202B3C] text-amber-200 flex items-center justify-center font-bold text-sm shrink-0">
                  {user?.student?.full_name?.charAt(0) || user?.fullName?.charAt(0) || 'S'}
                </div>
              )}
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-[#202B3C]">
                    🏢 {currentHostelObj?.name || (isGirlsStudent ? 'Girls Hostel' : 'International Boys Hostel')}
                  </span>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#E0AD83]/20 text-[#92582F] border border-[#E0AD83]/50">
                    {isGirlsStudent ? 'Girls Dining Wing' : 'Boys Dining Wing'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Resident: <span className="font-bold text-slate-800">{user?.student?.full_name || user?.fullName}</span> ({user?.student?.roll_number || 'Resident'})
                </div>
              </div>
            </div>
          ) : (
            /* For staff / wardens / admins: Hostel Selector Dropdown */
            hostels.length > 0 && (
              <div className="w-56">
                <Select
                  value={selectedHostel}
                  onChange={(e) => setSelectedHostel(e.target.value)}
                  options={hostels.map((h) => ({
                    value: h.id,
                    label: `${h.name} (${h.code})`
                  }))}
                />
              </div>
            )
          )}

          {/* Sub-tab buttons: NEVER shown to students */}
          {!isStudent && (
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-md text-xs font-semibold">
              <Button
                size="sm"
                variant={activeSubTab === 'attendance' ? 'primary' : 'ghost'}
                onClick={() => setActiveSubTab('attendance')}
                leftIcon={<ChefHat className="w-3.5 h-3.5" />}
              >
                Food Headcount & Attendance
              </Button>
              <Button
                size="sm"
                variant={activeSubTab === 'menu' ? 'primary' : 'ghost'}
                onClick={() => setActiveSubTab('menu')}
                leftIcon={<UtensilsCrossed className="w-3.5 h-3.5" />}
              >
                Dining Menus
              </Button>
              <Button
                size="sm"
                variant={activeSubTab === 'inventory' ? 'primary' : 'ghost'}
                onClick={() => setActiveSubTab('inventory')}
                leftIcon={<Package className="w-3.5 h-3.5" />}
              >
                Inventory Stock
              </Button>
              {isMessManager && (
                <Button
                  size="sm"
                  variant={activeSubTab === 'wastage' ? 'primary' : 'ghost'}
                  onClick={() => setActiveSubTab('wastage')}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Food Wastage
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* STUDENT-FACING VIEW: DAILY MEAL ATTENDANCE (OPT-IN / OPT-OUT)         */}
      {/* ==================================================================== */}
      {isStudent && (
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 rounded-xl p-5 border border-amber-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
            <div>
              <div className="flex items-center space-x-2">
                <ChefHat className="w-5 h-5 text-amber-700" />
                <h2 className="text-base font-extrabold text-slate-900">
                  Daily Dining Attendance & Meal Opt-In
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Indicate if you will attend meals today or tomorrow. Your count informs the mess chefs so they cook the exact required portions and prevent food wastage.
              </p>
            </div>

            {/* Date Switcher: Today / Tomorrow */}
            <div className="flex items-center space-x-1.5 bg-white border border-amber-200 p-1 rounded-lg shadow-2xs self-start sm:self-auto">
              <Button
                size="xs"
                variant={selectedDate === todayStr ? 'primary' : 'ghost'}
                onClick={() => setSelectedDate(todayStr)}
              >
                Today ({todayStr})
              </Button>
              <Button
                size="xs"
                variant={
                  selectedDate ===
                  new Date(Date.now() + 86400000).toISOString().split('T')[0]
                    ? 'primary'
                    : 'ghost'
                }
                onClick={() =>
                  setSelectedDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])
                }
              >
                Tomorrow
              </Button>
            </div>
          </div>

          {studentMyMeal.isOnLeave && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                You have an approved leave application for <strong>{selectedDate}</strong> ({studentMyMeal.leaveType?.toUpperCase()}). Meals are paused by default unless you opt in below.
              </span>
            </div>
          )}

          {/* 4 Interactive Meal Cards for Student */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Breakfast */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                studentMyMeal.breakfast
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="font-extrabold text-xs text-slate-800">Morning Breakfast</span>
                </div>
                <Badge variant={studentMyMeal.breakfast ? 'success' : 'neutral'}>
                  {studentMyMeal.breakfast ? '✓ Attending' : '✕ Skipped'}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">07:00 - 10:00</div>
              <p className="text-[11px] text-slate-600 mt-2 min-h-[32px]">
                {studentMyMeal.breakfast
                  ? 'Counted for breakfast preparation.'
                  : 'Opted out. Kitchen will skip this portion.'}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                <Button
                  size="xs"
                  variant={studentMyMeal.breakfast ? 'secondary' : 'primary'}
                  className="w-full text-xs font-bold"
                  isLoading={togglingMeal === 'breakfast'}
                  onClick={() => handleToggleMyMeal('breakfast', studentMyMeal.breakfast)}
                >
                  {studentMyMeal.breakfast ? 'Skip Breakfast' : 'Attend Breakfast'}
                </Button>
              </div>
            </div>

            {/* Lunch */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                studentMyMeal.lunch
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                  <span className="font-extrabold text-xs text-slate-800">Afternoon Lunch</span>
                </div>
                <Badge variant={studentMyMeal.lunch ? 'success' : 'neutral'}>
                  {studentMyMeal.lunch ? '✓ Attending' : '✕ Skipped'}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">12:00 - 15:00</div>
              <p className="text-[11px] text-slate-600 mt-2 min-h-[32px]">
                {studentMyMeal.lunch
                  ? 'Counted for lunch preparation.'
                  : 'Opted out. Kitchen will skip this portion.'}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                <Button
                  size="xs"
                  variant={studentMyMeal.lunch ? 'secondary' : 'primary'}
                  className="w-full text-xs font-bold"
                  isLoading={togglingMeal === 'lunch'}
                  onClick={() => handleToggleMyMeal('lunch', studentMyMeal.lunch)}
                >
                  {studentMyMeal.lunch ? 'Skip Lunch' : 'Attend Lunch'}
                </Button>
              </div>
            </div>

            {/* Snacks */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                studentMyMeal.snacks
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Coffee className="w-4 h-4 text-amber-700" />
                  <span className="font-extrabold text-xs text-slate-800">Evening Snacks</span>
                </div>
                <Badge variant={studentMyMeal.snacks ? 'success' : 'neutral'}>
                  {studentMyMeal.snacks ? '✓ Attending' : '✕ Skipped'}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">16:30 - 18:00</div>
              <p className="text-[11px] text-slate-600 mt-2 min-h-[32px]">
                {studentMyMeal.snacks
                  ? 'Counted for evening snacks.'
                  : 'Opted out. Kitchen will skip this portion.'}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                <Button
                  size="xs"
                  variant={studentMyMeal.snacks ? 'secondary' : 'primary'}
                  className="w-full text-xs font-bold"
                  isLoading={togglingMeal === 'snacks'}
                  onClick={() => handleToggleMyMeal('snacks', studentMyMeal.snacks)}
                >
                  {studentMyMeal.snacks ? 'Skip Snacks' : 'Attend Snacks'}
                </Button>
              </div>
            </div>

            {/* Dinner */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                studentMyMeal.dinner
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                  : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span className="font-extrabold text-xs text-slate-800">Night Dinner</span>
                </div>
                <Badge variant={studentMyMeal.dinner ? 'success' : 'neutral'}>
                  {studentMyMeal.dinner ? '✓ Attending' : '✕ Skipped'}
                </Badge>
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">19:00 - 22:30</div>
              <p className="text-[11px] text-slate-600 mt-2 min-h-[32px]">
                {studentMyMeal.dinner
                  ? 'Counted for dinner preparation.'
                  : 'Opted out. Kitchen will skip this portion.'}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                <Button
                  size="xs"
                  variant={studentMyMeal.dinner ? 'secondary' : 'primary'}
                  className="w-full text-xs font-bold"
                  isLoading={togglingMeal === 'dinner'}
                  onClick={() => handleToggleMyMeal('dinner', studentMyMeal.dinner)}
                >
                  {studentMyMeal.dinner ? 'Skip Dinner' : 'Attend Dinner'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 0: STAFF FOOD PREPARATION HEADCOUNT & DAILY ATTENDANCE           */}
      {/* ==================================================================== */}
      {!isStudent && activeSubTab === 'attendance' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-md text-xs font-bold">
                <Button
                  size="xs"
                  variant={selectedDate === todayStr ? 'primary' : 'ghost'}
                  onClick={() => setSelectedDate(todayStr)}
                >
                  Today
                </Button>
                <Button
                  size="xs"
                  variant={
                    selectedDate ===
                    new Date(Date.now() + 86400000).toISOString().split('T')[0]
                      ? 'primary'
                      : 'ghost'
                  }
                  onClick={() =>
                    setSelectedDate(new Date(Date.now() + 86400000).toISOString().split('T')[0])
                  }
                >
                  Tomorrow
                </Button>
              </div>

              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="w-48 sm:w-64">
                <Input
                  placeholder="Search student or room..."
                  leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => setShowPrintSlip(true)}
              >
                Print Kitchen Slip
              </Button>

              <Button
                size="sm"
                variant="secondary"
                leftIcon={<UserCheck className="w-3.5 h-3.5 text-emerald-600" />}
                onClick={() => handleBulkMarkAttendance(true)}
                title="Mark all residents in selected hostel as Attending"
              >
                Mark All Present
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  fetchAttendanceCounts();
                  fetchAttendanceRoster();
                }}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* 4 BIG KITCHEN FOOD PREPARATION COUNT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Breakfast Count */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 rounded-xl border border-amber-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-xs">
                    <Sun className="w-4 h-4 text-amber-600" />
                    <span>Breakfast Preparation</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">07:00 - 10:00</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-slate-900">
                      {attendanceCounts?.counts?.breakfast?.attending ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-1.5">meals / plates</span>
                  </div>
                  <Badge variant="warning">
                    {attendanceCounts?.counts?.breakfast?.skipped ?? 0} skipped
                  </Badge>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200/60 text-[11px] text-slate-600 flex justify-between font-medium">
                <span>Total Wing Residents:</span>
                <span className="font-bold text-slate-800">{attendanceCounts?.totalResidents ?? 0}</span>
              </div>
            </div>

            {/* Lunch Count */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 rounded-xl border border-emerald-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-900 font-extrabold text-xs">
                    <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
                    <span>Lunch Preparation</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">12:00 - 15:00</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-slate-900">
                      {attendanceCounts?.counts?.lunch?.attending ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-1.5">meals / plates</span>
                  </div>
                  <Badge variant="success">
                    {attendanceCounts?.counts?.lunch?.skipped ?? 0} skipped
                  </Badge>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-200/60 text-[11px] text-slate-600 flex justify-between font-medium">
                <span>Total Wing Residents:</span>
                <span className="font-bold text-slate-800">{attendanceCounts?.totalResidents ?? 0}</span>
              </div>
            </div>

            {/* Snacks Count */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-xl border border-blue-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-blue-900 font-extrabold text-xs">
                    <Coffee className="w-4 h-4 text-blue-600" />
                    <span>Snacks & Tea Count</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">16:30 - 18:00</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-slate-900">
                      {attendanceCounts?.counts?.snacks?.attending ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-1.5">servings</span>
                  </div>
                  <Badge variant="info">
                    {attendanceCounts?.counts?.snacks?.skipped ?? 0} skipped
                  </Badge>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-blue-200/60 text-[11px] text-slate-600 flex justify-between font-medium">
                <span>Total Wing Residents:</span>
                <span className="font-bold text-slate-800">{attendanceCounts?.totalResidents ?? 0}</span>
              </div>
            </div>

            {/* Dinner Count */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50/40 p-4 rounded-xl border border-indigo-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-900 font-extrabold text-xs">
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span>Dinner Preparation</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">19:00 - 22:30</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-slate-900">
                      {attendanceCounts?.counts?.dinner?.attending ?? 0}
                    </span>
                    <span className="text-xs font-bold text-slate-500 ml-1.5">meals / plates</span>
                  </div>
                  <Badge variant="primary">
                    {attendanceCounts?.counts?.dinner?.skipped ?? 0} skipped
                  </Badge>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-indigo-200/60 text-[11px] text-slate-600 flex justify-between font-medium">
                <span>Students on Leave:</span>
                <span className="font-bold text-rose-700">
                  {attendanceCounts?.onLeaveCount ?? 0} on leave
                </span>
              </div>
            </div>
          </div>

          {/* Student Daily Attendance Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-extrabold text-slate-800">
                  Daily Student Meal Attendance Roster ({attendanceRoster.length} residents)
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Date: <strong className="text-slate-800">{selectedDate}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident Student</TableHead>
                    <TableHead>Hostel & Room</TableHead>
                    <TableHead>Leave Status</TableHead>
                    <TableHead align="center">Breakfast (07:00)</TableHead>
                    <TableHead align="center">Lunch (12:00)</TableHead>
                    <TableHead align="center">Snacks (16:30)</TableHead>
                    <TableHead align="center">Dinner (19:00)</TableHead>
                    <TableHead align="right">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRoster.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" className="py-8 text-slate-400 italic text-xs">
                        No students found matching current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceRoster.map((st) => (
                      <TableRow key={st.studentId}>
                        <TableCell>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{st.fullName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{st.rollNumber}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <span className="font-semibold text-xs text-slate-800">Room {st.roomNumber}</span>
                            <div className="text-[10px] text-slate-400">{st.hostelName}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {st.isOnLeave ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              On Leave ({st.leaveType})
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">In Campus</span>
                          )}
                        </TableCell>

                        {/* Breakfast Toggle */}
                        <TableCell align="center">
                          <button
                            type="button"
                            onClick={() => handleStaffToggleStudentMeal(st.studentId, 'breakfast', st.breakfast)}
                            className={`px-2 py-1 rounded text-[11px] font-extrabold cursor-pointer border transition shadow-2xs ${
                              st.breakfast
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle breakfast attendance"
                          >
                            {st.breakfast ? '✓ Yes' : '✕ Skip'}
                          </button>
                        </TableCell>

                        {/* Lunch Toggle */}
                        <TableCell align="center">
                          <button
                            type="button"
                            onClick={() => handleStaffToggleStudentMeal(st.studentId, 'lunch', st.lunch)}
                            className={`px-2 py-1 rounded text-[11px] font-extrabold cursor-pointer border transition shadow-2xs ${
                              st.lunch
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle lunch attendance"
                          >
                            {st.lunch ? '✓ Yes' : '✕ Skip'}
                          </button>
                        </TableCell>

                        {/* Snacks Toggle */}
                        <TableCell align="center">
                          <button
                            type="button"
                            onClick={() => handleStaffToggleStudentMeal(st.studentId, 'snacks', st.snacks)}
                            className={`px-2 py-1 rounded text-[11px] font-extrabold cursor-pointer border transition shadow-2xs ${
                              st.snacks
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle snacks attendance"
                          >
                            {st.snacks ? '✓ Yes' : '✕ Skip'}
                          </button>
                        </TableCell>

                        {/* Dinner Toggle */}
                        <TableCell align="center">
                          <button
                            type="button"
                            onClick={() => handleStaffToggleStudentMeal(st.studentId, 'dinner', st.dinner)}
                            className={`px-2 py-1 rounded text-[11px] font-extrabold cursor-pointer border transition shadow-2xs ${
                              st.dinner
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle dinner attendance"
                          >
                            {st.dinner ? '✓ Yes' : '✕ Skip'}
                          </button>
                        </TableCell>

                        <TableCell align="right">
                          <span
                            className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                              st.source === 'STUDENT_APP'
                                ? 'bg-blue-100 text-blue-800'
                                : st.source === 'WARDEN_OVERRIDE'
                                ? 'bg-purple-100 text-purple-800'
                                : st.source === 'LEAVE_SYNC'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {st.source}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Printable Kitchen Slip Modal */}
      <Modal
        isOpen={showPrintSlip}
        onClose={() => setShowPrintSlip(false)}
        title="Kitchen Daily Food Preparation Slip"
        size="md"
        icon={<Printer className="w-5 h-5 text-amber-600" />}
      >
        <div className="space-y-4 text-slate-800 print:text-black">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <h3 className="font-black text-sm uppercase tracking-wide">
              ADIKAVI NANNAYA UNIVERSITY
            </h3>
            <div className="text-xs font-bold text-slate-700">Hostel Dining Kitchen Preparation Slip</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Date: <strong>{selectedDate}</strong> • Wing: <strong>{currentHostelObj?.name || 'All Hostels'}</strong>
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                <tr>
                  <th className="p-2.5 text-left">Meal Session</th>
                  <th className="p-2.5 text-center">Timings</th>
                  <th className="p-2.5 text-right font-black">Food Preparation Headcount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold">
                <tr>
                  <td className="p-2.5 flex items-center gap-1.5 font-bold">
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Morning Breakfast
                  </td>
                  <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">07:00 - 10:00</td>
                  <td className="p-2.5 text-right font-black text-base text-slate-900">
                    {attendanceCounts?.counts?.breakfast?.attending ?? 0} plates
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 flex items-center gap-1.5 font-bold">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" /> Afternoon Lunch
                  </td>
                  <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">12:00 - 15:00</td>
                  <td className="p-2.5 text-right font-black text-base text-slate-900">
                    {attendanceCounts?.counts?.lunch?.attending ?? 0} plates
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 flex items-center gap-1.5 font-bold">
                    <Coffee className="w-3.5 h-3.5 text-amber-700" /> Evening Snacks & Tea
                  </td>
                  <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">16:30 - 18:00</td>
                  <td className="p-2.5 text-right font-black text-base text-slate-900">
                    {attendanceCounts?.counts?.snacks?.attending ?? 0} servings
                  </td>
                </tr>
                <tr>
                  <td className="p-2.5 flex items-center gap-1.5 font-bold">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" /> Night Dinner
                  </td>
                  <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">19:00 - 22:30</td>
                  <td className="p-2.5 text-right font-black text-base text-slate-900">
                    {attendanceCounts?.counts?.dinner?.attending ?? 0} plates
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-md text-[11px] text-amber-900 flex justify-between font-medium">
            <span>Total Registered Residents: <strong>{attendanceCounts?.totalResidents ?? 0}</strong></span>
            <span>Approved Leaves: <strong>{attendanceCounts?.onLeaveCount ?? 0}</strong></span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setShowPrintSlip(false)}>
              Close
            </Button>
            <Button variant="primary" leftIcon={<Printer className="w-3.5 h-3.5" />} onClick={() => window.print()}>
              Print Slip
            </Button>
          </div>
        </div>
      </Modal>

      {/* TAB 1: DINING MENUS */}
      {activeSubTab === 'menu' && (
        <div className="space-y-3">
          {/* Day Selector & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
              {daysOfWeek.map((day) => (
                <Button
                  key={day}
                  size="sm"
                  variant={selectedDay === day ? 'primary' : 'secondary'}
                  onClick={() => setSelectedDay(day)}
                >
                  {day}
                </Button>
              ))}
            </div>

            {/* Admin / Warden Add Food Menu Button */}
            {!isStudent && isMessAdmin && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => handleOpenAddMenu()}
              >
                Add / Update Food Menu
              </Button>
            )}
          </div>

          {/* Meals Timetable for Selected Day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {menus.map((m) => (
              <div
                key={m.id}
                className={`bg-white rounded-lg p-5 border ${m.is_special ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/10' : 'border-slate-200'} shadow-sm flex flex-col justify-between transition hover:shadow-md`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <span className="font-bold text-sm text-slate-800">{m.session_name}</span>
                      {m.is_special && (
                        <span className="ml-1.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase">
                          Special Feast
                        </span>
                      )}
                    </div>
                    <Badge variant="warning">
                      {m.start_time} - {m.end_time}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-3 rounded-md border border-slate-100 min-h-[90px] whitespace-pre-line">
                      {m.menu_items}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {m.is_special ? '✨ Special Feast' : '🥗 Standard Diet'}
                  </span>

                  {!isStudent && isMessAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleOpenAddMenu(m)}
                      leftIcon={<Pencil className="w-3 h-3 text-blue-600" />}
                      title="Edit this meal's menu items"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit Menu
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY STOCK - NEVER RENDERED FOR STUDENTS */}
      {!isStudent && activeSubTab === 'inventory' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Mess Grocery & Material Stock</h3>
              <p className="text-xs text-slate-500">Live quantity on hand with automatic low-stock alarms</p>
            </div>

            {isMessManager && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowStockModal(true)}
              >
                Record Stock In / Out
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Available Quantity</TableHead>
                  <TableHead>Safety Threshold</TableHead>
                  <TableHead>Stock Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-bold text-slate-800">{item.item_name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-slate-500">{item.category}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {item.quantity} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-slate-500">
                        {item.min_stock_threshold} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.is_low_stock ? (
                        <Badge variant="danger" dot>
                          Low Stock Alert
                        </Badge>
                      ) : (
                        <Badge variant="success" dot>
                          Adequate Stock
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB 3: FOOD WASTAGE LOG - NEVER RENDERED FOR STUDENTS */}
      {!isStudent && activeSubTab === 'wastage' && (
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm max-w-xl space-y-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Daily Kitchen Food Wastage Register</h3>
            <p className="text-xs text-slate-500 mt-1">
              Log daily weighed food wastage to track kitchen production efficiency and minimize food loss.
            </p>
          </div>

          <form onSubmit={handleRecordWastage} className="space-y-3.5">
            <Select
              label="Meal Session"
              value={wastageData.mealSessionId}
              onChange={(e) => setWastageData({ ...wastageData, mealSessionId: e.target.value })}
              options={[
                { value: 'ms-breakfast', label: 'Morning Breakfast' },
                { value: 'ms-lunch', label: 'Afternoon Lunch' },
                { value: 'ms-snacks', label: 'Evening Snacks' },
                { value: 'ms-dinner', label: 'Night Dinner' }
              ]}
            />

            <Input
              required
              label="Measured Wastage Weight (in Kilograms) *"
              type="number"
              step="0.1"
              value={wastageData.weightKg}
              onChange={(e) => setWastageData({ ...wastageData, weightKg: parseFloat(e.target.value) || 0 })}
            />

            <Input
              label="Reason / Notes"
              type="text"
              value={wastageData.reason}
              onChange={(e) => setWastageData({ ...wastageData, reason: e.target.value })}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
            >
              Submit Wastage Log
            </Button>
          </form>
        </div>
      )}

      {/* MODAL: ADD / UPDATE FOOD MENU */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title="Add / Update Food Menu"
        size="md"
        icon={<UtensilsCrossed className="w-5 h-5 text-amber-600" />}
      >
        <form onSubmit={handleSaveMenu} className="space-y-3.5">
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-md text-xs text-amber-900 leading-relaxed">
            Update dining food menus dynamically. Changes appear immediately on student portals and mess counter attendance displays.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hostel</label>
              <Select
                value={menuForm.hostelId || selectedHostel}
                onChange={(e) => setMenuForm({ ...menuForm, hostelId: e.target.value })}
                options={hostels.map((h) => ({
                  value: h.id,
                  label: `${h.name} (${h.code})`
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Day of the Week</label>
              <Select
                value={menuForm.dayOfWeek}
                onChange={(e) => setMenuForm({ ...menuForm, dayOfWeek: e.target.value })}
                options={daysOfWeek.map((d) => ({ value: d, label: d }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Meal Session</label>
            <Select
              value={menuForm.mealSessionId}
              onChange={(e) => setMenuForm({ ...menuForm, mealSessionId: e.target.value })}
              options={mealSessions.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.start_time} - ${s.end_time})`
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Food Menu Items <span className="text-rose-500">*</span>
            </label>
            <Textarea
              rows={4}
              value={menuForm.menuItems}
              onChange={(e) => setMenuForm({ ...menuForm, menuItems: e.target.value })}
              placeholder="e.g. Masala Dosa, Upma, Coconut Chutney, Sambar, Tea / Coffee"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">Separate dishes with commas. You can also specify special beverages or side dishes.</p>
          </div>

          <div className="pt-1">
            <Checkbox
              label="Mark as Special Feast / Festival Diet (Highlights the card badge)"
              checked={menuForm.isSpecial}
              onChange={(checked) => setMenuForm({ ...menuForm, isSpecial: checked })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowMenuModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={savingMenu}
            >
              {savingMenu ? 'Saving...' : 'Save & Publish Menu'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: STOCK TX */}
      <Modal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        title="Record Stock Transaction"
        size="md"
        icon={<Package className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleStockTx} className="space-y-3.5">
          <Select
            label="Inventory Item"
            value={stockTx.inventoryItemId}
            onChange={(e) => setStockTx({ ...stockTx, inventoryItemId: e.target.value })}
            options={inventory.map((i) => ({
              value: i.id,
              label: `${i.item_name} (${i.unit})`
            }))}
          />

          <Select
            label="Transaction Movement"
            value={stockTx.transactionType}
            onChange={(e) => setStockTx({ ...stockTx, transactionType: e.target.value })}
            options={[
              { value: 'IN', label: 'IN (Purchase / Inward Restock)' },
              { value: 'OUT', label: 'OUT (Kitchen Consumption Issue)' },
              { value: 'WASTAGE', label: 'WASTAGE (Damaged / Expired)' }
            ]}
          />

          <Input
            required
            label="Quantity"
            type="number"
            step="0.5"
            value={stockTx.quantity}
            onChange={(e) => setStockTx({ ...stockTx, quantity: parseFloat(e.target.value) || 0 })}
          />

          <Input
            label="Vendor / Purpose Notes"
            type="text"
            value={stockTx.notes}
            onChange={(e) => setStockTx({ ...stockTx, notes: e.target.value })}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowStockModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Update Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
