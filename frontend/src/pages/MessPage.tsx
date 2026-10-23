import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { apiRequest } from '../services/api.js';
import { MessMenu, InventoryItem } from '../types.js';
import { UtensilsCrossed, Package, Trash2, Plus, AlertTriangle, CheckCircle, Clock, Pencil, Sparkles } from 'lucide-react';
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
  TableCell
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

  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'inventory' | 'wastage'>('menu');
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [menus, setMenus] = useState<MessMenu[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
          {/* For students: REMOVE DROPDOWN. Display allocated hostel badge instead */}
          {isStudent ? (
            <div className="flex items-center space-x-2 bg-[#F7F3ED] border border-[#DED8CF] px-3.5 py-2 rounded-lg">
              <span className="text-xs font-black text-[#202B3C]">
                🏢 {currentHostelObj?.name || (isGirlsStudent ? 'Girls Hostel' : 'International Boys Hostel')}
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#E0AD83]/20 text-[#92582F] border border-[#E0AD83]/50">
                {isGirlsStudent ? 'Girls Dining Counter' : 'Boys Dining Counter'}
              </span>
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
                variant={activeSubTab === 'menu' ? 'primary' : 'ghost'}
                onClick={() => setActiveSubTab('menu')}
              >
                Dining Menus
              </Button>
              <Button
                size="sm"
                variant={activeSubTab === 'inventory' ? 'primary' : 'ghost'}
                onClick={() => setActiveSubTab('inventory')}
              >
                Inventory Stock
              </Button>
              {isMessManager && (
                <Button
                  size="sm"
                  variant={activeSubTab === 'wastage' ? 'primary' : 'ghost'}
                  onClick={() => setActiveSubTab('wastage')}
                >
                  Food Wastage
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

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
                    <button
                      type="button"
                      onClick={() => handleOpenAddMenu(m)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition"
                      title="Edit this meal's menu items"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Menu</span>
                    </button>
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

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_special_feast"
              checked={menuForm.isSpecial}
              onChange={(e) => setMenuForm({ ...menuForm, isSpecial: e.target.checked })}
              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="is_special_feast" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
              Mark as Special Feast / Festival Diet (Highlights the card badge)
            </label>
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
