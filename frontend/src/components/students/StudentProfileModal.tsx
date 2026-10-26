import React from 'react';
import { StudentProfile } from '../../types.js';
import { Modal, Badge, Button } from '../ui/index.js';
import {
  Eye,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  QrCode,
  Pencil
} from 'lucide-react';

export interface StudentProfileModalProps {
  student: StudentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenIdCard: (student: StudentProfile) => void;
  onOpenEdit: (student: StudentProfile) => void;
  canEdit: boolean;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  isOpen,
  onClose,
  onOpenIdCard,
  onOpenEdit,
  canEdit
}) => {
  if (!student) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${student.full_name} — Student Profile`}
      subtitle={`Roll No: ${student.roll_number} • Reg No: ${student.reg_number}`}
      size="2xl"
      icon={<Eye className="w-5 h-5 text-indigo-600" />}
    >
      <div className="space-y-4">
        {/* Top Identity & Status Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{student.full_name}</h3>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span className="font-mono font-bold text-aknu-blue">{student.roll_number}</span>
              <span>•</span>
              <span className="capitalize">{student.gender}</span>
              <span>•</span>
              <span>
                ID: <code className="text-slate-600">{student.student_id_code}</code>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={student.hostel_status === 'active' ? 'success' : 'danger'}>
              {student.hostel_status === 'active' ? 'Active Resident' : 'Vacated'}
            </Badge>
            <Badge variant={student.mess_eligibility ? 'success' : 'danger'} dot>
              {student.mess_eligibility ? 'Mess Eligible' : 'Mess Disabled'}
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
              <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                <span className="text-slate-500">Program Level:</span>
                <span className="font-bold">
                  {student.program_level === 'PG' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                      PG (Postgraduate)
                    </span>
                  ) : student.program_level === 'PhD' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                      Ph.D (Doctoral)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      UG (Undergraduate)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Degree / Course:</span>
                <span className="font-bold text-slate-800">{student.course_name || 'B.Tech'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Branch / Specialization:</span>
                <span className="font-semibold text-slate-800">{student.department_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Year & Semester:</span>
                <span className="font-semibold text-[#92582F]">
                  Year {student.year_of_study || Math.ceil((student.current_semester || 1) / 2)} • Semester{' '}
                  {student.current_semester || 1}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Registration Number:</span>
                <span className="font-mono font-bold text-aknu-blue text-[11px]">{student.reg_number}</span>
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
                  {student.hostel_name ? `${student.hostel_name} (${student.hostel_code || ''})` : 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Room & Bed:</span>
                <span className="font-semibold text-slate-800">
                  {student.room_number
                    ? `Room ${student.room_number} • ${student.bed_number || 'Bed'}`
                    : 'No Bed Allocation'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Allocation Status:</span>
                <span className="font-semibold text-slate-700">
                  {student.allocation_id ? 'Active Room Allocation' : 'Pending Allocation'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Biometric Status:</span>
                <span className="font-mono text-emerald-700 font-bold uppercase">{student.qr_status === 'active' ? 'Face Enrolled' : student.qr_status}</span>
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
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:
                  </span>
                  <span className="font-mono font-semibold text-slate-800">{student.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                  </span>
                  <span className="font-mono font-semibold text-slate-800">{student.email || 'N/A'}</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 flex items-center gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Permanent Address:
                  </span>
                  <p className="text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 text-xs leading-relaxed">
                    {student.permanent_address || 'No permanent address recorded'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Guardian Name:</span>
                  <span className="font-semibold text-slate-800">{student.guardian_name || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Guardian Phone:</span>
                  <span className="font-mono font-semibold text-slate-800">{student.guardian_phone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Emergency Contact:</span>
                  <span className="font-mono text-slate-700">{student.emergency_contact || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Hostel Admission Fee & Clearance */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                Hostel Admission Fee Payment Details
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  student.admission_fee_status === 'paid'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : student.admission_fee_status === 'partial'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : student.admission_fee_status === 'exempted'
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {student.admission_fee_status?.toUpperCase() || 'UNPAID'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-400 text-[10px] block">Prescribed Fee</span>
                <span className="font-bold text-slate-800">
                  ₹{Number(student.admission_fee_total || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Amount Paid</span>
                <span className="font-bold text-emerald-700">
                  ₹{Number(student.admission_fee_paid || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Balance / Pending</span>
                <span className="font-bold text-rose-600">
                  ₹{Number(student.admission_fee_pending || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Payment Date & Mode</span>
                <span className="font-medium text-slate-700">
                  {student.admission_fee_payment_date
                    ? new Date(student.admission_fee_payment_date).toLocaleDateString('en-IN')
                    : 'N/A'}{' '}
                  ({(student.admission_fee_payment_mode || 'UPI').toUpperCase()})
                </span>
                {student.admission_fee_receipt_no && (
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Ref: {student.admission_fee_receipt_no}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CreditCard className="w-4 h-4 text-amber-300" />}
            onClick={() => {
              onClose();
              onOpenIdCard(student);
            }}
          >
            View Resident ID Card
          </Button>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onOpenEdit(student);
                }}
              >
                Edit Profile
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
