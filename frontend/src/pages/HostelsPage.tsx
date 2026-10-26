import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../services/api.js';
import { Hostel } from '../types.js';
import {
  Building2,
  ArrowRightLeft,
  Plus,
  Trash2,
  DoorClosed,
  Sparkles,
  UserMinus,
  Pencil,
  RefreshCw
} from 'lucide-react';
import {
  Button,
  Badge,
  IconButton
} from '../components/ui/index.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { useAuth } from '../context/AuthContext.js';
import {
  SmartAllocationModal,
  CreateHostelModal,
  EditHostelModal,
  AddRoomModal,
  AddBedModal,
  TransferModal,
  AllocateBedModal
} from '../components/hostels/index.js';

export const HostelsPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const userWing = (!isSuperAdmin && user?.assignedCategory && user.assignedCategory !== 'all') ? user.assignedCategory : null;

  const { confirm, showSuccess, showError, showWarning } = useConfirm();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  
  // Cache rooms per hostel to provide instant, seamless switching with 0 page re-renders
  const [roomsCache, setRoomsCache] = useState<Record<string, any[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState(false);

  // Modal visibility & targets
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showCreateHostelModal, setShowCreateHostelModal] = useState(false);
  const [showEditHostelModal, setShowEditHostelModal] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [targetBedToAllocate, setTargetBedToAllocate] = useState<any | null>(null);
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [addBedDefaultRoomId, setAddBedDefaultRoomId] = useState<string>('');

  // Derived rooms with beds for currently selected hostel
  const roomsWithBeds = useMemo(() => {
    return roomsCache[selectedHostel] || [];
  }, [roomsCache, selectedHostel]);

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    if (selectedHostel) {
      const hasCache = !!roomsCache[selectedHostel];
      fetchRooms(selectedHostel, hasCache);
    }
  }, [selectedHostel]);

  const fetchHostels = async (isSilent = false) => {
    try {
      if (!isSilent) setInitialLoading(true);
      const res = await apiRequest<{ success: boolean; data: Hostel[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          setSelectedHostel((prev) => (prev && res.data.some((h) => h.id === prev) ? prev : res.data[0].id));
        } else {
          setSelectedHostel('');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isSilent) setInitialLoading(false);
    }
  };

  const fetchRooms = async (hostelId = selectedHostel, isSilent = false) => {
    if (!hostelId) return;
    const hasCache = !!roomsCache[hostelId];
    if (!isSilent && !hasCache) {
      setRoomsLoading(true);
    } else {
      setIsRefreshingRooms(true);
    }

    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/hostels/rooms/beds?hostelId=' + hostelId);
      if (res.success) {
        setRoomsCache((prev) => ({ ...prev, [hostelId]: res.data }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRoomsLoading(false);
      setIsRefreshingRooms(false);
    }
  };

  const handleSelectHostel = (id: string) => {
    if (selectedHostel === id) return;
    setSelectedHostel(id);
  };

  const handleOpenEditHostel = (h: Hostel) => {
    setEditingHostel(h);
    setShowEditHostelModal(true);
  };

  const handleDeleteHostel = async () => {
    if (!selectedHostel) return;
    const currentH = hostels.find((h) => h.id === selectedHostel);
    const confirmed = await confirm({
      title: 'Delete Hostel',
      message: 'Are you sure you want to delete "' + (currentH?.name || selectedHostel) + '" and all its associated rooms and beds? This action cannot be undone.',
      confirmText: 'Delete Hostel',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/' + selectedHostel, {
        method: 'DELETE'
      });
      if (res.success) {
        await showSuccess(res.message);
        await fetchHostels();
      }
    } catch (err: any) {
      await showError('Delete failed: ' + err.message);
    }
  };

  const handleVacateBed = async (studentId: string, studentName: string) => {
    const confirmed = await confirm({
      title: 'Vacate Bed Allocation',
      message: 'Are you sure you want to vacate ' + (studentName || 'this student') + '\'s bed allocation? The bed will immediately return to vacant status.',
      confirmText: 'Vacate Bed',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/batch/vacate', {
        method: 'POST',
        body: {
          studentIds: [studentId],
          reason: 'Manual bed checkout from grid'
        }
      });
      if (res.success) {
        await showSuccess(res.message);
        fetchRooms(selectedHostel, true);
        fetchHostels(true);
      }
    } catch (err: any) {
      await showError('Vacate failed: ' + err.message);
    }
  };

  const handleDeleteBed = async (bedObj: any) => {
    if (bedObj.bed_status === 'occupied') {
      await showWarning(
        'Cannot delete ' + bedObj.bed_number + ' because it is currently occupied by ' + (bedObj.student_name || 'a student') + '. Please vacate the resident before deleting the bed.',
        'Bed Occupied'
      );
      return;
    }

    const confirmed = await confirm({
      title: 'Delete ' + bedObj.bed_number,
      message: 'Are you sure you want to delete ' + bedObj.bed_number + ' from Room ' + bedObj.room_number + '? This will permanently remove this bed from the room and reduce room capacity.',
      confirmText: 'Delete Bed',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/beds/' + bedObj.bed_id, {
        method: 'DELETE'
      });
      if (res.success) {
        await showSuccess(res.message || 'Bed deleted successfully.');
        fetchRooms(selectedHostel, true);
        fetchHostels(true);
      }
    } catch (err: any) {
      await showError('Delete bed failed: ' + (err.message || 'An error occurred'));
    }
  };

  const uniqueRoomsInHostel = React.useMemo(() => {
    const map = new Map<string, { room_id: string; room_number: string; count: number }>();
    roomsWithBeds.forEach((rb) => {
      if (rb.room_id && !map.has(rb.room_id)) {
        map.set(rb.room_id, {
          room_id: rb.room_id,
          room_number: rb.room_number,
          count: roomsWithBeds.filter((r) => r.room_id === rb.room_id).length
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  }, [roomsWithBeds]);

  const handleOpenAddBedModal = (defaultRoomId?: string) => {
    setAddBedDefaultRoomId(defaultRoomId || (roomsWithBeds[0]?.room_id || ''));
    setShowAddBedModal(true);
  };

  const handleOpenAllocateModal = (bedObj: any) => {
    setTargetBedToAllocate(bedObj);
    setShowAllocateModal(true);
  };

  const selectedHostelObj = hostels.find((h) => h.id === selectedHostel);

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#23395D]/10 flex items-center justify-center text-[#23395D] flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Hostels & Room Allocation Matrix</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Hierarchy: University → Hostel Category → Building → Block → Floor → Room → Bed Inventory
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
          {/* Allocation Actions Segment */}
          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-lg border border-slate-200">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowBatchModal(true);
              }}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
              className="text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-white hover:shadow-2xs whitespace-nowrap transition rounded-md"
            >
              Smart Allocation
            </Button>

            {hostels.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTransferModal(true)}
                leftIcon={<ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-2xs whitespace-nowrap transition rounded-md"
              >
                Room Transfer
              </Button>
            )}
          </div>

          {/* Infrastructure Setup Actions */}
          <div className="inline-flex items-center gap-2">
            {hostels.length > 0 && (
              <Button
                size="sm"
                onClick={() => setShowAddRoomModal(true)}
                leftIcon={<DoorClosed className="w-3.5 h-3.5" />}
                variant="outline"
                className="text-xs font-semibold whitespace-nowrap border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 shadow-2xs"
              >
                Add Room
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setShowCreateHostelModal(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              variant="primary"
              className="text-xs font-bold whitespace-nowrap bg-[#23395D] hover:bg-[#192B47] text-white shadow-sm"
            >
              Add New Hostel
            </Button>
          </div>
        </div>
      </div>

      {/* Hostels Cards Grid */}
      {initialLoading && hostels.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-5 rounded-lg border border-slate-200 bg-white animate-pulse">
              <div className="flex justify-between">
                <div className="h-5 bg-slate-200 rounded w-16" />
                <div className="h-4 bg-slate-200 rounded w-20" />
              </div>
              <div className="h-5 bg-slate-200 rounded w-3/4 mt-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mt-1.5" />
              <div className="mt-4 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-2 bg-slate-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : hostels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {hostels.map((h) => {
            const isSelected = selectedHostel === h.id;
            const occRate = h.total_beds && h.total_beds > 0 ? Math.round(((h.occupied_beds || 0) / h.total_beds) * 100) : 0;

            return (
              <div
                key={h.id}
                onClick={() => handleSelectHostel(h.id)}
                className={`p-5 rounded-lg border transition cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-br from-white to-blue-50/50 border-aknu-blue ring-2 ring-blue-500/20 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant={h.category === 'boys' ? 'primary' : 'neutral'}>
                    {h.code}
                  </Badge>
                  <span className={`text-[10px] capitalize font-bold px-2 py-0.5 rounded ${
                    h.category === 'girls'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {h.category === 'girls' ? 'Girls Wing' : 'Boys Wing'}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-slate-800 mt-2">{h.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Capacity: {h.total_capacity} beds</p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                    <span>Occupancy</span>
                    <span>{h.occupied_beds || 0} / {h.total_beds || 0}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-aknu-blue h-full rounded-full transition-all" style={{ width: `${occRate}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg p-10 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Hostels Configured Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The university currently has no registered hostels. Add your first boys or girls hostel to dynamically generate blocks, rooms, and bed inventory.
          </p>
          <Button
            onClick={() => setShowCreateHostelModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            variant="accent"
          >
            Add First Hostel
          </Button>
        </div>
      )}

      {/* Room and Bed Matrix */}
      {selectedHostelObj && (
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Bed Allocation Grid</h3>
                <Badge variant={selectedHostelObj.category === 'boys' ? 'primary' : 'neutral'}>
                  {selectedHostelObj.code}
                </Badge>
                {isRefreshingRooms && (
                  <span title="Updating live beds...">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Live bed inventory for {selectedHostelObj.name} ({selectedHostelObj.total_capacity} total beds)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-3 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vacant
                </span>
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Occupied
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenAddBedModal()}
                  title="Add a bed to a room in this hostel"
                >
                  Add Bed
                </Button>

                <Button
                  size="xs"
                  variant="outline"
                  leftIcon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => handleOpenEditHostel(selectedHostelObj)}
                  title="Edit Hostel Details & Wing"
                >
                  Edit Hostel
                </Button>

                {(selectedHostelObj.occupied_beds || 0) === 0 && (
                  <Button
                    variant="danger"
                    size="xs"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={handleDeleteHostel}
                    title="Delete this empty hostel"
                  >
                    Delete Hostel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {roomsLoading && roomsWithBeds.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="p-4 rounded-md border border-slate-200 bg-white shadow-2xs animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-200 rounded w-24" />
                    <div className="h-4 bg-slate-200 rounded w-16" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : roomsWithBeds.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {roomsWithBeds.map((rb, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-md border transition ${
                    rb.bed_status === 'occupied'
                      ? 'bg-blue-50/50 border-blue-200'
                      : 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">
                      Room {rb.room_number} • {rb.bed_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={rb.bed_status === 'occupied' ? 'primary' : 'success'}
                        dot
                      >
                        {rb.bed_status}
                      </Badge>
                       </div>
                  </div>

                  <div className="mt-2.5">
                    {rb.student_name ? (
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-900 block truncate">{rb.student_name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{rb.roll_number}</span>
                        </div>
                        {rb.student_id && (
                          <IconButton
                            icon={<UserMinus className="w-3.5 h-3.5" />}
                            size="xs"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVacateBed(rb.student_id, rb.student_name);
                            }}
                            title="Vacate Bed (Release back to pool)"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-medium">Available</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                            leftIcon={<Trash2 className="w-3 h-3 text-rose-500" />}
                            onClick={() => handleDeleteBed(rb)}
                            title={`Delete ${rb.bed_number} from Room ${rb.room_number}`}
                          >
                            Delete
                          </Button>
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => handleOpenAllocateModal(rb)}
                            className="h-6 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-none"
                          >
                            + Allocate
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <p>No rooms configured for this hostel yet.</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddRoomModal(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add First Room
              </Button>
            </div>
          )}
        </div>
      )}

      {/* REUSABLE HOSTEL MODALS */}
      <CreateHostelModal
        isOpen={showCreateHostelModal}
        onClose={() => setShowCreateHostelModal(false)}
        userWing={userWing as 'boys' | 'girls' | null}
        onSuccess={fetchHostels}
      />

      <EditHostelModal
        isOpen={showEditHostelModal}
        onClose={() => {
          setShowEditHostelModal(false);
          setEditingHostel(null);
        }}
        hostel={editingHostel}
        userWing={userWing as 'boys' | 'girls' | null}
        onSuccess={fetchHostels}
      />

      <AddRoomModal
        isOpen={showAddRoomModal}
        onClose={() => setShowAddRoomModal(false)}
        hostelId={selectedHostel}
        hostelName={selectedHostelObj?.name}
        onSuccess={() => {
          fetchRooms(selectedHostel, true);
          fetchHostels(true);
        }}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        hostels={hostels}
        initialHostelId={selectedHostel}
        onSuccess={() => {
          fetchRooms(selectedHostel, true);
          fetchHostels(true);
        }}
      />

      <SmartAllocationModal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        userWing={userWing as 'boys' | 'girls' | null}
        hostels={hostels}
        onSuccess={() => {
          fetchRooms(selectedHostel, true);
          fetchHostels(true);
        }}
      />

      <AllocateBedModal
        isOpen={showAllocateModal}
        onClose={() => setShowAllocateModal(false)}
        bed={targetBedToAllocate}
        hostel={selectedHostelObj || null}
        onSuccess={() => {
          fetchRooms(selectedHostel, true);
          fetchHostels(true);
        }}
      />

      <AddBedModal
        isOpen={showAddBedModal}
        onClose={() => setShowAddBedModal(false)}
        hostelName={selectedHostelObj?.name}
        rooms={uniqueRoomsInHostel}
        defaultRoomId={addBedDefaultRoomId}
        onSuccess={() => {
          fetchRooms(selectedHostel, true);
          fetchHostels(true);
        }}
      />
    </div>
  );
};
