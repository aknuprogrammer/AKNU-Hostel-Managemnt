import React, { useState } from 'react';
import { apiRequest, setStoredToken } from '../services/api.js';
import { Modal, Button, Input, IconButton, Select, PhotoCaptureUpload } from './ui/index.js';
import {
  GraduationCap,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  Send,
  Building2,
  DoorClosed,
  AlertTriangle,
  Mail,
  ShieldCheck,
  Check,
  CreditCard,
  Calendar,
  Receipt
} from 'lucide-react';

interface StudentActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdentifier?: string;
  onActivationSuccess?: (token: string, user: any) => void;
}

export const StudentActivationModal: React.FC<StudentActivationModalProps> = ({
  isOpen,
  onClose,
  initialIdentifier = '',
  onActivationSuccess
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Student Photo Capture / Upload
  const [photoUrl, setPhotoUrl] = useState('');

  // Hostel Admission Fee tracking
  const [admissionFeeStatus, setAdmissionFeeStatus] = useState<'paid' | 'pending'>('paid');
  const [admissionFeePaymentDate, setAdmissionFeePaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [admissionFeeReceiptNo, setAdmissionFeeReceiptNo] = useState('');
  const [admissionFeePaymentMode, setAdmissionFeePaymentMode] = useState<string>('upi');

  // Verified allocation info
  const [verifiedData, setVerifiedData] = useState<{
    maskedEmail: string;
    studentName: string;
    regNumber: string;
    hostelName: string;
    roomNumber: string;
    bedNumber: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync initial identifier if changed
  React.useEffect(() => {
    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
    }
  }, [initialIdentifier]);

  // Reset state when opening/closing
  React.useEffect(() => {
    if (isOpen) {
      setError('');
      setStep('request');
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setPhotoUrl('');
      setAdmissionFeeStatus('paid');
      setAdmissionFeePaymentDate(new Date().toISOString().split('T')[0]);
      setAdmissionFeeReceiptNo('');
      setAdmissionFeePaymentMode('upi');
    }
  }, [isOpen]);

  // Resend countdown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your Student Roll Number or University Registration Number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        maskedEmail: string;
        identifier: string;
        studentName: string;
        regNumber: string;
        hostelName: string;
        roomNumber: string;
        bedNumber: string;
      }>('/auth/student-activate/send-otp', {
        method: 'POST',
        body: { identifier: identifier.trim() }
      });

      if (res.success) {
        setVerifiedData({
          maskedEmail: res.maskedEmail,
          studentName: res.studentName,
          regNumber: res.regNumber,
          hostelName: res.hostelName,
          roomNumber: res.roomNumber,
          bedNumber: res.bedNumber
        });
        setStep('verify');
        setResendCooldown(60);
      } else {
        setError(res.message || 'Failed to verify student details');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code sent to your email');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Verification OTP must be exactly 6 digits');
      return;
    }
    if (!photoUrl) {
      setError('Please upload or take your live profile photo. This photo is required for biometric face recognition at meal counters.');
      return;
    }
    if (password.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        token: string;
        user: any;
      }>('/auth/student-activate/verify-and-register', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          otp: otp.trim(),
          password,
          photoUrl,
          admissionFeeStatus,
          admissionFeePaymentDate: admissionFeeStatus === 'paid' ? admissionFeePaymentDate : null,
          admissionFeeReceiptNo: admissionFeeStatus === 'paid' ? admissionFeeReceiptNo.trim() : null,
          admissionFeePaymentMode: admissionFeeStatus === 'paid' ? admissionFeePaymentMode : null
        }
      });

      if (res.success && res.token) {
        setStoredToken(res.token);
        setStep('success');
        setTimeout(() => {
          if (onActivationSuccess) {
            onActivationSuccess(res.token, res.user);
          }
          onClose();
        }, 1800);
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error completing registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        step === 'request'
          ? 'First-Time Student Registration'
          : step === 'verify'
          ? 'Verify OTP & Set Account Password'
          : 'Registration Confirmed!'
      }
      icon={<GraduationCap className="w-5 h-5 text-[#23395D]" />}
    >
      <div className="space-y-4">
        {/* Step Indicator Header */}
        <div className="pb-3 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider text-[#92582F] uppercase">
                  Resident Activation
                </span>
                <span className="hidden sm:inline-block text-slate-300">•</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline-block">
                  {step === 'request' ? 'Step 1 of 2: Record Verification' : (step === 'verify' ? 'Step 2 of 2: Security & Password' : 'Activation Complete')}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-normal">
                {step === 'request' && 'Verify your student admission record and hostel room allocation.'}
                {step === 'verify' && 'Upload biometric photo, confirm admission fee status, and set password.'}
                {step === 'success' && 'Your resident identity is now activated.'}
              </p>
            </div>

            {/* Stepper Pill */}
            <div className="self-start sm:self-center shrink-0 flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-full">
              <span className={`w-2 h-2 rounded-full shrink-0 ${step === 'request' ? 'bg-[#23395D]' : 'bg-emerald-500'}`} />
              <span className="whitespace-nowrap">{step === 'request' ? 'Step 1 of 2' : (step === 'verify' ? 'Step 2 of 2' : 'Completed')}</span>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs leading-relaxed flex items-start gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">Verification Notice</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* STEP 1: REQUEST VERIFICATION */}
        {step === 'request' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="bg-[#FCFAF7] border border-[#DED8CF] p-4 rounded-xl text-xs text-slate-700 space-y-2.5 leading-relaxed shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-[#23395D]/10 rounded-md text-[#23395D] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-[#23395D]" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-[#23395D] text-xs leading-snug">
                    Admissions & Allocation Verification Required
                  </h4>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                    To activate your university resident account, please enter your registered <strong>Roll Number</strong> (e.g., <code className="bg-slate-200/80 text-slate-800 font-mono px-1.5 py-0.5 rounded text-[11px]">22CSE042</code>) or <strong>Registration Number</strong>.
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-[#92582F] font-medium pt-2.5 border-t border-[#E8DEC8] flex items-start gap-2">
                <span className="shrink-0 font-bold bg-[#F3E7D7] text-[#92582F] px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
                  Prerequisite
                </span>
                <span className="leading-snug">
                  You can only register if your hostel and room have already been allocated by the warden.
                </span>
              </div>
            </div>

            <div>
              <Input
                label="Student Roll Number or Reg Number"
                required
                type="text"
                placeholder="e.g., 22CSE042 or 24CIVIL001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                leftIcon={<GraduationCap className="w-4 h-4 text-slate-400" />}
                autoFocus
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Enter your AKNU roll number or centralized student registration number.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={!identifier.trim()}
                rightIcon={<Send className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                {loading ? 'Verifying Allocation...' : 'Verify & Send OTP'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY OTP, PHOTO, ADMISSION FEE & SET PASSWORD */}
        {step === 'verify' && verifiedData && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            {/* Allocation Confirmed Card */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Hostel Allocation Confirmed
                </span>
                <span className="self-start sm:self-auto text-xs font-mono font-bold text-emerald-900 bg-white/90 px-2 py-0.5 rounded border border-emerald-300">
                  {identifier.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-2 border-t border-emerald-200/80">
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Student Name</span>
                  <span className="font-bold text-slate-900 block truncate">{verifiedData.studentName}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Registration No</span>
                  <span className="font-mono text-slate-800 font-bold text-[11px] block truncate">{verifiedData.regNumber}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Allocated Hostel</span>
                  <span className="font-bold text-[#23395D] flex items-center gap-1 truncate">
                    <Building2 className="w-3.5 h-3.5 text-[#23395D] shrink-0" />
                    <span className="truncate">{verifiedData.hostelName}</span>
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-slate-500 block text-[10px] font-semibold uppercase tracking-wider">Room & Bed</span>
                  <span className="font-bold text-[#92582F] flex items-center gap-1 truncate">
                    <DoorClosed className="w-3.5 h-3.5 text-[#92582F] shrink-0" />
                    <span>Room {verifiedData.roomNumber} • Bed {verifiedData.bedNumber}</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5 flex-wrap">
                <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>6-digit OTP code sent to <strong className="break-all">{verifiedData.maskedEmail}</strong></span>
              </div>
            </div>

            {/* SECTION 1: PHOTO CAPTURE / UPLOAD (MANDATORY FOR BIOMETRIC FACE VERIFICATION) */}
            <div className="pt-1">
              <PhotoCaptureUpload
                value={photoUrl}
                onChange={setPhotoUrl}
                required
                label="Resident Student Face Photo (Required for Biometric Dining Access)"
              />
            </div>

            {/* SECTION 2: HOSTEL ADMISSION FEE PAYMENT DETAILS */}
            <div className="bg-[#FCFAF7] border border-[#DED8CF] p-3.5 sm:p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E8DEC8] pb-2">
                <CreditCard className="w-4 h-4 text-[#92582F]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Hostel Admission Fee Status
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Hostel Admission Fee Paid? <span className="text-rose-500">*</span>
                  </label>
                  <Select
                    value={admissionFeeStatus}
                    onChange={(e) => setAdmissionFeeStatus(e.target.value as 'paid' | 'pending')}
                    options={[
                      { value: 'paid', label: 'Yes, Fee Paid in Full' },
                      { value: 'pending', label: 'No / Pending Verification' }
                    ]}
                  />
                </div>

                {admissionFeeStatus === 'paid' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={admissionFeePaymentMode}
                      onChange={(e) => setAdmissionFeePaymentMode(e.target.value)}
                      options={[
                        { value: 'upi', label: 'UPI (PhonePe, GPay, Paytm)' },
                        { value: 'bank_challan', label: 'SBI / Bank Challan' },
                        { value: 'net_banking', label: 'Net Banking / NEFT' },
                        { value: 'dd', label: 'Demand Draft (DD)' },
                        { value: 'cash', label: 'Cash at University Cashier' }
                      ]}
                    />
                  </div>
                )}
              </div>

              {admissionFeeStatus === 'paid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Input
                      label="Date of Payment"
                      type="date"
                      required
                      value={admissionFeePaymentDate}
                      onChange={(e) => setAdmissionFeePaymentDate(e.target.value)}
                      leftIcon={<Calendar className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                  <div>
                    <Input
                      label="Receipt / Challan / UTR Number"
                      type="text"
                      placeholder="e.g. SBI-CH-82910 or UTR Number"
                      value={admissionFeeReceiptNo}
                      onChange={(e) => setAdmissionFeeReceiptNo(e.target.value)}
                      leftIcon={<Receipt className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: OTP INPUT */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Enter 6-Digit Email OTP <span className="text-rose-500">*</span>
                </label>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleSendOtp()}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </Button>
              </div>
              <Input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="font-mono text-center tracking-[0.4em] text-lg font-bold"
                leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
                autoFocus
              />
            </div>

            {/* SECTION 4: PASSWORD FIELDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label="Create New Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                  rightIcon={
                    <IconButton
                      icon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      size="xs"
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'View password'}
                    />
                  }
                />
              </div>

              <div>
                <Input
                  label="Confirm Password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('request')}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={otp.length !== 6 || !photoUrl || password.length < 6 || password !== confirmPassword}
                rightIcon={<Check className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                {loading ? 'Activating Account...' : 'Complete Registration & Sign In'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'success' && verifiedData && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">
                Welcome to AKNU Hostels!
              </h3>
              <p className="text-sm font-semibold text-emerald-700 mt-1">
                Account Registration & Activation Successful
              </p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
                Hello <strong>{verifiedData.studentName}</strong>, your digital identity has been activated for <strong>{verifiedData.hostelName}</strong> (Room {verifiedData.roomNumber}).
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg max-w-xs mx-auto text-xs text-slate-600 flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[#23395D] border-t-transparent rounded-full animate-spin" />
              <span>Redirecting to your student portal...</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );

};
