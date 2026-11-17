import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../services/api.js';
import { StudentProfile, Hostel } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { DigitalIdCardModal } from '../components/DigitalIdCardModal.js';
import { BulkImportModal } from './BulkImportModal.js';
import {
  StudentProfileModal,
  CreateStudentModal,
  EditStudentModal,
  AcademicDept,
  AcademicCourse
} from '../components/students/index.js';
import {
  Button,
  Input,
  Select,
  StatCard,
  TablePagination,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableLoading,
  TableEmpty,
  IconButton,
  SearchInput
} from '../components/ui/index.js';
import {
  Users,
  Search,
  FileSpreadsheet,
  CreditCard,
  Scan,
  RefreshCw,
  Building,
  Building2,
  UserPlus,
  Pencil,
  Trash2,
  Eye,
  X,
  SlidersHorizontal,
  UtensilsCrossed
} from 'lucide-react';

const DEFAULT_COURSES: AcademicCourse[] = [
  // UG Programmes (Undergraduate)
  { id: 'crs-btech', department_id: 'dept-cse', code: 'BTECH', name: 'B.Tech', duration_years: 4, program_level: 'UG' },
  { id: 'crs-bsc', department_id: 'dept-chem', code: 'BSC', name: 'B.Sc', duration_years: 3, program_level: 'UG' },
  { id: 'crs-bcom', department_id: 'dept-comm', code: 'BCOM', name: 'B.Com', duration_years: 3, program_level: 'UG' },
  { id: 'crs-ba', department_id: 'dept-eng', code: 'BA', name: 'B.A', duration_years: 3, program_level: 'UG' },
  { id: 'crs-bpharm', department_id: 'dept-pharm', code: 'BPHARM', name: 'B.Pharmacy', duration_years: 4, program_level: 'UG' },
  { id: 'crs-bed', department_id: 'dept-eng', code: 'BED', name: 'B.Ed', duration_years: 2, program_level: 'UG' },
  // PG Programmes (Postgraduate)
  { id: 'crs-mtech', department_id: 'dept-cse', code: 'MTECH', name: 'M.Tech', duration_years: 2, program_level: 'PG' },
  { id: 'crs-mca', department_id: 'dept-mca', code: 'MCA', name: 'MCA', duration_years: 2, program_level: 'PG' },
  { id: 'crs-mba', department_id: 'dept-mba', code: 'MBA', name: 'MBA', duration_years: 2, program_level: 'PG' },
  { id: 'crs-msc', department_id: 'dept-chem', code: 'MSC', name: 'M.Sc', duration_years: 2, program_level: 'PG' },
  { id: 'crs-mcom', department_id: 'dept-comm', code: 'MCOM', name: 'M.Com', duration_years: 2, program_level: 'PG' },
  { id: 'crs-ma', department_id: 'dept-eng', code: 'MA', name: 'M.A', duration_years: 2, program_level: 'PG' },
  { id: 'crs-mpharm', department_id: 'dept-pharm', code: 'MPHARM', name: 'M.Pharmacy', duration_years: 2, program_level: 'PG' },
  // Doctoral
  { id: 'crs-phd', department_id: 'dept-cse', code: 'PHD', name: 'Ph.D', duration_years: 3, program_level: 'PhD' }
];

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const { confirm, showSuccess, showError, showWarning } = useConfirm();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [departments, setDepartments] = useState<AcademicDept[]>([
    { id: 'dept-cse', code: 'CSE', name: 'Computer Science & Engineering' },
    { id: 'dept-ece', code: 'ECE', name: 'Electronics & Communication Engineering' },
    { id: 'dept-mech', code: 'MECH', name: 'Mechanical Engineering' },
    { id: 'dept-civil', code: 'CIVIL', name: 'Civil Engineering' },
    { id: 'dept-eee', code: 'EEE', name: 'Electrical & Electronics Engineering' },
    { id: 'dept-it', code: 'IT', name: 'Information Technology' },
    { id: 'dept-aids', code: 'AI-DS', name: 'Artificial Intelligence & Data Science' },
    { id: 'dept-mca', code: 'MCA', name: 'Master of Computer Applications' },
    { id: 'dept-mba', code: 'MBA', name: 'Department of Management Studies' },
    { id: 'dept-comm', code: 'COMM', name: 'Commerce & Accountancy' },
    { id: 'dept-chem', code: 'CHEM', name: 'Chemistry' },
    { id: 'dept-phys', code: 'PHYS', name: 'Physics' },
    { id: 'dept-math', code: 'MATH', name: 'Mathematics' },
    { id: 'dept-biotech', code: 'BIOTECH', name: 'Biotechnology' },
    { id: 'dept-pharm', code: 'PHARM', name: 'Pharmaceutical Sciences' },
    { id: 'dept-eng', code: 'ENG', name: 'English & Humanities' },
    { id: 'dept-econ', code: 'ECON', name: 'Economics' }
  ]);
  const [courses, setCourses] = useState<AcademicCourse[]>(DEFAULT_COURSES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programLevelFilter, setProgramLevelFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  // Dynamic filter options derived from table data
  const [filterMeta, setFilterMeta] = useState<{
    levels: Array<{ value: string; label: string; count: number }>;
    courses: Array<{ id: string; name: string; program_level?: string; count: number }>;
    hostels: Array<{ id: string; name: string; code: string; isUnassigned: boolean; count: number }>;
    statuses: Array<{ value: string; label: string; count: number }>;
  }>({
    levels: [],
    courses: [],
    hostels: [],
    statuses: []
  });

  // Derived filter options directly from the added students data
  const availableLevels = useMemo(() => {
    if (filterMeta.levels.length > 0) return filterMeta.levels;
    const map = new Map<string, number>();
    students.forEach((s) => {
      const lvl = s.program_level || 'UG';
      map.set(lvl, (map.get(lvl) || 0) + 1);
    });
    return Array.from(map.entries()).map(([lvl, count]) => ({
      value: lvl,
      label: lvl === 'UG' ? 'UG (Undergrad)' : lvl === 'PG' ? 'PG (Postgrad)' : lvl === 'PhD' ? 'Ph.D (Doctoral)' : lvl,
      count
    }));
  }, [filterMeta.levels, students]);

  const availableCourses = useMemo(() => {
    if (filterMeta.courses.length > 0) return filterMeta.courses;
    const map = new Map<string, { id: string; name: string; program_level?: string; count: number }>();
    students.forEach((s) => {
      const id = s.course_id || s.course_name || 'unassigned';
      const name = s.course_name || 'Unassigned Course';
      const prev = map.get(id);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(id, { id, name, program_level: s.program_level, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [filterMeta.courses, students]);

  const availableHostels = useMemo(() => {
    if (filterMeta.hostels.length > 0) return filterMeta.hostels;
    const map = new Map<string, { id: string; name: string; code: string; isUnassigned: boolean; count: number }>();
    students.forEach((s) => {
      const isUnassigned = !s.hostel_name || s.hostel_name === 'Unassigned' || !s.room_number;
      const id = isUnassigned ? 'unassigned' : (s.hostel_id || s.hostel_name || 'unassigned');
      const name = isUnassigned ? 'Unassigned to Bed' : (s.hostel_name || 'Unassigned');
      const code = s.hostel_code || '';
      const prev = map.get(id);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(id, { id, name, code, isUnassigned, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [filterMeta.hostels, students]);

  const availableStatuses = useMemo(() => {
    if (filterMeta.statuses.length > 0) return filterMeta.statuses;
    const map = new Map<string, number>();
    students.forEach((s) => {
      const st = s.hostel_status || 'active';
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries()).map(([st, count]) => ({
      value: st,
      label: st.charAt(0).toUpperCase() + st.slice(1),
      count
    }));
  }, [filterMeta.statuses, students]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    totalBoys: 0,
    totalGirls: 0,
    totalMessActive: 0
  });

  const [selectedStudentForId, setSelectedStudentForId] = useState<StudentProfile | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentProfile | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit Student Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const defaultGender = user?.assignedCategory === 'girls' ? 'female' : 'male';

  const fetchFilterOptions = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: {
          levels: Array<{ value: string; label: string; count: number }>;
          courses: Array<{ id: string; name: string; program_level?: string; count: number }>;
          hostels: Array<{ id: string; name: string; code: string; isUnassigned: boolean; count: number }>;
          statuses: Array<{ value: string; label: string; count: number }>;
        };
      }>('/students/meta/filter-options');
      if (res.success && res.data) {
        setFilterMeta(res.data);
      }
    } catch (e) {
      console.warn('Could not fetch dynamic filter metadata:', e);
    }
  };

  useEffect(() => {
    fetchHostels();
    fetchAcademicStructure();
    fetchFilterOptions();
  }, []);

  const fetchAcademicStructure = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: { departments: AcademicDept[]; courses: AcademicCourse[] };
      }>('/students/meta/academic-structure');
      if (res.success && res.data) {
        if (res.data.departments?.length) setDepartments(res.data.departments);
        if (res.data.courses?.length) setCourses(res.data.courses);
      }
    } catch (e) {
      console.warn('Using default academic structure options:', e);
    }
  };

  const handleCreateDepartment = async (name: string) => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: AcademicDept;
      }>('/students/meta/departments', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (res.success && res.data) {
        const createdDept = res.data;
        setDepartments((prev) => {
          if (prev.some((d) => d.id === createdDept.id)) return prev;
          return [...prev, createdDept];
        });
        return {
          value: createdDept.id,
          label: `${createdDept.code} — ${createdDept.name}`
        };
      }
    } catch (err: any) {
      console.error('Failed to create department on backend:', err);
      // Fallback optimistic local addition
      const tempCode = name.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';
      const tempId = `dept-${tempCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
      const localDept: AcademicDept = { id: tempId, code: tempCode, name };
      setDepartments((prev) => [...prev, localDept]);
      return { value: tempId, label: `${tempCode} — ${name}` };
    }
  };

  const handleCreateCourse = async (name: string) => {
    try {
      const res = await apiRequest<{
        success: boolean;
        data: AcademicCourse;
      }>('/students/meta/courses', {
        method: 'POST',
        body: JSON.stringify({
          name,
          departmentId: departments[0]?.id
        })
      });

      if (res.success && res.data) {
        const createdCourse = res.data;
        setCourses((prev) => {
          if (prev.some((c) => c.id === createdCourse.id)) return prev;
          return [...prev, createdCourse];
        });
        return {
          value: createdCourse.id,
          label: createdCourse.name
        };
      }
    } catch (err: any) {
      console.error('Failed to create course on backend:', err);
      // Fallback optimistic local addition
      const tempCode = name.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CRS';
      const tempId = `course-${tempCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
      const localCourse: AcademicCourse = {
        id: tempId,
        department_id: departments[0]?.id,
        code: tempCode,
        name,
        duration_years: 4
      };
      setCourses((prev) => [...prev, localCourse]);
      return { value: tempId, label: name };
    }
  };

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: Hostel[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
      }
    } catch (e) {
      console.error('Error fetching hostels:', e);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, hostelFilter, statusFilter, programLevelFilter, courseFilter]);

  useEffect(() => {
    fetchStudents();
  }, [search, hostelFilter, statusFilter, programLevelFilter, courseFilter, currentPage, pageSize]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (hostelFilter) params.append('hostelId', hostelFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (programLevelFilter) params.append('programLevel', programLevelFilter);
      if (courseFilter) params.append('courseId', courseFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));

      const res = await apiRequest<{
        success: boolean;
        data: StudentProfile[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
        stats?: { total: number; totalBoys: number; totalGirls: number; totalMessActive: number };
      }>(`/students?${params.toString()}`);
      if (res.success) {
        setStudents(res.data);
        if (res.pagination) {
          setTotalRecords(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        } else {
          setTotalRecords(res.data.length);
          setTotalPages(1);
        }
        if (res.stats) {
          setStats(res.stats);
        } else {
          setStats({
            total: res.pagination?.total ?? res.data.length,
            totalBoys: res.data.filter((s) => s.gender === 'male').length,
            totalGirls: res.data.filter((s) => s.gender === 'female').length,
            totalMessActive: res.data.filter((s) => s.mess_eligibility).length
          });
        }
      }
    } catch (e) {
      console.error('Error fetching students:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBiometric = async (studentId: string) => {
    const confirmed = await confirm({
      title: 'Sync Biometric Record',
      message: 'Are you sure you want to resync this student\'s biometric verification credentials?',
      confirmText: 'Sync Biometric',
      variant: 'info'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/students/${studentId}/regenerate-qr`, {
        method: 'POST'
      });
      if (res.success) {
        await showSuccess(res.message, 'Biometric Synced');
        fetchStudents();
      }
    } catch (e: any) {
      await showError('Failed: ' + e.message);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string, rollNumber: string) => {
    const confirmed = await confirm({
      title: 'Delete Student Record',
      message: `Are you sure you want to delete student "${studentName}" (${rollNumber})?\n\nThis will permanently remove their records, vacate any assigned beds, and deactivate their access.`,
      confirmText: 'Delete Student',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/students/${studentId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        await showSuccess(res.message, 'Student Deleted');
        fetchStudents();
      }
    } catch (err: any) {
      await showError('Failed to delete student: ' + err.message);
    }
  };

  const boysHostels = hostels.filter((h) => h.category === 'boys');
  const girlsHostels = hostels.filter((h) => h.category === 'girls');

  return (
    <div className="space-y-3">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#23395D] tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#92582F]" />
            Student Master Directory
          </h2>
          <p className="text-xs text-[#5C6675] mt-0.5">
            Adikavi Nannaya University Centralized Student Residential Registrations & Biometric Face Attendance
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
            onClick={() => setShowBulkImport(true)}
          >
            Bulk Import (Excel)
          </Button>

          <Button
            variant="accent"
            size="sm"
            leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            onClick={() => setShowCreateModal(true)}
          >
            Add Student 
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards (Strict Wing Isolation) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">
                {user?.assignedCategory === 'boys' ? "Boys Residents" : user?.assignedCategory === 'girls' ? "Girls Residents" : "Total Residents"}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                {stats.total}
              </span>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[11px] text-emerald-700 font-semibold truncate">Active on Campus</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#23395D]/5 border border-[#23395D]/10 flex items-center justify-center text-[#23395D] shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {user?.assignedCategory === 'boys' ? (
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Boys Hostels</span>
                <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                  {stats.totalBoys}
                </span>
                <span
                  className="text-[11px] text-blue-700 font-semibold mt-1.5 block truncate"
                  title={boysHostels.map((h) => h.name).join(', ')}
                >
                  {boysHostels.length > 0 ? boysHostels.map((h) => h.name).join(' & ') : "Boys' Wings"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        ) : user?.assignedCategory === 'girls' ? (
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Girls Hostels</span>
                <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                  {stats.totalGirls}
                </span>
                <span
                  className="text-[11px] text-rose-700 font-semibold mt-1.5 block truncate"
                  title={girlsHostels.map((h) => h.name).join(', ')}
                >
                  {girlsHostels.length > 0 ? girlsHostels.map((h) => h.name).join(' & ') : "Girls' Wings"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Boys Hostels</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                    {stats.totalBoys}
                  </span>
                  <span
                    className="text-[11px] text-blue-700 font-semibold mt-1.5 block truncate"
                    title={boysHostels.map((h) => h.name).join(', ')}
                  >
                    {boysHostels.length > 0 ? boysHostels.map((h) => h.name).join(' & ') : "Boys' Wings"}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Girls Hostels</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                    {stats.totalGirls}
                  </span>
                  <span
                    className="text-[11px] text-rose-700 font-semibold mt-1.5 block truncate"
                    title={girlsHostels.map((h) => h.name).join(', ')}
                  >
                    {girlsHostels.length > 0 ? girlsHostels.map((h) => h.name).join(' & ') : "Girls' Wings"}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Mess Active</span>
              <span className="text-2xl sm:text-3xl font-black text-[#92582F] mt-1 block tracking-tight">
                {stats.totalMessActive}
              </span>
              <span className="text-[11px] text-[#92582F] font-semibold mt-1.5 block truncate">Eligible Diners</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#92582F] shrink-0">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
          </div>
        </div>

        {user?.assignedCategory && user.assignedCategory !== 'all' && (
          <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Wing Buildings</span>
                <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
                  {hostels.length}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold mt-1.5 block truncate">
                  {user.assignedCategory === 'boys' ? "Boys Hostels Registered" : "Girls Hostels Registered"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Building className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unified Responsive Search & Filters Toolbar */}
      <div className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 sm:gap-2.5 items-center">
          {/* Search Input - spans 4 columns on large screens */}
          <div className="sm:col-span-2 md:col-span-4 lg:col-span-4">
            <SearchInput
              placeholder="Search by Name, Roll No, Reg No..."
              value={search}
              onChange={setSearch}
              onClear={() => setSearch('')}
            />
          </div>

          {/* Program Level Filter - spans 2 columns */}
          <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
            <Select
              value={programLevelFilter}
              onChange={(e) => {
                setProgramLevelFilter(e.target.value);
                setCourseFilter('');
              }}
            >
              <option value="">
                All Levels {availableLevels.length > 0 && totalRecords > 0 ? `(${totalRecords})` : ''}
              </option>
              {availableLevels.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label} ({lvl.count})
                </option>
              ))}
            </Select>
          </div>

          {/* Degree Filter - spans 2 columns */}
          <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
            <Select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">
                All Degrees {availableCourses.length > 0 && totalRecords > 0 ? `(${totalRecords})` : ''}
              </option>
              {availableCourses
                .filter((c) => !programLevelFilter || !c.program_level || c.program_level === programLevelFilter)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count})
                  </option>
                ))}
            </Select>
          </div>

          {/* Hostel Filter - spans 2 columns */}
          <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
            <Select
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
            >
              <option value="">
                All Hostels & Wings {availableHostels.length > 0 && totalRecords > 0 ? `(${totalRecords})` : ''}
              </option>
              {availableHostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.isUnassigned ? '⏳ ' : ''}{h.name} {h.code ? `(${h.code})` : ''} ({h.count})
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter - spans 2 columns */}
          <div className="sm:col-span-1 md:col-span-2 lg:col-span-2">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">
                All Statuses {availableStatuses.length > 0 && totalRecords > 0 ? `(${totalRecords})` : ''}
              </option>
              {availableStatuses.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label} ({st.count})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Active Filters Summary Strip */}
        {(Boolean(search) || Boolean(programLevelFilter) || Boolean(courseFilter) || Boolean(hostelFilter) || Boolean(statusFilter)) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
              <span className="font-semibold text-slate-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                Active Filters:
              </span>

              {search && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Search: <strong className="font-semibold">"{search}"</strong>
                  <IconButton
                    icon={<X className="w-3 h-3" />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setSearch('')}
                    title="Clear search"
                  />
                </span>
              )}

              {programLevelFilter && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Level: <strong className="font-semibold">{programLevelFilter}</strong>
                  <IconButton
                    icon={<X className="w-3 h-3" />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setProgramLevelFilter('')}
                    title="Clear level"
                  />
                </span>
              )}

              {courseFilter && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Degree: <strong className="font-semibold">{availableCourses.find((c) => String(c.id) === String(courseFilter))?.name || courseFilter}</strong>
                  <IconButton
                    icon={<X className="w-3 h-3" />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setCourseFilter('')}
                    title="Clear degree"
                  />
                </span>
              )}

              {hostelFilter && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  Hostel: <strong className="font-semibold">{availableHostels.find((h) => String(h.id) === String(hostelFilter))?.name || (hostelFilter === 'unassigned' ? 'Unassigned' : hostelFilter)}</strong>
                  <IconButton
                    icon={<X className="w-3 h-3" />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setHostelFilter('')}
                    title="Clear hostel"
                  />
                </span>
              )}

              {statusFilter && (
                <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Status: <strong className="font-semibold">{statusFilter.toUpperCase()}</strong>
                  <IconButton
                    icon={<X className="w-3 h-3" />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setStatusFilter('')}
                    title="Clear status"
                  />
                </span>
              )}
            </div>

            <Button
              variant="link"
              size="xs"
              onClick={() => {
                setSearch('');
                setProgramLevelFilter('');
                setCourseFilter('');
                setHostelFilter('');
                setStatusFilter('');
              }}
              className="text-rose-600 hover:text-rose-700"
            >
              Reset All Filters
            </Button>
          </div>
        )}
      </div>

      {/* Reusable Students Table */}
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="whitespace-nowrap">Student Details</TableHead>
            <TableHead className="whitespace-nowrap">Roll No</TableHead>
            <TableHead className="whitespace-nowrap">Level</TableHead>
            <TableHead className="whitespace-nowrap">Degree / Course</TableHead>
            <TableHead className="whitespace-nowrap">Branch / Specialization</TableHead>
            <TableHead className="whitespace-nowrap">Year & Sem</TableHead>
            <TableHead className="whitespace-nowrap">Hostel & Room</TableHead>
            <TableHead className="whitespace-nowrap">Admission Fee</TableHead>
            <TableHead className="whitespace-nowrap">Mess Dining</TableHead>
            <TableHead align="right" className="whitespace-nowrap">Credentials & Actions</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableLoading colSpan={10} message="Loading university student records..." />
          ) : students.length === 0 ? (
            <TableEmpty colSpan={10} message="No matching student records found." />
          ) : (
            students.map((stu) => (
              <TableRow key={stu.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center space-x-2.5 whitespace-nowrap">
                    {stu.photo_url ? (
                      <img
                        src={stu.photo_url}
                        alt={stu.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-[#23395D] shrink-0">
                        {stu.full_name?.charAt(0) || 'S'}
                      </div>
                    )}
                    <div className="whitespace-nowrap">
                      <span className="font-bold text-slate-800 text-sm block whitespace-nowrap">{stu.full_name}</span>
                      <span className="text-[11px] text-slate-500 capitalize whitespace-nowrap">{stu.gender}</span>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-mono font-bold text-aknu-blue block whitespace-nowrap">{stu.roll_number}</span>
                  <span className="text-[10px] font-mono text-slate-400 block whitespace-nowrap">{stu.reg_number}</span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {stu.program_level === 'PG' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                      PG
                    </span>
                  ) : stu.program_level === 'PhD' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                      Ph.D
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                      UG
                    </span>
                  )}
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-bold text-slate-800 block text-sm whitespace-nowrap">
                    {stu.course_name || 'B.Tech'}
                  </span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-medium text-slate-700 block text-xs whitespace-nowrap">
                    {stu.department_name || 'General Engineering'}
                  </span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-bold text-[#92582F] block text-xs whitespace-nowrap">
                    Year {stu.year_of_study || Math.ceil((stu.current_semester || 1) / 2)}
                  </span>
                  <span className="text-[11px] text-slate-500 block whitespace-nowrap">
                    Semester {stu.current_semester || 1}
                  </span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-semibold text-slate-800 block whitespace-nowrap">{stu.hostel_name || 'Unassigned'}</span>
                  <span className="text-[11px] text-slate-500 block whitespace-nowrap">
                    {stu.room_number ? `Rm ${stu.room_number} • ${stu.bed_number || 'Bed'}` : 'No Bed Allocation'}
                  </span>
                </TableCell>

                {/* Admission Fee Column */}
                <TableCell className="whitespace-nowrap">
                  {stu.admission_fee_status === 'exempted' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Fee Exempted
                    </span>
                  ) : stu.admission_fee_status === 'paid' || (Number(stu.admission_fee_pending || 0) === 0 && Number(stu.admission_fee_total || 0) > 0) ? (
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Paid: ₹{Number(stu.admission_fee_paid || stu.admission_fee_total || 0).toLocaleString('en-IN')}
                      </span>
                      {stu.admission_fee_payment_date && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(stu.admission_fee_payment_date).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  ) : Number(stu.admission_fee_paid || 0) > 0 ? (
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Partial: ₹{Number(stu.admission_fee_paid).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                        Due: ₹{Number(stu.admission_fee_pending || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Unpaid / Due
                      </span>
                      {Number(stu.admission_fee_total || 0) > 0 && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Due: ₹{Number(stu.admission_fee_total).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <Badge variant={stu.mess_eligibility ? 'success' : 'danger'} dot className="whitespace-nowrap">
                    {stu.mess_eligibility ? 'Eligible (All)' : 'Disabled'}
                  </Badge>
                </TableCell>

                <TableCell align="right" className="whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                    <Button
                      variant="secondary"
                      size="xs"
                      leftIcon={<Eye className="w-3.5 h-3.5 text-indigo-600" />}
                      onClick={() => setViewingStudent(stu)}
                      title="View Full Profile Details"
                      className="bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200"
                    >
                      View
                    </Button>

                    <Button
                      variant="primary"
                      size="xs"
                      leftIcon={<CreditCard className="w-3.5 h-3.5 text-amber-300" />}
                      onClick={() => setSelectedStudentForId(stu)}
                      title="View Student Resident ID Card"
                    >
                      ID Card
                    </Button>

                    {['super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'].includes(user?.role || '') && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setEditingStudent(stu);
                          setShowEditModal(true);
                        }}
                        title="Edit Student Profile"
                        className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {['super_admin', 'chief_warden'].includes(user?.role || '') && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteStudent(stu.id, stu.full_name, stu.roll_number)}
                        title="Delete Student Record"
                        className="text-slate-600 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Reusable Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageChange={setCurrentPage}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setCurrentPage(1);
        }}
      />

      {/* REUSABLE STUDENT FULL DETAILS VIEW MODAL */}
      <StudentProfileModal
        student={viewingStudent}
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        canEdit={['super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'].includes(user?.role || '')}
        onOpenEdit={(stu) => {
          setEditingStudent(stu);
          setShowEditModal(true);
        }}
        onOpenIdCard={(stu) => setSelectedStudentForId(stu)}
      />

      {/* DIGITAL ID CARD MODAL */}
      <DigitalIdCardModal
        student={selectedStudentForId}
        isOpen={!!selectedStudentForId}
        onClose={() => setSelectedStudentForId(null)}
        onQrUpdated={fetchStudents}
      />

      {/* BULK IMPORT MODAL */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImportComplete={fetchStudents}
      />

      {/* REUSABLE MANUAL ADD STUDENT MODAL */}
      <CreateStudentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStudentCreated={fetchStudents}
        hostels={hostels}
        departments={departments}
        courses={courses}
        defaultGender={user?.assignedCategory === 'girls' ? 'female' : 'male'}
        onCreateDepartment={handleCreateDepartment}
        onCreateCourse={handleCreateCourse}
      />

      {/* REUSABLE EDIT STUDENT MODAL */}
      <EditStudentModal
        student={editingStudent}
        isOpen={showEditModal && !!editingStudent}
        onClose={() => {
          setShowEditModal(false);
          setEditingStudent(null);
        }}
        onStudentUpdated={fetchStudents}
        departments={departments}
        courses={courses}
      />
    </div>
  );
};
