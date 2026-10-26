import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../../types.js';
import { apiRequest } from '../../services/api.js';
import { useConfirm } from '../../context/ConfirmContext.js';
import { Modal, Button, Input, Select, Textarea, ButtonGroup } from '../ui/index.js';
import { Pencil, GraduationCap, CreditCard } from 'lucide-react';
import { AcademicDept, AcademicCourse } from './CreateStudentModal.js';

export interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  departments: AcademicDept[];
  courses: AcademicCourse[];
  onStudentUpdated: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  departments,
  courses,
  onStudentUpdated
}) => {
  const { showSuccess, showError } = useConfirm();
  const [isUpdating, setIsUpdating] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    gender: 'male',
    programLevel: 'UG' as 'UG' | 'PG' | 'PhD',
    departmentId: '',
    courseId: '',
    yearOfStudy: 1,
    currentSemester: 1,
    permanentAddress: '',
    guardianName: '',
    guardianPhone: '',
    messEligibility: true,
    hostelStatus: 'active',
    admissionFeeStatus: 'unpaid' as 'paid' | 'partial' | 'unpaid' | 'exempted',
    admissionFeeTotal: 25000,
    admissionFeePaid: 0,
    admissionFeePaymentDate: '',
    admissionFeeReceiptNo: '',
    admissionFeePaymentMode: 'upi' as 'upi' | 'bank_challan' | 'dd' | 'net_banking' | 'cash'
  });

  useEffect(() => {
    if (student && isOpen) {
      setForm({
        fullName: student.full_name || '',
        phone: student.phone || '',
        email: student.email || '',
        gender: student.gender || 'male',
        programLevel: student.program_level || 'UG',
        departmentId: student.department_id || departments[0]?.id || '',
        courseId: student.course_id || courses[0]?.id || '',
        yearOfStudy: student.year_of_study || 1,
        currentSemester: student.current_semester || 1,
        permanentAddress: student.permanent_address || '',
        guardianName: student.guardian_name || '',
        guardianPhone: student.guardian_phone || '',
        messEligibility: student.mess_eligibility ?? true,
        hostelStatus: student.hostel_status || 'active',
        admissionFeeStatus: student.admission_fee_status || 'unpaid',
        admissionFeeTotal: Number(student.admission_fee_total) || 25000,
        admissionFeePaid: Number(student.admission_fee_paid) || 0,
        admissionFeePaymentDate: student.admission_fee_payment_date
          ? student.admission_fee_payment_date.split('T')[0]
          : '',
        admissionFeeReceiptNo: student.admission_fee_receipt_no || '',
        admissionFeePaymentMode: student.admission_fee_payment_mode || 'upi'
      });
    }
  }, [student, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    try {
      setIsUpdating(true);
      const res = await apiRequest<{ success: boolean; message: string; data: StudentProfile }>(
        `/students/${student.id}`,
        {
          method: 'PUT',
          body: form
        }
      );
      if (res.success) {
        await showSuccess(res.message, 'Profile Updated');
        onClose();
        onStudentUpdated();
      }
    } catch (err: any) {
      await showError('Error updating student: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!student) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Student Profile: ${student.full_name || ''}`}
      subtitle={`Roll Number: ${student.roll_number || ''} • Reg: ${student.reg_number || ''}`}
      icon={<Pencil className="w-5 h-5 text-indigo-600" />}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            required
            label="Full Name *"
            placeholder="e.g. K. Sai Teja"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />

          <Select
            label="Gender *"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="male">Male (Boys Wing)</option>
            <option value="female">Female (Girls Wing)</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            required
            type="email"
            label="Email Address (Gmail / University Email) *"
            placeholder="e.g. student@gmail.com or saiteja@aknu.edu.in"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <Input
            required
            type="tel"
            label="Contact Mobile Phone *"
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="font-mono"
          />
        </div>

        {/* Academic Hierarchy */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#92582F] flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#92582F]" />
            Academic Program & Hierarchy
          </span>

          <div>
            <label className="block text-xs font-bold text-slate-700 tracking-wide mb-1.5">
              Program Level <span className="text-rose-500">*</span>
            </label>
            <ButtonGroup<'UG' | 'PG' | 'PhD'>
              value={form.programLevel}
              onChange={(lvl) => {
                const matching = courses.filter((c) => (c.program_level || 'UG') === lvl);
                const first = matching[0] || courses[0];
                setForm((prev) => ({
                  ...prev,
                  programLevel: lvl,
                  courseId: first?.id || prev.courseId,
                  yearOfStudy: 1,
                  currentSemester: 1
                }));
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
                }}
              >
                {courses
                  .filter((c) => (c.program_level || 'UG') === form.programLevel)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.duration_years} Years)
                    </option>
                  ))}
              </Select>
            </div>

            <Select
              label="Branch / Department *"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </Select>

            {/* Dynamic Year of Study */}
            {(() => {
              const selectedCourse = courses.find((c) => c.id === form.courseId);
              const maxYears = selectedCourse?.duration_years || (form.programLevel === 'UG' ? 4 : 2);
              const yearOptions = Array.from({ length: maxYears }, (_, i) => i + 1);

              return (
                <Select
                  label="Year of Study *"
                  value={form.yearOfStudy}
                  onChange={(e) => {
                    const yr = parseInt(e.target.value) || 1;
                    setForm({ ...form, yearOfStudy: yr, currentSemester: yr * 2 - 1 });
                  }}
                >
                  {yearOptions.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr === 1
                        ? '1st Year'
                        : yr === 2
                        ? '2nd Year'
                        : yr === 3
                        ? '3rd Year'
                        : `${yr}th Year`}
                    </option>
                  ))}
                </Select>
              );
            })()}

            {/* Dynamic Semester */}
            {(() => {
              const selectedCourse = courses.find((c) => c.id === form.courseId);
              const maxYears = selectedCourse?.duration_years || (form.programLevel === 'UG' ? 4 : 2);
              const totalSemesters = maxYears * 2;
              const semOptions = Array.from({ length: totalSemesters }, (_, i) => i + 1);

              return (
                <Select
                  label="Current Semester *"
                  value={form.currentSemester}
                  onChange={(e) => setForm({ ...form, currentSemester: parseInt(e.target.value) || 1 })}
                >
                  {semOptions.map((s) => (
                    <option key={s} value={s}>
                      Semester {s} (Year {Math.ceil(s / 2)})
                    </option>
                  ))}
                </Select>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Hostel Resident Status"
            value={form.hostelStatus}
            onChange={(e) => setForm({ ...form, hostelStatus: e.target.value })}
          >
            <option value="active">Active Resident</option>
            <option value="vacated">Vacated / Checked Out</option>
            <option value="suspended">Suspended</option>
          </Select>

          <Select
            label="Mess Dining Eligibility"
            value={form.messEligibility ? 'true' : 'false'}
            onChange={(e) => setForm({ ...form, messEligibility: e.target.value === 'true' })}
          >
            <option value="true">Eligible for All Meals</option>
            <option value="false">Mess Access Disabled</option>
          </Select>
        </div>

        <Textarea
          label="Permanent Home Address"
          placeholder="Door No, Street, Village/Town, Mandal, District, PIN Code"
          value={form.permanentAddress}
          onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
          rows={2}
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <h4 className="text-xs font-bold text-slate-800">Emergency & Guardian Contacts</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Parent / Guardian Name"
              placeholder="Father / Guardian Name"
              value={form.guardianName}
              onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
            />
            <Input
              type="tel"
              label="Parent / Guardian Phone"
              placeholder="Parent Contact Number"
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>

        {/* Admission Fee Section */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#23395D] flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#23395D]" />
              Hostel Admission Fee Clearance & Payments
            </span>
            {(() => {
              const tot = parseFloat(String(form.admissionFeeTotal || 0)) || 0;
              const pd = parseFloat(String(form.admissionFeePaid || 0)) || 0;
              const pend = Math.max(0, tot - pd);
              if (form.admissionFeeStatus === 'exempted') {
                return (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    Fee Exempted
                  </span>
                );
              }
              if (pend === 0 && tot > 0) {
                return (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Fully Paid (₹0 Due)
                  </span>
                );
              }
              if (pend > 0) {
                return (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Pending: ₹{pend.toLocaleString('en-IN')}
                  </span>
                );
              }
              return (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Unpaid
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Admission Fee Status"
              value={form.admissionFeeStatus}
              onChange={(e) => {
                const status = e.target.value as 'paid' | 'partial' | 'unpaid' | 'exempted';
                let updatedPaid = form.admissionFeePaid;
                if (status === 'paid') updatedPaid = form.admissionFeeTotal;
                else if (status === 'unpaid' || status === 'exempted') updatedPaid = 0;
                setForm({ ...form, admissionFeeStatus: status, admissionFeePaid: updatedPaid });
              }}
            >
              <option value="paid">Paid in Full</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid / Pending</option>
              <option value="exempted">Fee Exempted / Scholarship</option>
            </Select>

            <Input
              label="Total Prescribed Fee (₹)"
              type="number"
              min={0}
              placeholder="25000"
              value={form.admissionFeeTotal}
              onChange={(e) => setForm({ ...form, admissionFeeTotal: parseFloat(e.target.value) || 0 })}
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
              <option value="bank_challan">Bank Challan</option>
              <option value="dd">Demand Draft (DD)</option>
              <option value="net_banking">Internet Banking / NEFT</option>
              <option value="cash">Hostel Cash Counter</option>
            </Select>

            <Input
              label="Receipt / Challan / Ref No"
              placeholder="e.g. CHL-2026-9812"
              value={form.admissionFeeReceiptNo}
              onChange={(e) => setForm({ ...form, admissionFeeReceiptNo: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isUpdating}>
            {isUpdating ? 'Saving Changes...' : 'Save Student Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
