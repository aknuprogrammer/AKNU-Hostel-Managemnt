import React, { useState, useEffect, useMemo } from 'react';
import { Hostel } from '../../types.js';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Badge, ButtonGroup, Checkbox, SearchInput } from '../ui/index.js';
import {
  Sparkles,
  CheckCircle2,
  Filter,
  Layers,
  Users,
  Search
} from 'lucide-react';

export interface SmartAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWing?: 'boys' | 'girls' | null;
  hostels: Hostel[];
  onSuccess: () => void;
}

export const SmartAllocationModal: React.FC<SmartAllocationModalProps> = ({
  isOpen,
  onClose,
  userWing,
  hostels,
  onSuccess
}) => {
  const { showSuccess, showError } = useConfirm();

  const [batchGender, setBatchGender] = useState<'male' | 'female'>(
    userWing === 'girls' ? 'female' : 'male'
  );
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [allocatingBatch, setAllocatingBatch] = useState(false);

  // Filters for cohort selection
  const [batchDepartment, setBatchDepartment] = useState('all');
  const [batchCourse, setBatchCourse] = useState('all');
  const [batchYear, setBatchYear] = useState('all');
  const [batchSearch, setBatchSearch] = useState('');

  // Destination allocation targets
  const [batchTargetHostel, setBatchTargetHostel] = useState('');
  const [batchTargetFloor, setBatchTargetFloor] = useState<string>('all');
  const [batchTargetRoom, setBatchTargetRoom] = useState<string>('all');
  const [targetHostelRooms, setTargetHostelRooms] = useState<any[]>([]);

  // Allocation result report
  const [batchResult, setBatchResult] = useState<{
    allocatedCount: number;
    remainingUnallocated: number;
    allocatedPairs: any[];
  } | null>(null);

  // Dynamic filter metadata from unallocated students table
  const [availableFilters, setAvailableFilters] = useState<{
    totalUnallocated: number;
    departments: Array<{ id: string; name: string; code: string; count: number }>;
    courses: Array<{ id: string; name: string; code: string; count: number }>;
    years: Array<{ year: number; label: string; count: number }>;
  }>({
    totalUnallocated: 0,
    departments: [],
    courses: [],
    years: []
  });

  // Keep batch gender synchronized with user wing
  useEffect(() => {
    if (userWing) {
      setBatchGender(userWing === 'girls' ? 'female' : 'male');
    }
  }, [userWing]);

  // Set default target hostel when modal opens or gender changes
  useEffect(() => {
    if (isOpen) {
      const matching = hostels.filter((h) =>
        batchGender === 'male' ? h.category === 'boys' : h.category === 'girls'
      );
      if (matching.length > 0 && (!batchTargetHostel || !matching.some((h) => h.id === batchTargetHostel))) {
        setBatchTargetHostel(matching[0].id);
      }
    }
  }, [isOpen, batchGender, hostels]);

  // Fetch rooms for destination hostel
  useEffect(() => {
    if (isOpen && batchTargetHostel) {
      apiRequest<{ success: boolean; data: any[] }>(`/hostels/${batchTargetHostel}/rooms`)
        .then((res) => {
          if (res.success && res.data) {
            setTargetHostelRooms(res.data);
          }
        })
        .catch((err) => console.error('Error fetching target hostel rooms:', err));
    } else {
      setTargetHostelRooms([]);
    }
  }, [isOpen, batchTargetHostel]);

  // Derive target floors with vacancies
  const targetFloors = useMemo(() => {
    const map = new Map<string, { id: string; floorNumber: number | string; name: string; vacantBeds: number }>();
    targetHostelRooms.forEach((r) => {
      const flKey = String(r.floor_number ?? 1);
      const isVacant = r.bed_status === 'vacant';
      const existing = map.get(flKey);
      if (existing) {
        if (isVacant) existing.vacantBeds++;
      } else {
        map.set(flKey, {
          id: r.floor_id || flKey,
          floorNumber: r.floor_number ?? 1,
          name: r.floor_name || `Floor ${r.floor_number ?? 1}`,
          vacantBeds: isVacant ? 1 : 0
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(a.floorNumber) - Number(b.floorNumber));
  }, [targetHostelRooms]);

  // Derive target rooms with vacancies
  const targetRooms = useMemo(() => {
    const map = new Map<
      string,
      { id: string; roomNumber: string; floorNumber: number | string; vacantBeds: number; capacity: number }
    >();
    targetHostelRooms.forEach((r) => {
      if (
        batchTargetFloor !== 'all' &&
        String(r.floor_number) !== String(batchTargetFloor) &&
        r.floor_id !== batchTargetFloor
      ) {
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
    return Array.from(map.values()).sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
    );
  }, [targetHostelRooms, batchTargetFloor]);

  // Fetch unallocated candidates matching cohort filters
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
    if (isOpen) {
      fetchCandidates();
    }
  }, [isOpen, batchGender, batchDepartment, batchCourse, batchYear, batchSearch]);

  const handleExecuteBatchAllocate = async () => {
    if (selectedStudentIds.length === 0) {
      await showError('Please select at least one student to allocate.');
      return;
    }

    try {
      setAllocatingBatch(true);
      const res = await apiRequest<{
        success: boolean;
        message: string;
        data: {
          allocatedCount: number;
          remainingUnallocated: number;
          allocatedPairs: any[];
        };
      }>('/hostels/batch/smart-allocate', {
        method: 'POST',
        body: {
          studentIds: selectedStudentIds,
          targetHostelId: batchTargetHostel || undefined,
          targetFloorId: batchTargetFloor !== 'all' ? batchTargetFloor : undefined,
          targetRoomId: batchTargetRoom !== 'all' ? batchTargetRoom : undefined
        }
      });

      if (res.success) {
        setBatchResult(res.data);
        onSuccess();
      }
    } catch (err: any) {
      await showError('Smart allocation failed: ' + err.message);
    } finally {
      setAllocatingBatch(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
                onClose();
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
              {!userWing ? (
                <ButtonGroup<'male' | 'female'>
                  value={batchGender}
                  onChange={(val) => {
                    setBatchGender(val);
                    setBatchDepartment('all');
                    setBatchCourse('all');
                    setBatchYear('all');
                    setSelectedStudentIds([]);
                  }}
                  size="sm"
                  options={[
                    { value: 'male', label: 'Boys Wing (Male)' },
                    { value: 'female', label: 'Girls Wing (Female)' }
                  ]}
                />
              ) : (
                <Badge variant={userWing === 'boys' ? 'primary' : 'neutral'}>
                  {userWing === 'boys' ? 'Boys Wing Residents Only' : 'Girls Wing Residents Only'}
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
                <SearchInput
                  placeholder="Name / Roll #"
                  value={batchSearch}
                  onChange={setBatchSearch}
                />
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
              const fl = targetFloors.find(
                (f) => String(f.floorNumber) === String(batchTargetFloor) || f.id === batchTargetFloor
              );
              vacantBedsInTarget = fl ? fl.vacantBeds : 0;
            } else if (targetH) {
              vacantBedsInTarget = Math.max(
                0,
                (targetH.total_beds || targetH.total_capacity || 0) - (targetH.occupied_beds || 0)
              );
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
                        const vac = Math.max(
                          0,
                          (h.total_beds || h.total_capacity || 0) - (h.occupied_beds || 0)
                        );
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
                      Available in Selection:{' '}
                      <strong className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-extrabold">
                        {vacantBedsInTarget} beds
                      </strong>
                    </span>
                    <span className="text-slate-600">
                      Selected Students:{' '}
                      <strong
                        className={`px-1.5 py-0.5 rounded font-extrabold ${
                          selectedStudentIds.length <= vacantBedsInTarget
                            ? 'text-indigo-700 bg-indigo-100'
                            : 'text-amber-800 bg-amber-100'
                        }`}
                      >
                        {selectedStudentIds.length} students
                      </strong>
                    </span>
                  </div>

                  {batchTargetRoom !== 'all' ? (
                    <span className="text-[11px] font-medium text-indigo-700 italic">
                      🎯 Targeted exclusively to Room {targetRooms.find((r) => r.id === batchTargetRoom)?.roomNumber}
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
                    ⚠️ Warning: You selected {selectedStudentIds.length} students, but only {vacantBedsInTarget} vacant
                    beds are available in this scope. The first {vacantBedsInTarget} students will be allocated
                    sequentially, and the rest will remain unallocated.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Unallocated Candidates Selection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> 3. Select Candidates to Allocate (
                {selectedStudentIds.length} of {candidates.length} Selected)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedStudentIds(candidates.map((s) => s.id))}
                >
                  Select All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setSelectedStudentIds([])}
                  className="!text-slate-500 hover:!text-slate-700"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {loadingCandidates ? (
                <div className="text-center py-8 text-xs text-slate-500">Loading candidates...</div>
              ) : candidates.length > 0 ? (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <Checkbox
                          checked={selectedStudentIds.length === candidates.length && candidates.length > 0}
                          indeterminate={selectedStudentIds.length > 0 && selectedStudentIds.length < candidates.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(candidates.map((s) => s.id));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                          size="sm"
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
                            <Checkbox
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudentIds((prev) => [...prev, s.id]);
                                } else {
                                  setSelectedStudentIds((prev) => prev.filter((id) => id !== s.id));
                                }
                              }}
                              size="sm"
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
            <Button type="button" variant="secondary" onClick={onClose}>
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
  );
};
