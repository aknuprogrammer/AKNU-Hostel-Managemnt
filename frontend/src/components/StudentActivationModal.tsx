import React, { useState } from 'react';
import { apiRequest, setStoredToken } from '../services/api.js';
import { Modal, Button, Input, IconButton } from './ui/index.js';
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
  Check
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
          password
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
      <div className="p-1 space-y-4">
        {/* Step Indicator Header */}
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#92582F] uppercase block">
                Student Onboarding • Step 3
              </span>
              <p className="text-xs text-slate-500">
                {step === 'request' && 'Verify your student record and hostel bed allocation.'}
                {step === 'verify' && 'Confirm your accommodation details and set your account password.'}
                {step === 'success' && 'Your resident identity is now activated.'}
              </p>
            </div>

            {/* Stepper Pill */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <span className={`w-2 h-2 rounded-full ${step === 'request' ? 'bg-[#23395D]' : 'bg-emerald-500'}`} />
              <span>{step === 'request' ? 'Step 1 of 2' : (step === 'verify' ? 'Step 2 of 2' : 'Completed')}</span>
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
            <div className="bg-[#FCFAF7] border border-[#DED8CF] p-3.5 rounded-lg text-xs text-slate-700 space-y-1.5 leading-relaxed">
              <p className="font-bold text-[#23395D] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#23395D]" />
                Admissions & Allocation Verification Required
              </p>
              <p className="text-slate-600">
                To activate your university resident account, please enter your registered <strong>Roll Number</strong> (e.g., <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">22CSE042</code>) or <strong>Registration Number</strong>.
              </p>
              <div className="text-[11px] text-[#92582F] font-semibold pt-1 border-t border-slate-200 flex items-center gap-1">
                <span>⚠️ Note:</span>
                <span>You can only register if your hostel and room have already been allocated by the warden in Step 2.</span>
              </div>
            </div>

            <div>
              <Input
                label="Student Roll Number or Reg Number"
                required
                type="text"
                placeholder="e.g. 22CSE042 or AKNU/2026/BH1/BTECH/CSE/0001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                leftIcon={<GraduationCap className="w-4 h-4 text-slate-400" />}
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || !identifier.trim()}
                className="bg-[#23395D] hover:bg-[#192B47] text-white flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Allocation...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Send OTP</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY OTP & SET PASSWORD */}
        {step === 'verify' && verifiedData && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            {/* Allocation Confirmed Card */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Hostel Allocation Confirmed (Step 2 Complete)
                </span>
                <span className="text-xs font-bold text-emerald-900 bg-white/80 px-2 py-0.5 rounded border border-emerald-300">
                  {identifier.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200/80">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Student Name:</span>
                  <span className="font-bold text-slate-900">{verifiedData.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Registration No:</span>
                  <span className="font-mono text-slate-800 font-bold text-[11px]">{verifiedData.regNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Allocated Hostel:</span>
                  <span className="font-bold text-[#23395D] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#23395D]" />
                    {verifiedData.hostelName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Room & Bed:</span>
                  <span className="font-bold text-[#92582F] flex items-center gap-1">
                    <DoorClosed className="w-3.5 h-3.5 text-[#92582F]" />
                    Room {verifiedData.roomNumber} • Bed {verifiedData.bedNumber}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-700" />
                <span>6-digit OTP code sent to <strong>{verifiedData.maskedEmail}</strong></span>
              </div>
            </div>

            {/* OTP Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
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
                maxLength={6}
                placeholder="• • • • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                className="font-mono text-center tracking-[0.4em] text-lg font-bold"
                leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
                autoFocus
              />
            </div>

            {/* Password Fields */}
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

            <div className="pt-2 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('request')}
                className="flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || otp.length !== 6 || password.length < 6 || password !== confirmPassword}
                className="bg-[#23395D] hover:bg-[#192B47] text-white flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Registration & Sign In</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
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
