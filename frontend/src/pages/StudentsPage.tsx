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
  Sparkles
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

  // Modals
  const [selectedStudentForId, setSelectedStudentForId] = useState<StudentProfile | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

    return `AKNU/${liveYear}/${hostelShort}/${courseShort}/${deptShort}/001`;
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
    fetchStudents();
  }, [search, hostelFilter, statusFilter]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (hostelFilter) params.append('hostelId', hostelFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiRequest<{ success: boolean; data: StudentProfile[] }>(`/students?${params.toString()}`);
      if (res.success) {
        setStudents(res.data);
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
          <span className="text-[10px] text-blue-700 font-semibold mt-1 block">Godavari & Krishna Bhavan</span>
        </div>

        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Girls Hostels</span>
          <span className="text-2xl font-black text-[#23395D] mt-1 block">
            {students.filter((s) => s.gender === 'female').length}
          </span>
          <span className="text-[10px] text-rose-700 font-semibold mt-1 block">Saraswati & Gautami Bhavan</span>
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
            containerClassName="w-48"
          >
            <option value="">All Assigned Hostels</option>
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
            <TableHead>Student Details</TableHead>
            <TableHead>Roll / Reg No</TableHead>
            <TableHead>Course & Program</TableHead>
            <TableHead>Hostel & Room</TableHead>
            <TableHead>Mess Dining Status</TableHead>
            <TableHead>Contact & Address</TableHead>
            <TableHead align="right">Credentials & Actions</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableLoading colSpan={7} message="Loading university student records..." />
          ) : students.length === 0 ? (
            <TableEmpty colSpan={7} message="No matching student records found." />
          ) : (
            students.map((stu) => (
              <TableRow key={stu.id}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <img
                      src={stu.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                      alt={stu.full_name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">{stu.full_name}</span>
                      <span className="text-[11px] text-slate-500 capitalize">{stu.gender}</span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <span className="font-mono font-bold text-aknu-blue block">{stu.roll_number}</span>
                  <span className="font-mono text-[10px] text-slate-400 block">{stu.reg_number}</span>
                </TableCell>

                <TableCell>
                  <span className="font-semibold text-slate-800 block truncate max-w-[170px]">
                    {stu.course_name || 'B.Tech Program'}
                  </span>
                  <span className="text-[11px] text-[#92582F] font-bold block">
                    Year {stu.year_of_study || Math.ceil((stu.current_semester || 1) / 2)} • Sem {stu.current_semester || 1}
                  </span>
                  {stu.department_name && (
                    <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">
                      {stu.department_name}
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  <span className="font-semibold text-slate-800 block">{stu.hostel_name || 'Unassigned'}</span>
                  <span className="text-[11px] text-slate-500 block">
                    {stu.room_number ? `Rm ${stu.room_number} • ${stu.bed_number || 'Bed'}` : 'No Bed Allocation'}
                  </span>
                </TableCell>

                <TableCell>
                  <Badge variant={stu.mess_eligibility ? 'success' : 'danger'} dot>
                    {stu.mess_eligibility ? 'Eligible (All)' : 'Disabled'}
                  </Badge>
                </TableCell>

                <TableCell>
                  <span className="text-slate-700 block font-mono">{stu.phone}</span>
                  <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">{stu.email}</span>
                  {stu.permanent_address && (
                    <span className="text-[10px] text-slate-500 block truncate max-w-[140px] mt-0.5" title={stu.permanent_address}>
                      📍 {stu.permanent_address}
                    </span>
                  )}
                </TableCell>

                <TableCell align="right">
                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="primary"
                      size="xs"
                      leftIcon={<QrCode className="w-3.5 h-3.5 text-amber-300" />}
                      onClick={() => setSelectedStudentForId(stu)}
                      title="View Digital QR ID Card"
                    >
                      Show ID
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleRegenerateQr(stu.id)}
                      title="Revoke & Regenerate QR"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
                    placeholder="AKNU/2026/BH1/BTECH/CSE/001"
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
    </div>
  );
};
