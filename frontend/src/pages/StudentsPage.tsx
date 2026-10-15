import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api.js';
import { StudentProfile, Hostel } from '../types.js';
import { useAuth } from '../context/AuthContext.js';
import { DigitalIdCardModal } from '../components/DigitalIdCardModal.js';
import { BulkImportModal } from './BulkImportModal.js';
import {
  Button,
  Input,
  Select,
  SearchableCreatableSelect,
  Textarea,
  Modal,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableLoading,
  TableEmpty
} from '../components/ui/index.js';
import {
  Users,
  Search,
  FileSpreadsheet,
  QrCode,
  RefreshCw,
  Building,
  UserPlus,
  GraduationCap,
  MapPin,
  Sparkles,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Mail,
  Phone
} from 'lucide-react';

interface AcademicDept {
  id: string;
  code: string;
  name: string;
}

interface AcademicCourse {
  id: string;
  department_id: string;
  code: string;
  name: string;
  duration_years: number;
}

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
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
  const [courses, setCourses] = useState<AcademicCourse[]>([
    { id: 'crs-btech-cse', department_id: 'dept-cse', code: 'BTECH', name: 'B.Tech', duration_years: 4 },
    { id: 'crs-mtech-cse', department_id: 'dept-cse', code: 'MTECH', name: 'M.Tech', duration_years: 2 },
    { id: 'crs-mba', department_id: 'dept-mba', code: 'MBA', name: 'MBA', duration_years: 2 },
    { id: 'crs-mca', department_id: 'dept-cse', code: 'MCA', name: 'MCA', duration_years: 2 },
    { id: 'crs-bsc', department_id: 'dept-cse', code: 'BSC', name: 'B.Sc', duration_years: 3 },
    { id: 'crs-msc', department_id: 'dept-cse', code: 'MSC', name: 'M.Sc', duration_years: 2 },
    { id: 'crs-bcom', department_id: 'dept-mba', code: 'BCOM', name: 'B.Com', duration_years: 3 },
    { id: 'crs-ba', department_id: 'dept-mba', code: 'BA', name: 'B.A', duration_years: 3 },
    { id: 'crs-phd', department_id: 'dept-cse', code: 'PHD', name: 'Ph.D', duration_years: 3 }
  ]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedStudentForId, setSelectedStudentForId] = useState<StudentProfile | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentProfile | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit Student Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    gender: 'male',
    departmentId: '',
    courseId: '',
    yearOfStudy: 1,
    currentSemester: 1,
    permanentAddress: '',
    guardianName: '',
    guardianPhone: '',
    messEligibility: true,
    hostelStatus: 'active'
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // New Student Form
  const defaultGender = user?.assignedCategory === 'girls' ? 'female' : 'male';
  const [newStudent, setNewStudent] = useState({
    rollNumber: '',
    regNumber: '',
    fullName: '',
    gender: defaultGender,
    email: '',
    phone: '',
    departmentId: 'dept-cse',
    courseId: 'crs-btech-cse',
    hostelId: '',
    yearOfStudy: 1,
    currentSemester: 1,
    permanentAddress: '',
    guardianName: '',
    guardianPhone: ''
  });
  const [isGeneratingReg, setIsGeneratingReg] = useState(false);

  const computeClientRegNumber = (
    hostelId: string,
    courseId: string,
    deptId: string,
    gender: string
  ) => {
    const liveYear = new Date().getFullYear();
    const h = hostels.find((item) => item.id === hostelId);
    let hostelShort = h ? (h.code || h.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '';
    if (!hostelShort) hostelShort = hostels[0]?.code ? hostels[0].code.toUpperCase() : (gender === 'female' ? 'GH' : 'BH');

    const c = courses.find((item) => item.id === courseId);
    let courseShort = c ? (c.code || c.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'BTECH';

    const d = departments.find((item) => item.id === deptId);
    let deptShort = d ? (d.code || d.name).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : 'CSE';

    return `AKNU/${liveYear}/${hostelShort}/${courseShort}/${deptShort}/0001`;
  };

  const syncRegNumber = async (
    hostelId: string,
    courseId: string,
    deptId: string,
    gender: string
  ) => {
    // 1. Instant client-side preview
    const preview = computeClientRegNumber(hostelId, courseId, deptId, gender);
    setNewStudent((prev) => ({ ...prev, regNumber: preview }));

    // 2. Accurate server sequence fetch
    setIsGeneratingReg(true);
    try {
      const liveYear = new Date().getFullYear();
      const res = await apiRequest<{ success: boolean; data: { regNumber: string } }>(
        `/students/meta/generate-reg-number?year=${liveYear}&hostelId=${encodeURIComponent(hostelId)}&courseId=${encodeURIComponent(courseId)}&departmentId=${encodeURIComponent(deptId)}&gender=${gender}`
      );
      if (res.success && res.data?.regNumber) {
        setNewStudent((prev) => ({ ...prev, regNumber: res.data.regNumber }));
      }
    } catch (err) {
      console.warn('Using client-generated preview:', err);
    } finally {
      setIsGeneratingReg(false);
    }
  };

  useEffect(() => {
    fetchHostels();
    fetchAcademicStructure();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      const activeHostel = newStudent.hostelId || hostels.find((h) => newStudent.gender === 'female' ? h.category === 'girls' : h.category === 'boys')?.id || (hostels[0]?.id || '');
      if (activeHostel && !newStudent.hostelId) {
        setNewStudent((prev) => ({ ...prev, hostelId: activeHostel }));
      }
      syncRegNumber(
        activeHostel,
        newStudent.courseId || 'crs-btech-cse',
        newStudent.departmentId || 'dept-cse',
        newStudent.gender
      );
    }
  }, [showCreateModal]);

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
        setNewStudent((prev) => ({
          ...prev,
          departmentId: createdDept.id
        }));
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
      setNewStudent((prev) => ({ ...prev, departmentId: tempId }));
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
          departmentId: newStudent.departmentId
        })
      });

      if (res.success && res.data) {
        const createdCourse = res.data;
        setCourses((prev) => {
          if (prev.some((c) => c.id === createdCourse.id)) return prev;
          return [...prev, createdCourse];
        });
        setNewStudent((prev) => ({
          ...prev,
          courseId: createdCourse.id
        }));
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
        department_id: newStudent.departmentId,
        code: tempCode,
        name,
        duration_years: 4
      };
      setCourses((prev) => [...prev, localCourse]);
      setNewStudent((prev) => ({ ...prev, courseId: tempId }));
      return { value: tempId, label: name };
    }
  };

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: Hostel[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          setNewStudent((prev) => {
            if (prev.hostelId && res.data.some((h) => h.id === prev.hostelId)) return prev;
            const match = res.data.find((h) => prev.gender === 'female' ? h.category === 'girls' : h.category === 'boys') || res.data[0];
            return { ...prev, hostelId: match.id };
          });
        }
      }
    } catch (e) {
      console.error('Error fetching hostels:', e);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, hostelFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [search, hostelFilter, statusFilter, currentPage, pageSize]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (hostelFilter) params.append('hostelId', hostelFilter);
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));

      const res = await apiRequest<{
        success: boolean;
        data: StudentProfile[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
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
      }
    } catch (e) {
      console.error('Error fetching students:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.hostelId) {
      alert('Please select a hostel. If no hostels exist, create a hostel first under the Hostels module.');
      return;
    }
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/students', {
        method: 'POST',
        body: newStudent
      });
      if (res.success) {
        alert(res.message);
        setShowCreateModal(false);
        const matchHostel = hostels.find((h) => defaultGender === 'female' ? h.category === 'girls' : h.category === 'boys')?.id || (hostels[0]?.id || '');
        setNewStudent({
          rollNumber: '',
          regNumber: '',
          fullName: '',
          gender: defaultGender,
          email: '',
          phone: '',
          departmentId: departments[0]?.id || 'dept-cse',
          courseId: courses[0]?.id || 'crs-btech-cse',
          hostelId: matchHostel,
          yearOfStudy: 1,
          currentSemester: 1,
          permanentAddress: '',
          guardianName: '',
          guardianPhone: ''
        });
        fetchStudents();
      }
    } catch (err: any) {
      alert('Error creating student: ' + err.message);
    }
  };

  const handleRegenerateQr = async (studentId: string) => {
    if (!confirm('Are you sure you want to regenerate this student QR credential? Any previously printed or saved QR will be revoked immediately.')) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/students/${studentId}/regenerate-qr`, {
        method: 'POST'
      });
      if (res.success) {
        alert(res.message);
        fetchStudents();
      }
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  const handleOpenEdit = (stu: StudentProfile) => {
    setEditingStudent(stu);
    setEditForm({
      fullName: stu.full_name || '',
      phone: stu.phone || '',
      email: stu.email || '',
      gender: stu.gender || 'male',
      departmentId: stu.department_id || departments[0]?.id || '',
      courseId: stu.course_id || courses[0]?.id || '',
      yearOfStudy: stu.year_of_study || 1,
      currentSemester: stu.current_semester || 1,
      permanentAddress: stu.permanent_address || '',
      guardianName: stu.guardian_name || '',
      guardianPhone: stu.guardian_phone || '',
      messEligibility: stu.mess_eligibility ?? true,
      hostelStatus: stu.hostel_status || 'active'
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsUpdating(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/students/${editingStudent.id}`, {
        method: 'PUT',
        body: editForm
      });
      if (res.success) {
        alert(res.message);
        setShowEditModal(false);
        setEditingStudent(null);
        fetchStudents();
      }
    } catch (err: any) {
      alert('Failed to update student: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string, rollNumber: string) => {
    if (!confirm(`Are you sure you want to delete student "${studentName}" (${rollNumber})?\n\nThis will permanently remove their records, vacate any assigned beds, and deactivate their access.`)) return;
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/students/${studentId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        alert(res.message);
        fetchStudents();
      }
    } catch (err: any) {
      alert('Failed to delete student: ' + err.message);
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
            Adikavi Nannaya University Centralized Student Residential Registrations & Cryptographic QR Passes
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Total Residents</span>
          <span className="text-2xl font-black text-[#23395D] mt-1 block">{students.length}</span>
          <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">Active on Campus</span>
        </div>

        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Boys Hostels</span>
          <span className="text-2xl font-black text-[#23395D] mt-1 block">
            {students.filter((s) => s.gender === 'male').length}
          </span>
          <span
            className="text-[10px] text-blue-700 font-semibold mt-1 block truncate"
            title={boysHostels.map((h) => h.name).join(', ')}
          >
            {boysHostels.length > 0 ? boysHostels.map((h) => h.name).join(' & ') : "Boys' Wings"}
          </span>
        </div>

        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Girls Hostels</span>
          <span className="text-2xl font-black text-[#23395D] mt-1 block">
            {students.filter((s) => s.gender === 'female').length}
          </span>
          <span
            className="text-[10px] text-rose-700 font-semibold mt-1 block truncate"
            title={girlsHostels.map((h) => h.name).join(', ')}
          >
            {girlsHostels.length > 0 ? girlsHostels.map((h) => h.name).join(' & ') : "Girls' Wings"}
          </span>
        </div>

        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Mess Active</span>
          <span className="text-2xl font-black text-[#92582F] mt-1 block">
            {students.filter((s) => s.mess_eligibility).length}
          </span>
          <span className="text-[10px] text-[#92582F] font-semibold mt-1 block">QR Verified Diners</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by Name, Roll No, Reg No..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={hostelFilter}
            onChange={(e) => setHostelFilter(e.target.value)}
            containerClassName="w-56"
          >
            <option value="">All Students (All Wings & Unassigned)</option>
            <option value="unassigned">⏳ Unassigned to Bed / Room</option>
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            containerClassName="w-36"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="vacated">Vacated</option>
          </Select>
        </div>
      </div>

      {/* Reusable Students Table */}
      <Table>
        <TableHeader>
          <tr>
            <TableHead className="whitespace-nowrap">Student Details</TableHead>
            <TableHead className="whitespace-nowrap">Roll No</TableHead>
            <TableHead className="whitespace-nowrap">Course & Program</TableHead>
            <TableHead className="whitespace-nowrap">Hostel & Room</TableHead>
            <TableHead className="whitespace-nowrap">Mess Dining Status</TableHead>
            <TableHead align="right" className="whitespace-nowrap">Credentials & Actions</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableLoading colSpan={6} message="Loading university student records..." />
          ) : students.length === 0 ? (
            <TableEmpty colSpan={6} message="No matching student records found." />
          ) : (
            students.map((stu) => (
              <TableRow key={stu.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="whitespace-nowrap">
                    <span className="font-bold text-slate-800 text-sm block whitespace-nowrap">{stu.full_name}</span>
                    <span className="text-[11px] text-slate-500 capitalize whitespace-nowrap">{stu.gender}</span>
                  </div>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-mono font-bold text-aknu-blue block whitespace-nowrap">{stu.roll_number}</span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-semibold text-slate-800 block whitespace-nowrap">
                    {stu.course_name || 'B.Tech Program'}
                  </span>
                  <span className="text-[11px] text-[#92582F] font-bold block whitespace-nowrap">
                    Year {stu.year_of_study || Math.ceil((stu.current_semester || 1) / 2)} • Sem {stu.current_semester || 1}
                  </span>
                  {stu.department_name && (
                    <span className="text-[10px] text-slate-400 block whitespace-nowrap">
                      {stu.department_name}
                    </span>
                  )}
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  <span className="font-semibold text-slate-800 block whitespace-nowrap">{stu.hostel_name || 'Unassigned'}</span>
                  <span className="text-[11px] text-slate-500 block whitespace-nowrap">
                    {stu.room_number ? `Rm ${stu.room_number} • ${stu.bed_number || 'Bed'}` : 'No Bed Allocation'}
                  </span>
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
                      leftIcon={<QrCode className="w-3.5 h-3.5 text-amber-300" />}
                      onClick={() => setSelectedStudentForId(stu)}
                      title="View Digital QR ID Card"
                    >
                      ID
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleRegenerateQr(stu.id)}
                      title="Revoke & Regenerate QR"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>

                    {['super_admin', 'chief_warden', 'hostel_warden'].includes(user?.role || '') && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleOpenEdit(stu)}
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

      {/* Pagination Footer */}
      <div className="bg-white rounded-lg p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-500">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
              setPageSize(val);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs font-bold text-[#23395D] focus:border-[#92582F] focus:ring-1 focus:ring-[#92582F] transition cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value="all">All</option>
          </select>

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-600">
            {totalRecords === 0 ? (
              '0 records'
            ) : pageSize === 'all' ? (
              <span>Showing all <strong className="text-slate-800">{totalRecords}</strong> records</span>
            ) : (
              <span>
                Showing <strong className="text-slate-800">{(currentPage - 1) * (typeof pageSize === 'number' ? pageSize : 10) + 1}</strong> to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * (typeof pageSize === 'number' ? pageSize : 10), totalRecords)}
                </strong>{' '}
                of <strong className="text-slate-800">{totalRecords}</strong> records
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || pageSize === 'all'}
            onClick={() => setCurrentPage(1)}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            type="button"
            disabled={currentPage <= 1 || pageSize === 'all'}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>

          <span className="px-2.5 py-1 font-semibold text-slate-700 text-xs">
            Page {pageSize === 'all' ? 1 : currentPage} of {pageSize === 'all' ? 1 : Math.max(1, totalPages)}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages || pageSize === 'all'}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages || pageSize === 'all'}
            onClick={() => setCurrentPage(totalPages)}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer disabled:cursor-not-allowed"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* STUDENT FULL DETAILS VIEW MODAL */}
      <Modal
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        title={viewingStudent ? `${viewingStudent.full_name} — Student Profile` : 'Student Details'}
        subtitle={viewingStudent ? `Roll No: ${viewingStudent.roll_number} • Reg No: ${viewingStudent.reg_number}` : ''}
        size="2xl"
        icon={<Eye className="w-5 h-5 text-indigo-600" />}
      >
        {viewingStudent && (
          <div className="space-y-4">
            {/* Top Identity & Status Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingStudent.full_name}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-mono font-bold text-aknu-blue">{viewingStudent.roll_number}</span>
                  <span>•</span>
                  <span className="capitalize">{viewingStudent.gender}</span>
                  <span>•</span>
                  <span>ID: <code className="text-slate-600">{viewingStudent.student_id_code}</code></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={viewingStudent.hostel_status === 'active' ? 'success' : 'danger'}>
                  {viewingStudent.hostel_status === 'active' ? 'Active Resident' : 'Vacated'}
                </Badge>
                <Badge variant={viewingStudent.mess_eligibility ? 'success' : 'danger'} dot>
                  {viewingStudent.mess_eligibility ? 'Mess Eligible' : 'Mess Disabled'}
                </Badge>
              </div>
            </div>

            {/* Grid 2-columns for Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Card 1: Academic Information */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Academic Information
                </span>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Program / Degree:</span>
                    <span className="font-bold text-slate-800">{viewingStudent.course_name || 'B.Tech Program'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-semibold text-slate-800">{viewingStudent.department_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Year & Semester:</span>
                    <span className="font-semibold text-[#92582F]">
                      Year {viewingStudent.year_of_study || Math.ceil((viewingStudent.current_semester || 1) / 2)} • Semester {viewingStudent.current_semester || 1}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Registration Number:</span>
                    <span className="font-mono font-bold text-aknu-blue text-[11px]">{viewingStudent.reg_number}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Hostel & Room Allocation */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Hostel & Room Allocation
                </span>
                <div className="space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Assigned Hostel:</span>
                    <span className="font-bold text-slate-800">
                      {viewingStudent.hostel_name ? `${viewingStudent.hostel_name} (${viewingStudent.hostel_code || ''})` : 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Room & Bed:</span>
                    <span className="font-semibold text-slate-800">
                      {viewingStudent.room_number ? `Room ${viewingStudent.room_number} • ${viewingStudent.bed_number || 'Bed'}` : 'No Bed Allocation'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Allocation Status:</span>
                    <span className="font-semibold text-slate-700">
                      {viewingStudent.allocation_id ? 'Active Room Allocation' : 'Pending Allocation'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">QR Status:</span>
                    <span className="font-mono text-emerald-700 font-bold uppercase">{viewingStudent.qr_status}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Contact & Address */}
              <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 md:col-span-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Contact & Guardian Information
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:</span>
                      <span className="font-mono font-semibold text-slate-800">{viewingStudent.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> Email:</span>
                      <span className="font-mono font-semibold text-slate-800">{viewingStudent.email || 'N/A'}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-500 flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Permanent Address:</span>
                      <p className="text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 text-xs leading-relaxed">
                        {viewingStudent.permanent_address || 'No permanent address recorded'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Guardian Name:</span>
                      <span className="font-semibold text-slate-800">{viewingStudent.guardian_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Guardian Phone:</span>
                      <span className="font-mono font-semibold text-slate-800">{viewingStudent.guardian_phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Emergency Contact:</span>
                      <span className="font-mono text-slate-700">{viewingStudent.emergency_contact || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<QrCode className="w-4 h-4 text-amber-300" />}
                onClick={() => {
                  const target = viewingStudent;
                  setViewingStudent(null);
                  setSelectedStudentForId(target);
                }}
              >
                View Digital QR ID Card
              </Button>

              <div className="flex items-center gap-2">
                {['super_admin', 'chief_warden', 'hostel_warden'].includes(user?.role || '') && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Pencil className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const target = viewingStudent;
                      setViewingStudent(null);
                      handleOpenEdit(target);
                    }}
                  >
                    Edit Profile
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewingStudent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

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

      {/* MANUAL ADD STUDENT MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Manual Student Registration"
        subtitle="Add new university resident & generate signed cryptographic QR credential"
        icon={<UserPlus className="w-5 h-5" />}
        size="2xl"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {/* 1. Academic & Hostel Details Section */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#92582F] flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#92582F]" />
              Academic Program & Hostel Placement
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Course Dropdown (First) */}
              <SearchableCreatableSelect
                label="Course"
                required
                placeholder="Select or search course (e.g. B.Tech, M.Tech, MBA)..."
                searchPlaceholder="Search or type new course name..."
                createPromptPrefix="Create course"
                options={courses.map((c) => ({
                  value: c.id,
                  label: c.name
                }))}
                value={newStudent.courseId}
                onChange={(newCourseId) => {
                  setNewStudent((prev) => ({ ...prev, courseId: newCourseId }));
                  syncRegNumber(newStudent.hostelId, newCourseId, newStudent.departmentId, newStudent.gender);
                }}
                onCreateOption={async (name) => {
                  const created = await handleCreateCourse(name);
                  if (created?.value) {
                    syncRegNumber(newStudent.hostelId, created.value, newStudent.departmentId, newStudent.gender);
                  }
                  return created;
                }}
              />

              {/* Department Dropdown (Second, unmapped) */}
              <SearchableCreatableSelect
                label="Department"
                required
                placeholder="Select or search department..."
                searchPlaceholder="Search or type new department..."
                createPromptPrefix="Create department"
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.code} — ${d.name}`,
                  subLabel: d.name,
                  badge: d.code
                }))}
                value={newStudent.departmentId}
                onChange={(newDeptId) => {
                  setNewStudent((prev) => ({ ...prev, departmentId: newDeptId }));
                  syncRegNumber(newStudent.hostelId, newStudent.courseId, newDeptId, newStudent.gender);
                }}
                onCreateOption={async (name) => {
                  const created = await handleCreateDepartment(name);
                  if (created?.value) {
                    syncRegNumber(newStudent.hostelId, newStudent.courseId, created.value, newStudent.gender);
                  }
                  return created;
                }}
              />

              {/* Hostel Assignment (Third) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                  Hostel <span className="text-rose-500">*</span>
                </label>
                {hostels.filter((h) => newStudent.gender === 'male' ? h.category === 'boys' : h.category === 'girls').length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs flex items-center justify-between">
                    <span>No {newStudent.gender === 'male' ? 'boys' : 'girls'} hostels available.</span>
                    <a href="/hostels" className="font-semibold underline hover:text-amber-900 ml-2">
                      Add Hostel
                    </a>
                  </div>
                ) : (
                  <Select
                    required
                    value={newStudent.hostelId}
                    onChange={(e) => {
                      const newHostelId = e.target.value;
                      setNewStudent((prev) => ({ ...prev, hostelId: newHostelId }));
                      syncRegNumber(newHostelId, newStudent.courseId, newStudent.departmentId, newStudent.gender);
                    }}
                  >
                    <option value="">-- Select Hostel --</option>
                    {hostels
                      .filter((h) => {
                        if (newStudent.gender === 'male') return h.category === 'boys';
                        if (newStudent.gender === 'female') return h.category === 'girls';
                        return true;
                      })
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.code})
                        </option>
                      ))}
                  </Select>
                )}
              </div>

              {/* Year of Study */}
              <Select
                label="Year of Study"
                value={newStudent.yearOfStudy}
                onChange={(e) => {
                  const y = parseInt(e.target.value) || 1;
                  setNewStudent({
                    ...newStudent,
                    yearOfStudy: y,
                    currentSemester: Math.max(1, y * 2 - 1)
                  });
                }}
              >
                <option value={1}>1st Year (Junior)</option>
                <option value={2}>2nd Year (Sophomore)</option>
                <option value={3}>3rd Year (Pre-final)</option>
                <option value={4}>4th Year (Final)</option>
              </Select>

              {/* Current Semester */}
              <Input
                label="Current Semester"
                required
                type="number"
                min={1}
                max={8}
                value={newStudent.currentSemester}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setNewStudent((prev) => ({ ...prev, currentSemester: '' as any }));
                    return;
                  }
                  const sem = Math.max(1, Math.min(8, parseInt(val, 10) || 1));
                  setNewStudent((prev) => ({
                    ...prev,
                    currentSemester: sem,
                    yearOfStudy: Math.ceil(sem / 2)
                  }));
                }}
                onBlur={() => {
                  const s = parseInt(String(newStudent.currentSemester), 10);
                  const sem = isNaN(s) || s < 1 ? 1 : Math.min(8, s);
                  setNewStudent((prev) => ({
                    ...prev,
                    currentSemester: sem,
                    yearOfStudy: Math.ceil(sem / 2)
                  }));
                }}
              />
            </div>
          </div>

          {/* 2. Basic Student Identifiers */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#23395D] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#23395D]" />
              Student Credentials & Identifiers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Roll Number"
                required
                placeholder="e.g. 22CSE055"
                value={newStudent.rollNumber}
                onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                className="uppercase font-mono font-bold"
              />

              {/* Registration Number (Autogenerated: AKNU/Year/Hostel/Course/Dept/Serial) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 tracking-wide">
                    Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-[#92582F] bg-[#F5EDE6] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#92582F]/20">
                    <Sparkles className="w-3 h-3 text-[#92582F]" />
                    Auto-generated
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={newStudent.regNumber}
                    onChange={(e) => setNewStudent({ ...newStudent, regNumber: e.target.value.toUpperCase() })}
                    placeholder="AKNU/2026/BH1/BTECH/CSE/0001"
                    className="w-full bg-white border border-slate-300 rounded-md text-xs px-3 py-2.5 font-mono font-bold tracking-wider uppercase text-[#23395D] focus:border-[#92582F] focus:ring-2 focus:ring-[#92582F]/20 pr-9 transition"
                  />
                  <button
                    type="button"
                    title="Refresh auto-generated sequence number"
                    onClick={() => syncRegNumber(newStudent.hostelId, newStudent.courseId, newStudent.departmentId, newStudent.gender)}
                    className="absolute right-2 text-slate-400 hover:text-[#92582F] p-1 rounded transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingReg ? 'animate-spin text-[#92582F]' : ''}`} />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Format: AKNU / Year / Hostel / Course / Department / Serial
                </p>
              </div>

              <Input
                label="Full Name"
                required
                placeholder="e.g. S. Venkateswara Rao"
                value={newStudent.fullName}
                onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
              />

              <Select
                label="Gender"
                value={newStudent.gender}
                onChange={(e) => {
                  const g = e.target.value;
                  const matchingHostel = hostels.find((h) => g === 'female' ? h.category === 'girls' : h.category === 'boys');
                  const targetHostelId = matchingHostel ? matchingHostel.id : newStudent.hostelId;
                  setNewStudent((prev) => ({ ...prev, gender: g, hostelId: targetHostelId }));
                  syncRegNumber(targetHostelId, newStudent.courseId, newStudent.departmentId, g);
                }}
              >
                {user?.assignedCategory === 'boys' ? (
                  <option value="male">Male (Boys Wing)</option>
                ) : user?.assignedCategory === 'girls' ? (
                  <option value="female">Female (Girls Wing)</option>
                ) : (
                  <>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </>
                )}
              </Select>
            </div>
          </div>

          {/* 3. Contact & Address */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#23395D] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#23395D]" />
              Contact & Permanent Residential Address
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Email"
                required
                type="email"
                placeholder="student@aknu.edu.in"
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
              />

              <Input
                label="Mobile Phone"
                required
                type="text"
                placeholder="9848011222"
                value={newStudent.phone}
                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                className="font-mono"
              />
            </div>

            <Textarea
              label="Permanent Address"
              required
              rows={2}
              placeholder="House No, Street, Village/Town, District, State, PIN Code"
              value={newStudent.permanentAddress}
              onChange={(e) => setNewStudent({ ...newStudent, permanentAddress: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="Guardian Name"
                placeholder="Parent / Guardian Name"
                value={newStudent.guardianName}
                onChange={(e) => setNewStudent({ ...newStudent, guardianName: e.target.value })}
              />

              <Input
                label="Guardian Phone"
                placeholder="Parent Contact Number"
                value={newStudent.guardianPhone}
                onChange={(e) => setNewStudent({ ...newStudent, guardianPhone: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
            >
              Register Student & Sign QR
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT STUDENT MODAL */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingStudent(null);
        }}
        title={`Edit Student Profile: ${editingStudent?.full_name || ''}`}
        subtitle={`Roll Number: ${editingStudent?.roll_number || ''} • Reg: ${editingStudent?.reg_number || ''}`}
        icon={<Pencil className="w-5 h-5 text-indigo-600" />}
        size="2xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Full Name *"
              placeholder="e.g. K. Sai Teja"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />

            <Select
              label="Gender *"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
            >
              <option value="male">Male (Boys Wing)</option>
              <option value="female">Female (Girls Wing)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              type="email"
              label="University Email *"
              placeholder="saiteja@aknu.edu.in"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />

            <Input
              required
              type="tel"
              label="Contact Mobile Phone *"
              placeholder="10-digit mobile"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department *"
              value={editForm.departmentId}
              onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>

            <Select
              label="Course / Degree *"
              value={editForm.courseId}
              onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value })}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Year of Study *"
              value={editForm.yearOfStudy}
              onChange={(e) => {
                const yr = parseInt(e.target.value) || 1;
                setEditForm({ ...editForm, yearOfStudy: yr, currentSemester: yr * 2 - 1 });
              }}
            >
              <option value={1}>1st Year (Fresher)</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year (Final)</option>
            </Select>

            <Select
              label="Current Semester *"
              value={editForm.currentSemester}
              onChange={(e) => setEditForm({ ...editForm, currentSemester: parseInt(e.target.value) || 1 })}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Hostel Resident Status"
              value={editForm.hostelStatus}
              onChange={(e) => setEditForm({ ...editForm, hostelStatus: e.target.value })}
            >
              <option value="active">Active Resident</option>
              <option value="vacated">Vacated / Checked Out</option>
              <option value="suspended">Suspended</option>
            </Select>

            <Select
              label="Mess Dining Eligibility"
              value={editForm.messEligibility ? 'true' : 'false'}
              onChange={(e) => setEditForm({ ...editForm, messEligibility: e.target.value === 'true' })}
            >
              <option value="true">Eligible for All Meals</option>
              <option value="false">Mess Access Disabled</option>
            </Select>
          </div>

          <Textarea
            label="Permanent Home Address"
            placeholder="Door No, Street, Village/Town, Mandal, District, PIN Code"
            value={editForm.permanentAddress}
            onChange={(e) => setEditForm({ ...editForm, permanentAddress: e.target.value })}
            rows={2}
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-slate-800">Emergency & Guardian Contacts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Parent / Guardian Name"
                placeholder="Father / Guardian Name"
                value={editForm.guardianName}
                onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
              />
              <Input
                type="tel"
                label="Parent / Guardian Phone"
                placeholder="Parent Contact Number"
                value={editForm.guardianPhone}
                onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setEditingStudent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving Changes...' : 'Save Student Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
