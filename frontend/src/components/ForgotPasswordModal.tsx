import React, { useState } from 'react';
import { apiRequest } from '../services/api.js';
import { Modal, Button, Input } from './ui/index.js';
import { Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, Send, ShieldCheck, Clock } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdentifier?: string;
  onSuccess?: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialIdentifier = '',
  onSuccess
}) => {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync initial identifier if provided
  React.useEffect(() => {
    if (initialIdentifier) {
      setIdentifier(initialIdentifier);
    }
  }, [initialIdentifier]);

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
      setError('Please enter your university email or registration number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string; maskedEmail: string; identifier: string }>(
        '/auth/forgot-password/send-otp',
        {
          method: 'POST',
          body: { identifier: identifier.trim() }
        }
      );

      if (res.success) {
        setMaskedEmail(res.maskedEmail);
        setStep('verify');
        setResendCooldown(60); // 60 seconds cooldown
      } else {
        setError(res.message || 'Failed to send OTP email');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      setError('Please enter the 6-digit OTP received in your email');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        '/auth/forgot-password/verify-otp',
        {
          method: 'POST',
          body: {
            identifier: identifier.trim(),
            otp: otp.trim(),
            newPassword
          }
        }
      );

      if (res.success) {
        setStep('success');
      } else {
        setError(res.message || 'Failed to reset password');
      }
    } catch (err: any) {
      setError(err.message || 'Error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('request');
    setError('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setMaskedEmail('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'success' ? 'Password Reset Complete' : 'Reset Account Password'}
      size="md"
      icon={<KeyRound className="w-5 h-5 text-indigo-600" />}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Enter Identifier */}
        {step === 'request' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-lg text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">Forgot your password?</span> Enter your registered email address or student registration number below. We will send a secure 6-digit OTP to your registered inbox.
            </div>

            <Input
              label="Email Address or Registration Number"
              placeholder="e.g. staff@gmail.com, warden@aknu.edu.in, or 22CSE042"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Back to Sign In
              </button>
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Send Verification OTP
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter OTP & New Password */}
        {step === 'verify' && (
          <form onSubmit={handleVerifyOtpAndReset} className="space-y-3.5">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 leading-relaxed flex items-start space-x-2">
              <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span>OTP successfully sent to <strong>{maskedEmail}</strong>.</span>
                <span className="block text-[11px] text-emerald-700 mt-0.5">Please check your inbox or spam folder. Code expires in 10 minutes.</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                6-Digit One-Time Password (OTP) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-xl font-mono tracking-widest font-bold py-2.5 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Change Email / ID
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleSendOtp()}
                  className={`text-xs font-semibold ${
                    resendCooldown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-800'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                </button>

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={loading}
                >
                  Update Password
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: Success Screen */}
        {step === 'success' && (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Password Changed Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your password has been securely updated. You can now sign in to the AKNU Hostel Portal with your new credentials.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  handleClose();
                  if (onSuccess) onSuccess();
                }}
              >
                Proceed to Sign In
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
