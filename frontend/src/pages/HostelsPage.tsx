import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../services/api.js';
import { Hostel } from '../types.js';
import {
  Building2,
  Bed,
  ArrowRightLeft,
  Plus,
  Trash2,
  DoorClosed,
  Sparkles,
  Users,
  Search,
  UserMinus,
  Filter,
  CheckCircle2,
  Layers,
  Pencil
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge
} from '../components/ui/index.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { useAuth } from '../context/AuthContext.js';

export const HostelsPage: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const userWing = (!isSuperAdmin && user?.assignedCategory && user.assignedCategory !== 'all') ? user.assignedCategory : null;
  const initialBatchGender = userWing === 'girls' ? 'female' : 'male';
  const initialCategory: 'boys' | 'girls' = (userWing as 'boys' | 'girls') || 'boys';

  const { confirm, showSuccess, showError, showWarning } = useConfirm();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [roomsWithBeds, setRoomsWithBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Batch Allocation modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchGender, setBatchGender] = useState<'male' | 'female'>(initialBatchGender);
  const [batchCourse, setBatchCourse] = useState<string>('all');
  const [batchDepartment, setBatchDepartment] = useState<string>('all');
  const [batchYear, setBatchYear] = useState<string>('all');
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [batchTargetHostel, setBatchTargetHostel] = useState<string>('');
  const [batchTargetFloor, setBatchTargetFloor] = useState<string>('all');
  const [batchTargetRoom, setBatchTargetRoom] = useState<string>('all');
  const [targetHostelRooms, setTargetHostelRooms] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [allocatingBatch, setAllocatingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [availableFilters, setAvailableFilters] = useState<{
    totalUnallocated: number;
    departments: { id: string; name: string; code: string; count: number }[];
    courses: { id: string; name: string; code: string; count: number }[];
    years: { year: number; label: string; count: number }[];
  }>({
    totalUnallocated: 0,
    departments: [],
    courses: [],
    years: []
  });

  // Create Hostel modal
  const [showCreateHostelModal, setShowCreateHostelModal] = useState(false);
  const [newHostel, setNewHostel] = useState<{
    name: string;
    code: string;
    category: 'boys' | 'girls';
    campus: string;
    autoGenRooms: boolean;
    numFloors: number | string;
    roomsPerFloor: number | string;
    bedsPerRoom: number | string;
  }>({
    name: '',
    code: '',
    category: initialCategory,
    campus: 'Main Campus, Rajahmundry',
    autoGenRooms: true,
    numFloors: 2,
    roomsPerFloor: 5,
    bedsPerRoom: 2
  });

  // Edit Hostel modal state
  const [showEditHostelModal, setShowEditHostelModal] = useState(false);
  const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
  const [editHostelForm, setEditHostelForm] = useState({
    name: '',
    code: '',
    category: initialCategory,
    campus: 'Main Campus, Rajahmundry'
  });

  // Add Room modal
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoom, setNewRoom] = useState<{
    roomNumber: string;
    floorNumber: number | string;
    capacity: number | string;
    roomType: string;
  }>({
    roomNumber: '',
    floorNumber: 1,
    capacity: 2,
    roomType: 'double'
  });

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    studentId: '',
    toHostelId: '',
    toRoomId: '',
    toBedId: '',
    reason: ''
  });

  // Single Bed Allocation Modal state
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [targetBedToAllocate, setTargetBedToAllocate] = useState<any | null>(null);
  const [availableCandidatesForBed, setAvailableCandidatesForBed] = useState<any[]>([]);
  const [selectedStudentForBed, setSelectedStudentForBed] = useState<string>('');
  const [allocationNotes, setAllocationNotes] = useState<string>('');
  const [allocatingBed, setAllocatingBed] = useState(false);

  // Add Bed to Room Modal state
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [addBedForm, setAddBedForm] = useState({
    roomId: '',
    bedNumber: ''
  });
  const [addingBed, setAddingBed] = useState(false);

  useEffect(() => {
    fetchHostels();
  }, []);

  useEffect(() => {
    if (showBatchModal) {
      fetchCandidates();
    }
  }, [showBatchModal, batchGender, batchCourse, batchDepartment, batchYear, batchSearch]);

  useEffect(() => {
    const matchingHostels = hostels.filter((h) => (batchGender === 'male' ? h.category === 'boys' : h.category === 'girls'));
    if (matchingHostels.length > 0) {
      setBatchTargetHostel((prev) => (matchingHostels.some((h) => h.id === prev) ? prev : matchingHostels[0].id));
    } else {
      setBatchTargetHostel('');
    }
  }, [batchGender, hostels]);

  useEffect(() => {
    if (batchTargetHostel) {
      fetchTargetHostelRooms(batchTargetHostel);
      setBatchTargetFloor('all');
      setBatchTargetRoom('all');
    } else {
      setTargetHostelRooms([]);
    }
  }, [batchTargetHostel]);

  const fetchTargetHostelRooms = async (hostelId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>(`/hostels/rooms?hostelId=${hostelId}`);
      if (res.success && res.data) {
        setTargetHostelRooms(res.data);
      }
    } catch (e) {
      console.warn('Target hostel rooms fetch warning:', e);
    }
  };

  const targetFloors = useMemo(() => {
    const map = new Map<string, { id: string; floorNumber: number | string; name: string; vacantBeds: number }>();
    targetHostelRooms.forEach((r) => {
      const flKey = String(r.floor_number ?? '1');
      const isVacant = r.bed_status === 'vacant';
      const existing = map.get(flKey);
      if (existing) {
        if (isVacant) existing.vacantBeds++;
      } else {
        map.set(flKey, {
          id: r.floor_id || r.floor_table_id || flKey,
          floorNumber: r.floor_number ?? 1,
          name: r.floor_name || `Floor ${r.floor_number ?? 1}`,
          vacantBeds: isVacant ? 1 : 0
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(a.floorNumber) - Number(b.floorNumber));
  }, [targetHostelRooms]);

  const targetRooms = useMemo(() => {
    const map = new Map<string, { id: string; roomNumber: string; floorNumber: number | string; vacantBeds: number; capacity: number }>();
    targetHostelRooms.forEach((r) => {
      if (batchTargetFloor !== 'all' && String(r.floor_number) !== String(batchTargetFloor) && r.floor_id !== batchTargetFloor) {
        return;
      }
      const isVacant = r.bed_status === 'vacant';
      const existing = map.get(r.room_id);
      if (existing) {
        if (isVacant) existing.vacantBeds++;
      } else {
        map.set(r.room_id, {
          id: r.room_id,
          roomNumber: r.room_number,
          floorNumber: r.floor_number ?? 1,
          vacantBeds: isVacant ? 1 : 0,
          capacity: r.capacity || 2
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  }, [targetHostelRooms, batchTargetFloor]);

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const params = new URLSearchParams();
      params.append('gender', batchGender);
      if (batchDepartment !== 'all') params.append('departmentId', batchDepartment);
      if (batchCourse !== 'all') params.append('courseId', batchCourse);
      if (batchYear !== 'all') params.append('yearOfStudy', batchYear);
      if (batchSearch) params.append('search', batchSearch);

      const res = await apiRequest<{
        success: boolean;
        data: any[];
        availableFilters?: {
          totalUnallocated: number;
          departments: any[];
          courses: any[];
          years: any[];
        };
      }>(`/hostels/batch/unallocated-candidates?${params.toString()}`);

      if (res.success) {
        setCandidates(res.data);
        setSelectedStudentIds(res.data.map((s) => s.id));
        if (res.availableFilters) {
          setAvailableFilters(res.availableFilters);

          // Auto-reset selected filter if it no longer exists among unallocated candidates
          if (batchDepartment !== 'all' && !res.availableFilters.departments.some((d) => d.id === batchDepartment)) {
            setBatchDepartment('all');
          }
          if (batchCourse !== 'all' && !res.availableFilters.courses.some((c) => c.id === batchCourse)) {
            setBatchCourse('all');
          }
          if (batchYear !== 'all' && !res.availableFilters.years.some((y) => String(y.year) === String(batchYear))) {
            setBatchYear('all');
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (selectedHostel) {
      fetchRooms();
    } else {
      setRoomsWithBeds([]);
    }
  }, [selectedHostel]);

  const fetchHostels = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: Hostel[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          setSelectedHostel((prev) => (res.data.some((h) => h.id === prev) ? prev : res.data[0].id));
          setTransferData((prev) => ({
            ...prev,
            toHostelId: res.data.some((h) => h.id === prev.toHostelId) ? prev.toHostelId : res.data[0].id
          }));
        } else {
          setSelectedHostel('');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    if (!selectedHostel) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: any[] }>(`/hostels/rooms/beds?hostelId=${selectedHostel}`);
      if (res.success) {
        setRoomsWithBeds(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: newHostel.name.trim(),
        code: newHostel.code.trim().toUpperCase(),
        category: newHostel.category,
        campus: newHostel.campus.trim()
      };

      if (newHostel.autoGenRooms) {
        payload.initRooms = {
          numFloors: Math.max(1, parseInt(String(newHostel.numFloors), 10) || 1),
          roomsPerFloor: Math.max(1, parseInt(String(newHostel.roomsPerFloor), 10) || 1),
          bedsPerRoom: Math.max(1, parseInt(String(newHostel.bedsPerRoom), 10) || 2),
          blockName: 'Main Wing'
        };
      }

      const res = await apiRequest<{ success: boolean; message: string; data: any }>('/hostels', {
        method: 'POST',
        body: payload
      });

      if (res.success) {
        await showSuccess(res.message);
        setShowCreateHostelModal(false);
        setNewHostel({
          name: '',
          code: '',
          category: initialCategory,
          campus: 'Main Campus, Rajahmundry',
          autoGenRooms: true,
          numFloors: 2,
          roomsPerFloor: 5,
          bedsPerRoom: 2
        });
        await fetchHostels();
        if (res.data?.id) {
          setSelectedHostel(res.data.id);
        }
      }
    } catch (err: any) {
      await showError('Failed to create hostel: ' + err.message);
    }
  };

  const handleOpenEditHostel = (h: Hostel) => {
    setEditingHostel(h);
    setEditHostelForm({
      name: h.name,
      code: h.code,
      category: (h.category as 'boys' | 'girls') || 'boys',
      campus: h.campus || 'Main Campus, Rajahmundry'
    });
    setShowEditHostelModal(true);
  };

  const handleUpdateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHostel) return;
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/${editingHostel.id}`, {
        method: 'PUT',
        body: editHostelForm
      });
      if (res.success) {
        setShowEditHostelModal(false);
        setEditingHostel(null);
        await showSuccess(res.message || 'Hostel details updated.');
        await fetchHostels();
      }
    } catch (err: any) {
      await showError('Failed to update hostel: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHostel = async () => {
    if (!selectedHostel) return;
    const currentH = hostels.find((h) => h.id === selectedHostel);
    const confirmed = await confirm({
      title: 'Delete Hostel',
      message: `Are you sure you want to delete "${currentH?.name || selectedHostel}" and all its associated rooms and beds? This action cannot be undone.`,
      confirmText: 'Delete Hostel',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/${selectedHostel}`, {
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

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHostel) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/${selectedHostel}/rooms`, {
        method: 'POST',
        body: {
          ...newRoom,
          floorNumber: Math.max(1, parseInt(String(newRoom.floorNumber), 10) || 1),
          capacity: Math.max(1, parseInt(String(newRoom.capacity), 10) || 2)
        }
      });
      if (res.success) {
        await showSuccess(res.message);
        setShowAddRoomModal(false);
        setNewRoom({ roomNumber: '', floorNumber: 1, capacity: 2, roomType: 'double' });
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      await showError('Failed to add room: ' + err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/transfers', {
        method: 'POST',
        body: transferData
      });
      if (res.success) {
        await showSuccess(res.message);
        setShowTransferModal(false);
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      await showError('Transfer failed: ' + err.message);
    }
  };

  const handleExecuteBatchAllocate = async () => {
    if (!batchTargetHostel) {
      await showWarning('Please select a target destination hostel.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      await showWarning('Please select at least one student from the cohort to allocate.');
      return;
    }

    try {
      setAllocatingBatch(true);
      const res = await apiRequest<{
        success: boolean;
        message: string;
        summary: {
          allocatedCount: number;
          remainingUnallocated: number;
          allocatedPairs: any[];
        };
      }>('/hostels/batch/allocate', {
        method: 'POST',
        body: {
          targetHostelId: batchTargetHostel,
          targetFloorId: batchTargetFloor === 'all' ? null : batchTargetFloor,
          targetRoomId: batchTargetRoom === 'all' ? null : batchTargetRoom,
          studentIds: selectedStudentIds
        }
      });

      if (res.success) {
        setBatchResult(res.summary);
        await fetchHostels();
        if (selectedHostel === batchTargetHostel) {
          await fetchRooms();
        } else {
          setSelectedHostel(batchTargetHostel);
        }
      }
    } catch (err: any) {
      await showError('Batch allocation error: ' + err.message);
    } finally {
      setAllocatingBatch(false);
    }
  };

  const handleVacateBed = async (studentId: string, studentName: string) => {
    const confirmed = await confirm({
      title: 'Vacate Bed Allocation',
      message: `Are you sure you want to vacate ${studentName || 'this student'}'s bed allocation? The bed will immediately return to vacant status.`,
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
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      await showError('Vacate failed: ' + err.message);
    }
  };

  const handleDeleteBed = async (bedObj: any) => {
    if (bedObj.bed_status === 'occupied') {
      await showWarning(
        `Cannot delete ${bedObj.bed_number} because it is currently occupied by ${bedObj.student_name || 'a student'}. Please vacate the resident before deleting the bed.`,
        'Bed Occupied'
      );
      return;
    }

    const confirmed = await confirm({
      title: `Delete ${bedObj.bed_number}`,
      message: `Are you sure you want to delete ${bedObj.bed_number} from Room ${bedObj.room_number}? This will permanently remove this bed from the room and reduce room capacity.`,
      confirmText: 'Delete Bed',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/beds/${bedObj.bed_id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        await showSuccess(res.message || 'Bed deleted successfully.');
        fetchRooms();
        fetchHostels();
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
    setAddBedForm({
      roomId: defaultRoomId || (roomsWithBeds[0]?.room_id || ''),
      bedNumber: ''
    });
    setShowAddBedModal(true);
  };

  const handleConfirmAddBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBedForm.roomId) {
      await showWarning('Please select a room to add a bed.');
      return;
    }

    try {
      setAddingBed(true);
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/rooms/${addBedForm.roomId}/beds`, {
        method: 'POST',
        body: {
          bedNumber: addBedForm.bedNumber.trim() || undefined
        }
      });
      if (res.success) {
        await showSuccess(res.message || 'Bed added successfully.');
        setShowAddBedModal(false);
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      await showError('Add bed failed: ' + err.message);
    } finally {
      setAddingBed(false);
    }
  };

  const handleOpenAllocateModal = async (bedObj: any) => {
    setTargetBedToAllocate(bedObj);
    setSelectedStudentForBed('');
    setAllocationNotes('');
    setShowAllocateModal(true);

    try {
      const targetGender = selectedHostelObj?.category === 'girls' ? 'female' : 'male';
      const res = await apiRequest<{ success: boolean; data: any[] }>(`/hostels/batch/unallocated-candidates?gender=${targetGender}`);
      if (res.success) {
        setAvailableCandidatesForBed(res.data);
        if (res.data.length > 0) {
          setSelectedStudentForBed(res.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmBedAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForBed || !targetBedToAllocate) return;
    try {
      setAllocatingBed(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/allocations', {
        method: 'POST',
        body: {
          studentId: selectedStudentForBed,
          hostelId: targetBedToAllocate.hostel_id || selectedHostel,
          roomId: targetBedToAllocate.room_id,
          bedId: targetBedToAllocate.bed_id,
          checkInDate: new Date().toISOString().split('T')[0],
          notes: allocationNotes || undefined
        }
      });
      if (res.success) {
        await showSuccess(res.message);
        setShowAllocateModal(false);
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      await showError('Allocation error: ' + err.message);
    } finally {
      setAllocatingBed(false);
    }
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
                setBatchResult(null);
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
      {hostels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {hostels.map((h) => {
            const isSelected = selectedHostel === h.id;
            const occRate = h.total_beds && h.total_beds > 0 ? Math.round(((h.occupied_beds || 0) / h.total_beds) * 100) : 0;

            return (
              <div
                key={h.id}
                onClick={() => setSelectedHostel(h.id)}
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
                  <button
                    type="button"
                    title="Delete this empty hostel"
                    onClick={handleDeleteHostel}
                    className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Hostel
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading rooms and beds...</div>
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVacateBed(rb.student_id, rb.student_name);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Vacate Bed (Release back to pool)"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-emerald-100">
                        <span className="text-[11px] text-emerald-700 font-medium">Available</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteBed(rb)}
                            className="h-6 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition font-medium flex items-center gap-1"
                            title={`Delete ${rb.bed_number} from Room ${rb.room_number}`}
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Delete</span>
                          </button>
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

      {/* MODAL: CREATE HOSTEL */}
      <Modal
        isOpen={showCreateHostelModal}
        onClose={() => setShowCreateHostelModal(false)}
        title="Add New University Hostel"
        size="lg"
        icon={<Building2 className="w-5 h-5 text-[#92582F]" />}
      >
        <form onSubmit={handleCreateHostel} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Hostel Name"
              placeholder="e.g. University Hostel 1"
              value={newHostel.name}
              onChange={(e) => {
                const name = e.target.value;
                const autoCode = name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'BH-1';
                const isGirls = /girl|women|ladies|\bgh\b/i.test(name);
                setNewHostel((prev) => ({
                  ...prev,
                  name,
                  code: prev.code || autoCode,
                  category: isGirls ? 'girls' : prev.category
                }));
              }}
            />

            <Input
              required
              label="Hostel Short Code"
              placeholder="e.g. BH-1 or GH-1"
              value={newHostel.code}
              onChange={(e) => setNewHostel({ ...newHostel, code: e.target.value.toUpperCase() })}
              className="uppercase font-mono font-bold"
            />

            <Select
              label="Wing / Category"
              value={newHostel.category}
              disabled={!!userWing}
              onChange={(e) => {
                const cat = e.target.value as 'boys' | 'girls';
                setNewHostel({
                  ...newHostel,
                  category: cat
                });
              }}
            >
              {userWing === 'boys' ? (
                <option value="boys">Boys Wing (Male Students)</option>
              ) : userWing === 'girls' ? (
                <option value="girls">Girls Wing (Female Students)</option>
              ) : (
                <>
                  <option value="boys">Boys Wing (Male Students)</option>
                  <option value="girls">Girls Wing (Female Students)</option>
                </>
              )}
            </Select>

            <Input
              label="Campus Location"
              value={newHostel.campus}
              onChange={(e) => setNewHostel({ ...newHostel, campus: e.target.value })}
            />
          </div>


          {/* Room Generation Configuration */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Auto-Generate Starting Rooms & Beds</span>
                <p className="text-[11px] text-slate-400">Creates blocks, floors, and bed capacity immediately</p>
              </div>
              <input
                type="checkbox"
                id="autoGenRooms"
                checked={newHostel.autoGenRooms}
                onChange={(e) => setNewHostel({ ...newHostel, autoGenRooms: e.target.checked })}
                className="w-4 h-4 text-[#92582F] rounded focus:ring-[#92582F]"
              />
            </div>

            {newHostel.autoGenRooms && (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Floors</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newHostel.numFloors}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHostel((prev) => ({
                        ...prev,
                        numFloors: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
                      }));
                    }}
                    onBlur={() => {
                      const n = parseInt(String(newHostel.numFloors), 10);
                      setNewHostel((prev) => ({
                        ...prev,
                        numFloors: isNaN(n) || n < 1 ? 1 : Math.min(10, n)
                      }));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md text-xs px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rooms/Floor</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={newHostel.roomsPerFloor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHostel((prev) => ({
                        ...prev,
                        roomsPerFloor: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
                      }));
                    }}
                    onBlur={() => {
                      const n = parseInt(String(newHostel.roomsPerFloor), 10);
                      setNewHostel((prev) => ({
                        ...prev,
                        roomsPerFloor: isNaN(n) || n < 1 ? 1 : Math.min(30, n)
                      }));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md text-xs px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Beds/Room</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newHostel.bedsPerRoom}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHostel((prev) => ({
                        ...prev,
                        bedsPerRoom: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
                      }));
                    }}
                    onBlur={() => {
                      const n = parseInt(String(newHostel.bedsPerRoom), 10);
                      setNewHostel((prev) => ({
                        ...prev,
                        bedsPerRoom: isNaN(n) || n < 1 ? 1 : Math.min(6, n)
                      }));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md text-xs px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div className="col-span-3 text-[11px] text-[#92582F] font-semibold bg-amber-50/60 p-2 rounded border border-amber-200/50">
                  Total starting capacity:{' '}
                  {(Number(newHostel.numFloors) || 0) * (Number(newHostel.roomsPerFloor) || 0) * (Number(newHostel.bedsPerRoom) || 0)} beds (
                  {(Number(newHostel.numFloors) || 0) * (Number(newHostel.roomsPerFloor) || 0)} rooms across{' '}
                  {Number(newHostel.numFloors) || 0} floor{Number(newHostel.numFloors) === 1 ? '' : 's'})
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateHostelModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
            >
              Create Hostel
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT HOSTEL */}
      <Modal
        isOpen={showEditHostelModal}
        onClose={() => {
          setShowEditHostelModal(false);
          setEditingHostel(null);
        }}
        title={`Edit Hostel: ${editingHostel?.name || ''}`}
        size="lg"
        icon={<Pencil className="w-5 h-5 text-indigo-600" />}
      >
        <form onSubmit={handleUpdateHostel} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Hostel Name"
              value={editHostelForm.name}
              onChange={(e) => setEditHostelForm({ ...editHostelForm, name: e.target.value })}
            />

            <Input
              required
              label="Hostel Short Code"
              value={editHostelForm.code}
              onChange={(e) => setEditHostelForm({ ...editHostelForm, code: e.target.value.toUpperCase() })}
              className="uppercase font-mono font-bold"
            />

            <Select
              label="Wing / Category"
              value={editHostelForm.category}
              disabled={!!userWing}
              onChange={(e) => {
                const cat = e.target.value as 'boys' | 'girls';
                setEditHostelForm({
                  ...editHostelForm,
                  category: cat
                });
              }}
            >
              {userWing === 'boys' ? (
                <option value="boys">Boys Wing (Male Students)</option>
              ) : userWing === 'girls' ? (
                <option value="girls">Girls Wing (Female Students)</option>
              ) : (
                <>
                  <option value="boys">Boys Wing (Male Students)</option>
                  <option value="girls">Girls Wing (Female Students)</option>
                </>
              )}
            </Select>

            <Input
              label="Campus Location"
              value={editHostelForm.campus}
              onChange={(e) => setEditHostelForm({ ...editHostelForm, campus: e.target.value })}
            />
          </div>


          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditHostelModal(false);
                setEditingHostel(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD ROOM */}
      <Modal
        isOpen={showAddRoomModal}
        onClose={() => setShowAddRoomModal(false)}
        title={`Add Room to ${selectedHostelObj?.name || 'Hostel'}`}
        size="md"
        icon={<DoorClosed className="w-5 h-5 text-[#23395D]" />}
      >
        <form onSubmit={handleAddRoom} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              required
              label="Room Number"
              placeholder="e.g. 106 or 201"
              value={newRoom.roomNumber}
              onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
              className="font-mono font-bold"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Floor Number</label>
              <input
                type="number"
                min={1}
                max={15}
                value={newRoom.floorNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewRoom((prev) => ({
                    ...prev,
                    floorNumber: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
                  }));
                }}
                onBlur={() => {
                  const n = parseInt(String(newRoom.floorNumber), 10);
                  setNewRoom((prev) => ({
                    ...prev,
                    floorNumber: isNaN(n) || n < 1 ? 1 : Math.min(15, n)
                  }));
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-md text-xs px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bed Capacity</label>
              <input
                type="number"
                min={1}
                max={8}
                value={newRoom.capacity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setNewRoom((prev) => ({ ...prev, capacity: '' }));
                    return;
                  }
                  const cap = Math.max(1, parseInt(val, 10) || 1);
                  const type = cap === 1 ? 'single' : cap === 2 ? 'double' : cap === 3 ? 'triple' : 'four_share';
                  setNewRoom((prev) => ({ ...prev, capacity: cap, roomType: type }));
                }}
                onBlur={() => {
                  const n = parseInt(String(newRoom.capacity), 10);
                  const cap = isNaN(n) || n < 1 ? 2 : Math.min(8, n);
                  const type = cap === 1 ? 'single' : cap === 2 ? 'double' : cap === 3 ? 'triple' : 'four_share';
                  setNewRoom((prev) => ({ ...prev, capacity: cap, roomType: type }));
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-md text-xs px-3 py-2 font-mono"
              />
            </div>

            <Select
              label="Room Type"
              value={newRoom.roomType}
              onChange={(e) => setNewRoom({ ...newRoom, roomType: e.target.value })}
            >
              <option value="single">Single (1 Bed)</option>
              <option value="double">Double (2 Beds)</option>
              <option value="triple">Triple (3 Beds)</option>
              <option value="four_share">Four Share (4 Beds)</option>
              <option value="dormitory">Dormitory</option>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddRoomModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Add Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ROOM TRANSFER */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Room / Hostel Transfer Workflow"
        size="md"
        icon={<ArrowRightLeft className="w-5 h-5 text-amber-500" />}
      >
        <form onSubmit={handleTransfer} className="space-y-3.5">
          <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
            Safely transfer a student between beds or hostels. Old allocation is vacated atomically and transfer history is logged.
          </p>

          <Input
            required
            label="Target Student ID"
            placeholder="e.g. AKNU-STU-1001"
            value={transferData.studentId}
            onChange={(e) => setTransferData({ ...transferData, studentId: e.target.value })}
          />

          <Select
            label="Target Hostel"
            value={transferData.toHostelId}
            onChange={(e) => setTransferData({ ...transferData, toHostelId: e.target.value })}
          >
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Target Room ID"
              placeholder="e.g. rm-bh1-102"
              value={transferData.toRoomId}
              onChange={(e) => setTransferData({ ...transferData, toRoomId: e.target.value })}
            />
            <Input
              required
              label="Target Bed ID"
              placeholder="e.g. bed-bh1-102-a"
              value={transferData.toBedId}
              onChange={(e) => setTransferData({ ...transferData, toBedId: e.target.value })}
            />
          </div>

          <Input
            required
            label="Transfer Justification Reason *"
            placeholder="e.g. Medical request / Academic branch wing adjustment"
            value={transferData.reason}
            onChange={(e) => setTransferData({ ...transferData, reason: e.target.value })}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowTransferModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Confirm Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SMART BATCH COHORT ALLOCATION */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Smart Batch Cohort Allocation"
        subtitle="Filter unallocated students by Course / Department / Year and assign sequentially to vacant beds."
        size="4xl"
        icon={<Sparkles className="w-5 h-5 text-indigo-600" />}
      >
        {batchResult ? (
          /* Result Summary View */
          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  Batch Allocation Completed Successfully
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Allocated <span className="font-bold">{batchResult.allocatedCount}</span> students to vacant beds sequentially.
                  {batchResult.remainingUnallocated > 0 && (
                    <span className="ml-1 text-amber-700 font-semibold">
                      ({batchResult.remainingUnallocated} students could not be allocated due to hostel capacity limit).
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Room</th>
                    <th className="p-2.5">Bed</th>
                    <th className="p-2.5">Floor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchResult.allocatedPairs?.map((pair: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-800">{pair.studentName}</td>
                      <td className="p-2.5 font-mono text-slate-500">{pair.rollNumber}</td>
                      <td className="p-2.5 font-semibold text-indigo-600">Room {pair.roomNumber}</td>
                      <td className="p-2.5 font-semibold text-slate-700">Bed {pair.bedNumber}</td>
                      <td className="p-2.5 text-slate-500">Floor {pair.floorNumber || '1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => {
                  setBatchResult(null);
                  fetchCandidates();
                }}
              >
                Allocate More Students
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchResult(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Wizard Config & Selection View */
          <div className="space-y-4 py-1">
            {/* Cohort Filter Controls */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> 1. Select Student Cohort Filters
                </span>
                {/* Gender Toggle: Only for Super Admin */}
                {!userWing ? (
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchGender('male');
                        setBatchDepartment('all');
                        setBatchCourse('all');
                        setBatchYear('all');
                        setSelectedStudentIds([]);
                      }}
                      className={`px-3 py-1 font-semibold rounded-md transition ${
                        batchGender === 'male'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Boys Wing (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchGender('female');
                        setBatchDepartment('all');
                        setBatchCourse('all');
                        setBatchYear('all');
                        setSelectedStudentIds([]);
                      }}
                      className={`px-3 py-1 font-semibold rounded-md transition ${
                        batchGender === 'female'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Girls Wing (Female)
                    </button>
                  </div>
                ) : (
                  <Badge variant={userWing === 'boys' ? 'primary' : 'neutral'}>
                    {userWing === 'boys' ? "Boys Wing Residents Only" : "Girls Wing Residents Only"}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Department {availableFilters.departments.length > 0 && `(${availableFilters.departments.length})`}
                  </label>
                  <select
                    value={batchDepartment}
                    onChange={(e) => setBatchDepartment(e.target.value)}
                    disabled={availableFilters.departments.length === 0}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {availableFilters.departments.length === 0 ? (
                      <option value="all">No Departments (0)</option>
                    ) : (
                      <>
                        <option value="all">All Departments ({availableFilters.totalUnallocated})</option>
                        {availableFilters.departments.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) ({d.count})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Course / Degree {availableFilters.courses.length > 0 && `(${availableFilters.courses.length})`}
                  </label>
                  <select
                    value={batchCourse}
                    onChange={(e) => setBatchCourse(e.target.value)}
                    disabled={availableFilters.courses.length === 0}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {availableFilters.courses.length === 0 ? (
                      <option value="all">No Courses (0)</option>
                    ) : (
                      <>
                        <option value="all">All Courses ({availableFilters.totalUnallocated})</option>
                        {availableFilters.courses.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code}) ({c.count})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Year of Study {availableFilters.years.length > 0 && `(${availableFilters.years.length})`}
                  </label>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    disabled={availableFilters.years.length === 0}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {availableFilters.years.length === 0 ? (
                      <option value="all">No Years (0)</option>
                    ) : (
                      <>
                        <option value="all">All Years ({availableFilters.totalUnallocated})</option>
                        {availableFilters.years.map((y: any) => (
                          <option key={y.year} value={String(y.year)}>
                            {y.label} ({y.count})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Search Student</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Name / Roll #"
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      className="w-full text-xs rounded-md border border-slate-300 pl-7 pr-2 py-1.5 focus:border-indigo-500 focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                  </div>
                </div>
              </div>
            </div>

            {/* Target Destination Hostel, Floor & Room Selection */}
            {(() => {
              const matchingHostels = hostels.filter((h) =>
                batchGender === 'male' ? h.category === 'boys' : h.category === 'girls'
              );
              const targetH = matchingHostels.find((h) => h.id === batchTargetHostel) || matchingHostels[0];

              let vacantBedsInTarget = 0;
              if (batchTargetRoom !== 'all') {
                const rm = targetRooms.find((r) => r.id === batchTargetRoom);
                vacantBedsInTarget = rm ? rm.vacantBeds : 0;
              } else if (batchTargetFloor !== 'all') {
                const fl = targetFloors.find((f) => String(f.floorNumber) === String(batchTargetFloor) || f.id === batchTargetFloor);
                vacantBedsInTarget = fl ? fl.vacantBeds : 0;
              } else if (targetH) {
                vacantBedsInTarget = Math.max(0, (targetH.total_beds || targetH.total_capacity || 0) - (targetH.occupied_beds || 0));
              }

              return (
                <div className="bg-indigo-50/60 p-3.5 rounded-lg border border-indigo-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" /> 2. Target Destination Hostel, Floor & Room
                    </span>
                    <span className="text-[11px] text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded font-medium">
                      Control allocation scope precisely by Hostel, Floor, or specific Room
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-indigo-900 block mb-1">
                        Destination Hostel ({batchGender === 'male' ? 'Boys Wing' : 'Girls Wing'}) *
                      </label>
                      <select
                        value={batchTargetHostel}
                        onChange={(e) => setBatchTargetHostel(e.target.value)}
                        className="w-full text-xs rounded-md border border-indigo-300 bg-white p-2 focus:border-indigo-600 focus:outline-none font-semibold text-slate-800"
                      >
                        {matchingHostels.map((h) => {
                          const vac = Math.max(0, (h.total_beds || h.total_capacity || 0) - (h.occupied_beds || 0));
                          return (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.code}) — {vac} vacant
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-indigo-900 block mb-1">
                        Target Floor (Optional)
                      </label>
                      <select
                        value={batchTargetFloor}
                        onChange={(e) => {
                          setBatchTargetFloor(e.target.value);
                          setBatchTargetRoom('all');
                        }}
                        className="w-full text-xs rounded-md border border-indigo-300 bg-white p-2 focus:border-indigo-600 focus:outline-none font-semibold text-slate-800"
                      >
                        <option value="all">All Floors (Entire Hostel)</option>
                        {targetFloors.map((fl) => (
                          <option key={fl.id} value={String(fl.floorNumber)}>
                            {fl.name} ({fl.vacantBeds} vacant beds)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-indigo-900 block mb-1">
                        Target Room (Optional)
                      </label>
                      <select
                        value={batchTargetRoom}
                        onChange={(e) => setBatchTargetRoom(e.target.value)}
                        className="w-full text-xs rounded-md border border-indigo-300 bg-white p-2 focus:border-indigo-600 focus:outline-none font-semibold text-slate-800"
                      >
                        <option value="all">All Rooms (Fill Sequentially)</option>
                        {targetRooms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            Room {rm.roomNumber} ({rm.vacantBeds} vacant / {rm.capacity} beds)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-1 border-t border-indigo-100 text-xs gap-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-slate-600">
                        Available in Selection: <strong className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-extrabold">{vacantBedsInTarget} beds</strong>
                      </span>
                      <span className="text-slate-600">
                        Selected Students: <strong className={`px-1.5 py-0.5 rounded font-extrabold ${selectedStudentIds.length <= vacantBedsInTarget ? 'text-indigo-700 bg-indigo-100' : 'text-amber-800 bg-amber-100'}`}>{selectedStudentIds.length} students</strong>
                      </span>
                    </div>

                    {batchTargetRoom !== 'all' ? (
                      <span className="text-[11px] font-medium text-indigo-700 italic">
                        🎯 Targeted exclusively to Room {targetRooms.find(r => r.id === batchTargetRoom)?.roomNumber}
                      </span>
                    ) : batchTargetFloor !== 'all' ? (
                      <span className="text-[11px] font-medium text-indigo-700 italic">
                        🏢 Restricted to Floor {batchTargetFloor} vacant rooms
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">
                        ⚡ Auto-fills lowest floor & lowest room numbers first
                      </span>
                    )}
                  </div>

                  {selectedStudentIds.length > vacantBedsInTarget && vacantBedsInTarget > 0 && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">
                      ⚠️ Warning: You selected {selectedStudentIds.length} students, but only {vacantBedsInTarget} vacant beds are available in this scope. The first {vacantBedsInTarget} students will be allocated sequentially, and the rest will remain unallocated.
                    </div>
                  )}

                  {vacantBedsInTarget === 0 && (
                    <div className="text-[11px] text-red-800 bg-red-50 border border-red-200 p-2 rounded">
                      ⛔ No vacant beds available in the selected {batchTargetRoom !== 'all' ? 'room' : batchTargetFloor !== 'all' ? 'floor' : 'hostel'}. Please adjust your selection or vacate beds first.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Candidates Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Unallocated Candidates ({candidates.length} found, {selectedStudentIds.length} selected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds(candidates.map((c) => c.id))}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentIds([])}
                    className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                {loadingCandidates ? (
                  <div className="text-center py-8 text-xs text-slate-400">Loading unallocated students...</div>
                ) : candidates.length > 0 ? (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-2 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={candidates.length > 0 && selectedStudentIds.length === candidates.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds(candidates.map((c) => c.id));
                              } else {
                                setSelectedStudentIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="p-2">Student Name</th>
                        <th className="p-2">Roll / Reg Number</th>
                        <th className="p-2">Course & Dept</th>
                        <th className="p-2">Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((s) => {
                        const isChecked = selectedStudentIds.includes(s.id);
                        return (
                          <tr
                            key={s.id}
                            onClick={() => {
                              setSelectedStudentIds((prev) =>
                                prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              );
                            }}
                            className={`cursor-pointer transition ${isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds((prev) => [...prev, s.id]);
                                  } else {
                                    setSelectedStudentIds((prev) => prev.filter((id) => id !== s.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2 font-bold text-slate-900">{s.full_name}</td>
                            <td className="p-2 font-mono text-slate-600">{s.roll_number || s.reg_number || 'N/A'}</td>
                            <td className="p-2 text-slate-600">
                              {s.course_code || s.course_name || 'General'} • {s.department_code || s.department_name || 'AKNU'}
                            </td>
                            <td className="p-2 font-semibold text-slate-700">Year {s.year_of_study || 1}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No unallocated {batchGender} students match the selected filters.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowBatchModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleExecuteBatchAllocate}
                disabled={allocatingBatch || selectedStudentIds.length === 0}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                {allocatingBatch
                  ? 'Allocating Cohort...'
                  : `Allocate ${selectedStudentIds.length} Student${selectedStudentIds.length === 1 ? '' : 's'} Sequentially`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: SINGLE BED ALLOCATION */}
      <Modal
        isOpen={showAllocateModal}
        onClose={() => setShowAllocateModal(false)}
        title={`Allocate Bed: Room ${targetBedToAllocate?.room_number || ''} • ${targetBedToAllocate?.bed_number || ''}`}
        size="md"
        icon={<Bed className="w-5 h-5 text-emerald-600" />}
      >
        <form onSubmit={handleConfirmBedAllocation} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Hostel:</span>
              <span className="font-bold text-slate-800">{selectedHostelObj?.name} ({selectedHostelObj?.code})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Room & Bed:</span>
              <span className="font-bold text-slate-800">Room {targetBedToAllocate?.room_number} • {targetBedToAllocate?.bed_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Wing Eligibility:</span>
              <span className="font-bold text-slate-800 uppercase">{selectedHostelObj?.category === 'girls' ? 'Female Students' : 'Male Students'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Unallocated Student <span className="text-red-500">*</span>
            </label>
            {availableCandidatesForBed.length > 0 ? (
              <Select
                required
                value={selectedStudentForBed}
                onChange={(e) => setSelectedStudentForBed(e.target.value)}
                options={availableCandidatesForBed.map((c) => ({
                  value: c.id,
                  label: `${c.full_name} (${c.roll_number}) • ${c.department_code || c.department_name || ''} - Year ${c.year_of_study || 1}`
                }))}
              />
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                No unallocated {selectedHostelObj?.category === 'girls' ? 'female' : 'male'} students found in database.
              </div>
            )}
          </div>

          <div>
            <Input
              label="Allocation Notes / Reference (Optional)"
              placeholder="e.g. Regular semester admission 2026-27"
              value={allocationNotes}
              onChange={(e) => setAllocationNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAllocateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={allocatingBed || !selectedStudentForBed}
            >
              {allocatingBed ? 'Allocating...' : 'Confirm Allocation'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* MODAL: ADD BED TO ROOM */}
      <Modal
        isOpen={showAddBedModal}
        onClose={() => setShowAddBedModal(false)}
        title={`Add Bed to Room: ${selectedHostelObj?.name || ''}`}
        size="md"
        icon={<Bed className="w-5 h-5 text-indigo-600" />}
      >
        <form onSubmit={handleConfirmAddBed} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Room <span className="text-red-500">*</span>
            </label>
            {uniqueRoomsInHostel.length > 0 ? (
              <Select
                required
                value={addBedForm.roomId}
                onChange={(e) => setAddBedForm((prev) => ({ ...prev, roomId: e.target.value }))}
                options={uniqueRoomsInHostel.map((r) => ({
                  value: r.room_id,
                  label: `Room ${r.room_number} (Currently has ${r.count} bed${r.count === 1 ? '' : 's'})`
                }))}
              />
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                No rooms configured in this hostel yet.
              </div>
            )}
          </div>

          <div>
            <Input
              label="Bed Label / Number (Optional)"
              placeholder="e.g. Bed 3 (leave blank for automatic sequence)"
              value={addBedForm.bedNumber}
              onChange={(e) => setAddBedForm((prev) => ({ ...prev, bedNumber: e.target.value }))}
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              If left blank, the system will automatically label it (e.g. Bed 3, Bed 4).
            </span>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddBedModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={addingBed || !addBedForm.roomId}
            >
              {addingBed ? 'Adding Bed...' : 'Add Bed to Room'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
