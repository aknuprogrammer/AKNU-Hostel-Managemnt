import React, { useState, useEffect } from 'react';
import { Hostel } from '../../types.js';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import {
  Modal,
  Button,
  Input,
  Select,
  SearchableCreatableSelect,
  Textarea,
  ButtonGroup,
  IconButton,
  PhotoCaptureUpload
} from '../ui/index.js';
import {
  UserPlus,
  GraduationCap,
  Sparkles,
  RefreshCw,
  MapPin,
  CreditCard
} from 'lucide-react';

export interface AcademicDept {
  id: string;
  code: string;
  name: string;
}

export interface AcademicCourse {
  id: string;
  department_id?: string;
  code: string;
  name: string;
  duration_years?: number;
  program_level?: 'UG' | 'PG' | 'PhD';
}

export interface CreateStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostels: Hostel[];
  departments: AcademicDept[];
  courses: AcademicCourse[];
  defaultGender: string;
  onStudentCreated: () => void;
  onCreateDepartment: (name: string) => Promise<{ value: string; label: string } | undefined>;
  onCreateCourse: (name: string) => Promise<{ value: string; label: string } | undefined>;
}

export const CreateStudentModal: React.FC<CreateStudentModalProps> = ({
  isOpen,
  onClose,
  hostels,
  departments,
  courses,
  defaultGender,
  onStudentCreated,
  onCreateDepartment,
  onCreateCourse
}) => {
  const { showSuccess, showError, showWarning } = useConfirm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingReg, setIsGeneratingReg] = useState(false);

  const [form, setForm] = useState({
    rollNumber: '',
    regNumber: '',
    fullName: '',
    gender: defaultGender,
    email: '',
    phone: '',
    programLevel: 'UG' as 'UG' | 'PG' | 'PhD',
    departmentId: 'dept-cse',
    courseId: 'crs-btech',
    hostelId: '',
    yearOfStudy: 1,
    currentSemester: 1,
    permanentAddress: '',
    guardianName: '',
    guardianPhone: '',
    admissionFeeStatus: 'paid' as 'paid' | 'partial' | 'unpaid' | 'exempted',
    admissionFeeTotal: 25000,
    admissionFeePaid: 25000,
    admissionFeePaymentDate: new Date().toISOString().split('T')[0],
    admissionFeeReceiptNo: '',
    admissionFeePaymentMode: 'upi' as 'upi' | 'bank_challan' | 'dd' | 'net_banking' | 'cash',
    photoUrl: ''
  });

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
    const preview = computeClientRegNumber(hostelId, courseId, deptId, gender);
    setForm((prev) => ({ ...prev, regNumber: preview }));

    setIsGeneratingReg(true);
    try {
      const liveYear = new Date().getFullYear();
      const res = await apiRequest<{ success: boolean; data: { regNumber: string } }>(
        `/students/meta/generate-reg-number?year=${liveYear}&hostelId=${encodeURIComponent(hostelId)}&courseId=${encodeURIComponent(courseId)}&departmentId=${encodeURIComponent(deptId)}&gender=${gender}`
      );
      if (res.success && res.data?.regNumber) {
        setForm((prev) => ({ ...prev, regNumber: res.data.regNumber }));
      }
    } catch (err) {
      console.warn('Using client-generated preview:', err);
    } finally {
      setIsGeneratingReg(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const activeHostel =
        form.hostelId ||
        hostels.find((h) => form.gender === 'female' ? h.category === 'girls' : h.category === 'boys')?.id ||
        hostels[0]?.id ||
        '';
      if (activeHostel && !form.hostelId) {
        setForm((prev) => ({ ...prev, hostelId: activeHostel }));
      }
      syncRegNumber(
        activeHostel,
        form.courseId || 'crs-btech-cse',
        form.departmentId || 'dept-cse',
        form.gender
      );
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.hostelId) {
      await showWarning('Please select a hostel building for the resident.', 'Hostel Required');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiRequest<{ success: boolean; message: string }>('/students', {
        method: 'POST',
        body: form
      });
      if (res.success) {
        await showSuccess(res.message, 'Student Enrolled');
        onClose();
        onStudentCreated();
      }
    } catch (err: any) {
      await showError('Error creating student: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Student Registration"
      subtitle="Add new university resident for room allocation & biometric face attendance"
      icon={<UserPlus className="w-5 h-5" />}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Academic & Hostel Details Section */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#92582F] flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#92582F]" />
            Academic Program & Hostel Placement
          </span>

          {/* Program Level Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1.5">
              Program Level <span className="text-rose-500">*</span>
            </label>
            <ButtonGroup<'UG' | 'PG' | 'PhD'>
              value={form.programLevel}
              onChange={(lvl) => {
                const matchingCourses = courses.filter((c) => (c.program_level || 'UG') === lvl);
                const firstCourse = matchingCourses[0] || courses[0];
                setForm((prev) => ({
                  ...prev,
                  programLevel: lvl,
                  courseId: firstCourse?.id || prev.courseId,
                  yearOfStudy: 1,
                  currentSemester: 1
                }));
                syncRegNumber(form.hostelId, firstCourse?.id || form.courseId, form.departmentId, form.gender);
              }}
              options={[
                { value: 'UG', label: 'UG (Undergraduate)' },
                { value: 'PG', label: 'PG (Postgraduate)' },
                { value: 'PhD', label: 'Ph.D (Doctoral)' }
              ]}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                Degree / Course <span className="text-rose-500">*</span>
              </label>
              <Select
                required
                value={form.courseId}
                onChange={(e) => {
                  const newCourseId = e.target.value;
                  const cObj = courses.find((c) => c.id === newCourseId);
                  const maxDur = cObj?.duration_years || (form.programLevel === 'UG' ? 4 : 2);
                  setForm((prev) => ({
                    ...prev,
                    courseId: newCourseId,
                    yearOfStudy: Math.min(prev.yearOfStudy, maxDur),
                    currentSemester: Math.min(prev.currentSemester, maxDur * 2)
                  }));
                  syncRegNumber(form.hostelId, newCourseId, form.departmentId, form.gender);
                }}
              >
                {courses
                  .filter((c) => !form.programLevel || (c.program_level || 'UG') === form.programLevel)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div>
              <SearchableCreatableSelect
                label="Branch / Specialization *"
                required
                placeholder="Search or type branch name..."
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.code} — ${d.name}`
                }))}
                value={form.departmentId}
                onChange={(val) => {
                  setForm((prev) => ({ ...prev, departmentId: val }));
                  syncRegNumber(form.hostelId, form.courseId, val, form.gender);
                }}
                onCreateOption={onCreateDepartment}
                createPromptPrefix="Add New Branch: "
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                Year of Study <span className="text-rose-500">*</span>
              </label>
              <Select
                value={form.yearOfStudy}
                onChange={(e) => {
                  const yr = parseInt(e.target.value) || 1;
                  setForm({ ...form, yearOfStudy: yr, currentSemester: yr * 2 - 1 });
                }}
              >
                {Array.from(
                  {
                    length:
                      courses.find((c) => c.id === form.courseId)?.duration_years ||
                      (form.programLevel === 'UG' ? 4 : 2)
                  },
                  (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Year {i + 1} ({i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`} Year)
                    </option>
                  )
                )}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                Current Semester <span className="text-rose-500">*</span>
              </label>
              <Select
                value={form.currentSemester}
                onChange={(e) => setForm({ ...form, currentSemester: parseInt(e.target.value) || 1 })}
              >
                <option value={form.yearOfStudy * 2 - 1}>Semester {form.yearOfStudy * 2 - 1} (Odd)</option>
                <option value={form.yearOfStudy * 2}>Semester {form.yearOfStudy * 2} (Even)</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                Hostel Building <span className="text-rose-500">*</span>
              </label>
              <Select
                required
                value={form.hostelId}
                onChange={(e) => {
                  const hId = e.target.value;
                  const selHostel = hostels.find((h) => h.id === hId);
                  const updatedGender = selHostel ? (selHostel.category === 'girls' ? 'female' : 'male') : form.gender;
                  setForm((prev) => ({ ...prev, hostelId: hId, gender: updatedGender }));
                  syncRegNumber(hId, form.courseId, form.departmentId, updatedGender);
                }}
              >
                {hostels
                  .filter((h) => form.gender === 'female' ? h.category === 'girls' : h.category === 'boys')
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
              </Select>
            </div>
          </div>
        </div>

        {/* 2. Personal & Contact Profile */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#92582F] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#92582F]" />
            Personal & University Identity
          </span>

          <PhotoCaptureUpload
            value={form.photoUrl}
            onChange={(url) => setForm((prev) => ({ ...prev, photoUrl: url }))}
            label="Student Face Photo (Required for Biometric Dining Verification)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Full Name (as per SSC / Intermediate) *"
              placeholder="e.g. K. Sai Teja"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
                Gender <span className="text-rose-500">*</span>
              </label>
              <Select
                value={form.gender}
                onChange={(e) => {
                  const g = e.target.value;
                  const matchHostel = hostels.find((h) => g === 'female' ? h.category === 'girls' : h.category === 'boys')?.id || hostels[0]?.id || '';
                  setForm((prev) => ({ ...prev, gender: g, hostelId: matchHostel }));
                  syncRegNumber(matchHostel, form.courseId, form.departmentId, g);
                }}
              >
                <option value="male">Male (Boys Hostel)</option>
                <option value="female">Female (Girls Hostel)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="University Roll / Hall Ticket Number *"
              placeholder="e.g. 22CSE099"
              value={form.rollNumber}
              onChange={(e) => setForm({ ...form, rollNumber: e.target.value.toUpperCase() })}
              className="font-mono uppercase font-bold"
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 tracking-wide">
                  Hostel Registration Number <span className="text-rose-500">*</span>
                </label>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => syncRegNumber(form.hostelId, form.courseId, form.departmentId, form.gender)}
                  leftIcon={<RefreshCw className={`w-3 h-3 ${isGeneratingReg ? 'animate-spin' : ''}`} />}
                  className="p-0 h-auto"
                >
                  Regenerate
                </Button>
              </div>
              <Input
                required
                readOnly
                placeholder="Auto-generated sequence"
                value={form.regNumber}
                className="bg-slate-100 font-mono text-aknu-blue font-bold cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              required
              label="Student Mobile Phone *"
              type="tel"
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <Input
              required
              label="Student Email Address *"
              type="email"
              placeholder="student@aknu.edu.in or gmail.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Guardian / Father Name"
              placeholder="e.g. K. Narayana Rao"
              value={form.guardianName}
              onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
            />

            <Input
              label="Guardian Contact Phone"
              type="tel"
              placeholder="Guardian mobile number"
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
            />
          </div>

          <Textarea
            label="Permanent Home Address (Mandatory for Outstation Pass)"
            placeholder="Door No, Street, Village/Town, District, State, PIN"
            value={form.permanentAddress}
            onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
            rows={2}
          />
        </div>

        {/* 3. Hostel Admission Fee Tracking Section */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#92582F] flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-[#92582F]" />
            Hostel Admission Fee Clearance & Receipt
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Admission Fee Clearance Status"
              value={form.admissionFeeStatus}
              onChange={(e) => {
                const st = e.target.value as any;
                const tot = form.admissionFeeTotal;
                let paid = form.admissionFeePaid;
                if (st === 'paid') paid = tot;
                else if (st === 'unpaid') paid = 0;
                setForm({ ...form, admissionFeeStatus: st, admissionFeePaid: paid });
              }}
            >
              <option value="paid">Fully Paid & Cleared</option>
              <option value="partial">Partial Payment Made</option>
              <option value="unpaid">Unpaid (Fee Due Pending)</option>
              <option value="exempted">Scholarship / Fee Exempted</option>
            </Select>

            <Input
              label="Prescribed Total Fee (₹)"
              type="number"
              min={0}
              value={form.admissionFeeTotal}
              onChange={(e) => {
                const tot = parseFloat(e.target.value) || 0;
                setForm({ ...form, admissionFeeTotal: tot });
              }}
              className="font-mono font-bold"
            />

            <Input
              label="Amount Paid (₹)"
              type="number"
              min={0}
              placeholder="25000"
              value={form.admissionFeePaid}
              onChange={(e) => {
                const pd = parseFloat(e.target.value) || 0;
                const tot = form.admissionFeeTotal;
                let st: 'paid' | 'partial' | 'unpaid' | 'exempted' = form.admissionFeeStatus;
                if (pd >= tot && tot > 0) st = 'paid';
                else if (pd > 0) st = 'partial';
                else if (st !== 'exempted') st = 'unpaid';
                setForm({ ...form, admissionFeePaid: pd, admissionFeeStatus: st });
              }}
              className="font-mono font-bold text-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Input
              label="Date of Payment"
              type="date"
              value={form.admissionFeePaymentDate}
              onChange={(e) => setForm({ ...form, admissionFeePaymentDate: e.target.value })}
            />

            <Select
              label="Payment Mode"
              value={form.admissionFeePaymentMode}
              onChange={(e) => setForm({ ...form, admissionFeePaymentMode: e.target.value as any })}
            >
              <option value="upi">UPI / Digital QR Transfer</option>
              <option value="bank_challan">Bank Challan (Andhra Bank / SBI)</option>
              <option value="dd">Demand Draft (DD)</option>
              <option value="net_banking">Internet Banking / NEFT / RTGS</option>
              <option value="cash">Hostel Cash Counter Receipt</option>
            </Select>

            <Input
              label="Receipt / Challan / Ref No"
              placeholder="e.g. CHL-2026-9812 or UPI Ref"
              value={form.admissionFeeReceiptNo}
              onChange={(e) => setForm({ ...form, admissionFeeReceiptNo: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register Resident'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
