import React, { useEffect, useState } from 'react';
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
  Layers
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge
} from '../components/ui/index.js';

export const HostelsPage: React.FC = () => {
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<string>('');
  const [roomsWithBeds, setRoomsWithBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart Batch Allocation modal state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchGender, setBatchGender] = useState<'male' | 'female'>('male');
  const [batchCourse, setBatchCourse] = useState<string>('all');
  const [batchDepartment, setBatchDepartment] = useState<string>('all');
  const [batchYear, setBatchYear] = useState<string>('all');
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [batchTargetHostel, setBatchTargetHostel] = useState<string>('');
  const [batchTargetFloor, setBatchTargetFloor] = useState<string>('all');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [allocatingBatch, setAllocatingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [academicDepts, setAcademicDepts] = useState<any[]>([]);
  const [academicCourses, setAcademicCourses] = useState<any[]>([]);

  // Create Hostel modal
  const [showCreateHostelModal, setShowCreateHostelModal] = useState(false);
  const [newHostel, setNewHostel] = useState<{
    name: string;
    code: string;
    category: 'boys' | 'girls';
    campus: string;
    chiefWardenId: string;
    wardenId: string;
    autoGenRooms: boolean;
    numFloors: number | string;
    roomsPerFloor: number | string;
    bedsPerRoom: number | string;
  }>({
    name: '',
    code: '',
    category: 'boys',
    campus: 'Main Campus, Rajahmundry',
    chiefWardenId: 'usr-chief',
    wardenId: 'usr-warden-bh',
    autoGenRooms: true,
    numFloors: 2,
    roomsPerFloor: 5,
    bedsPerRoom: 2
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

  useEffect(() => {
    fetchHostels();
    fetchAcademicStructure();
  }, []);

  const fetchAcademicStructure = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: { departments: any[]; courses: any[] } }>('/students/meta/academic-structure');
      if (res.success && res.data) {
        if (res.data.departments) setAcademicDepts(res.data.departments);
        if (res.data.courses) setAcademicCourses(res.data.courses);
      }
    } catch (e) {
      console.warn('Academic structure fetch warning:', e);
    }
  };

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

  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const params = new URLSearchParams();
      params.append('gender', batchGender);
      if (batchDepartment !== 'all') params.append('departmentId', batchDepartment);
      if (batchCourse !== 'all') params.append('courseId', batchCourse);
      if (batchYear !== 'all') params.append('yearOfStudy', batchYear);
      if (batchSearch) params.append('search', batchSearch);

      const res = await apiRequest<{ success: boolean; data: any[] }>(`/hostels/batch/unallocated-candidates?${params.toString()}`);
      if (res.success) {
        setCandidates(res.data);
        setSelectedStudentIds(res.data.map((s) => s.id));
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
        campus: newHostel.campus.trim(),
        chiefWardenId: newHostel.chiefWardenId,
        wardenId: newHostel.wardenId
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
        alert(res.message);
        setShowCreateHostelModal(false);
        setNewHostel({
          name: '',
          code: '',
          category: 'boys',
          campus: 'Main Campus, Rajahmundry',
          chiefWardenId: 'usr-chief',
          wardenId: 'usr-warden-bh',
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
      alert('Failed to create hostel: ' + err.message);
    }
  };

  const handleDeleteHostel = async () => {
    if (!selectedHostel) return;
    const currentH = hostels.find((h) => h.id === selectedHostel);
    if (!confirm(`Are you sure you want to delete "${currentH?.name || selectedHostel}" and all its rooms and beds?`)) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/hostels/${selectedHostel}`, {
        method: 'DELETE'
      });
      if (res.success) {
        alert(res.message);
        await fetchHostels();
      }
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
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
        alert(res.message);
        setShowAddRoomModal(false);
        setNewRoom({ roomNumber: '', floorNumber: 1, capacity: 2, roomType: 'double' });
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      alert('Failed to add room: ' + err.message);
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
        alert(res.message);
        setShowTransferModal(false);
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      alert('Transfer failed: ' + err.message);
    }
  };

  const handleExecuteBatchAllocate = async () => {
    if (!batchTargetHostel) {
      alert('Please select a target destination hostel.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      alert('Please select at least one student from the cohort to allocate.');
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
      alert('Batch allocation error: ' + err.message);
    } finally {
      setAllocatingBatch(false);
    }
  };

  const handleVacateBed = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to vacate ${studentName || 'this student'}'s bed allocation? The bed will immediately return to vacant status.`)) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/hostels/batch/vacate', {
        method: 'POST',
        body: {
          studentIds: [studentId],
          reason: 'Manual bed checkout from grid'
        }
      });
      if (res.success) {
        alert(res.message);
        fetchRooms();
        fetchHostels();
      }
    } catch (err: any) {
      alert('Vacate failed: ' + err.message);
    }
  };

  const selectedHostelObj = hostels.find((h) => h.id === selectedHostel);

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Hostels & Room Allocation Matrix</h1>
          <p className="text-xs text-slate-500 mt-1">
            Hierarchy: University → Hostel Category → Building → Block → Floor → Room → Bed Inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setBatchResult(null);
              setShowBatchModal(true);
            }}
            leftIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            Smart Batch Allocation
          </Button>

          <Button
            onClick={() => setShowCreateHostelModal(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            variant="accent"
          >
            Add New Hostel
          </Button>

          {hostels.length > 0 && (
            <>
              <Button
                onClick={() => setShowAddRoomModal(true)}
                leftIcon={<DoorClosed className="w-4 h-4" />}
                variant="secondary"
              >
                Add Room
              </Button>

              <Button
                onClick={() => setShowTransferModal(true)}
                leftIcon={<ArrowRightLeft className="w-4 h-4" />}
                variant="primary"
              >
                Room Transfer
              </Button>
            </>
          )}
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
                  <span className="text-[10px] text-slate-400 capitalize font-medium">{h.category}</span>
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

              {(selectedHostelObj.occupied_beds || 0) === 0 && (
                <button
                  type="button"
                  title="Delete this empty hostel"
                  onClick={handleDeleteHostel}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Hostel
                </button>
              )}
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
                      : 'bg-emerald-50/40 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">
                      Room {rb.room_number} • {rb.bed_number}
                    </span>
                    <Badge
                      variant={rb.bed_status === 'occupied' ? 'primary' : 'success'}
                      dot
                    >
                      {rb.bed_status}
                    </Badge>
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
                      <span className="text-xs text-slate-400 italic">Available for allocation</span>
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
              placeholder="e.g. Godavari Bhavan"
              value={newHostel.name}
              onChange={(e) => {
                const name = e.target.value;
                const autoCode = name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'BH-1';
                setNewHostel({
                  ...newHostel,
                  name,
                  code: newHostel.code || autoCode
                });
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
              onChange={(e) => {
                const cat = e.target.value as 'boys' | 'girls';
                setNewHostel({
                  ...newHostel,
                  category: cat,
                  chiefWardenId: cat === 'girls' ? 'usr-chief-gh' : 'usr-chief',
                  wardenId: cat === 'girls' ? 'usr-warden-gh' : 'usr-warden-bh'
                });
              }}
            >
              <option value="boys">Boys Wing (Male Students)</option>
              <option value="girls">Girls Wing (Female Students)</option>
            </Select>

            <Input
              label="Campus Location"
              value={newHostel.campus}
              onChange={(e) => setNewHostel({ ...newHostel, campus: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Chief Warden in Charge"
              value={newHostel.chiefWardenId}
              onChange={(e) => setNewHostel({ ...newHostel, chiefWardenId: e.target.value })}
            >
              <option value="usr-chief">Prof. M. Ramana (Chief Warden Boys)</option>
              <option value="usr-chief-gh">Prof. K. Vijaya (Chief Warden Girls)</option>
            </Select>

            <Select
              label="Hostel Warden"
              value={newHostel.wardenId}
              onChange={(e) => setNewHostel({ ...newHostel, wardenId: e.target.value })}
            >
              <option value="usr-warden-bh">Dr. P. Satyanarayana (Hostel Warden Boys)</option>
              <option value="usr-warden-gh">Dr. S. Lakshmi (Hostel Warden Girls)</option>
            </Select>
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
                {/* Gender Toggle */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchGender('male');
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Department</label>
                  <select
                    value={batchDepartment}
                    onChange={(e) => setBatchDepartment(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Departments</option>
                    {academicDepts.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Course / Degree</label>
                  <select
                    value={batchCourse}
                    onChange={(e) => setBatchCourse(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Courses</option>
                    {academicCourses.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Year of Study</label>
                  <select
                    value={batchYear}
                    onChange={(e) => setBatchYear(e.target.value)}
                    className="w-full text-xs rounded-md border border-slate-300 p-1.5 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="all">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
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

            {/* Target Destination Hostel Selection */}
            {(() => {
              const matchingHostels = hostels.filter((h) =>
                batchGender === 'male' ? h.category === 'boys' : h.category === 'girls'
              );
              const targetH = matchingHostels.find((h) => h.id === batchTargetHostel) || matchingHostels[0];
              const vacantBedsInTarget = targetH
                ? Math.max(0, (targetH.total_beds || targetH.total_capacity || 0) - (targetH.occupied_beds || 0))
                : 0;

              return (
                <div className="bg-indigo-50/60 p-3.5 rounded-lg border border-indigo-200 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" /> 2. Target Destination Hostel & Capacity
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
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
                              {h.name} ({h.code}) — {vac} vacant beds available
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 sm:pt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Vacant Beds Available:</span>
                        <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {vacantBedsInTarget} beds
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Selected Students to Allocate:</span>
                        <span className={`font-extrabold px-2 py-0.5 rounded ${
                          selectedStudentIds.length <= vacantBedsInTarget
                            ? 'text-indigo-700 bg-indigo-100'
                            : 'text-amber-800 bg-amber-100'
                        }`}>
                          {selectedStudentIds.length} students
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedStudentIds.length > vacantBedsInTarget && vacantBedsInTarget > 0 && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">
                      ⚠️ Warning: You selected {selectedStudentIds.length} students, but only {vacantBedsInTarget} beds are vacant in this hostel. The first {vacantBedsInTarget} students will be allocated sequentially, and the rest will remain unallocated.
                    </div>
                  )}

                  {vacantBedsInTarget === 0 && (
                    <div className="text-[11px] text-red-800 bg-red-50 border border-red-200 p-2 rounded">
                      ⛔ No vacant beds available in the selected hostel. Please choose another hostel or vacate existing beds first.
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
    </div>
  );
};
