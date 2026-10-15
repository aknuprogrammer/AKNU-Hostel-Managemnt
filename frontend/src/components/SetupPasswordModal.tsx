import React, { useState, useEffect } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { apiRequest, setStoredToken } from '../services/api.js';

interface SetupPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (identifier: string, newPass: string) => void;
  initialIdentifier?: string;
  initialTemporaryPassword?: string;
}

export const SetupPasswordModal: React.FC<SetupPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialIdentifier = '',
  initialTemporaryPassword = ''
}) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [temporaryPassword, setTemporaryPassword] = useState(initialTemporaryPassword);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIdentifier(initialIdentifier);
      setTemporaryPassword(initialTemporaryPassword);
      setErrorMsg('');
      setSuccessMsg('');
      setNewPassword('');
      setConfirmPassword('');
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [isOpen, initialIdentifier, initialTemporaryPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Account identifier is missing. Please enter your Roll Number or Email on the login form.');
      return;
    }
    if (!temporaryPassword) {
      setErrorMsg('Temporary password is required to verify identity before setting new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string; token?: string; user?: any }>('/auth/setup-password', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          temporaryPassword,
          newPassword
        }
      });

      if (res.success) {
        if (res.token) {
          setStoredToken(res.token);
        }
        setSuccessMsg(res.message || 'Password set up successfully!');
        setTimeout(() => {
          onSuccess(identifier.trim(), newPassword);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password. Please check your temporary credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-[#DED8CF] overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-[#23395D] text-white flex justify-between items-center border-b border-[#192B47]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E0AD83]/20 flex items-center justify-center text-[#E0AD83]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Setup New Password
              </h3>
              <p className="text-[11px] text-[#A9C0E4]">
                Replace temporary password with your private credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:text-white rounded-md transition text-[#DCE5F1]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - strictly contains New Password and Confirm Password with Eye Icons */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* User Account Verification Pill */}
          <div className="p-3 rounded-lg bg-[#F7F3ED] border border-[#DED8CF] flex items-center justify-between text-xs">
            <div>
              <span className="text-[#737C89] font-medium block text-[11px]">Authorized Account</span>
              <span className="font-extrabold text-[#202B3C]">{identifier || 'Current User'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Temp Password Verified</span>
            </div>
          </div>

          {/* Field 1: New Password (with eye toggle) */}
          <div>
            <label className="text-xs font-bold text-[#202B3C] block mb-1">
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#737C89] absolute left-3 top-3" />
              <input
                required
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 bg-[#FCFAF7] border border-[#DED8CF] rounded-md text-xs text-[#202B3C] placeholder-[#737C89] focus:outline-none focus:border-[#5276A5]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-[#737C89] hover:text-[#202B3C] focus:outline-none"
                title={showNew ? 'Hide password' : 'View password'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Field 2: Confirm Password (with eye toggle) */}
          <div>
            <label className="text-xs font-bold text-[#202B3C] block mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#737C89] absolute left-3 top-3" />
              <input
                required
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 bg-[#FCFAF7] border border-[#DED8CF] rounded-md text-xs text-[#202B3C] placeholder-[#737C89] focus:outline-none focus:border-[#5276A5]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-[#737C89] hover:text-[#202B3C] focus:outline-none"
                title={showConfirm ? 'Hide password' : 'View password'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#23395D] hover:bg-[#192B47] text-white font-bold text-xs tracking-wide rounded-md shadow transition flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Setting New Password...' : 'Save & Set New Password'}</span>
            </button>
          </div>
        </form>

        <div className="px-6 py-3 bg-[#FCFAF7] border-t border-[#DED8CF] text-center text-[11px] text-[#737C89]">
          Password will be updated immediately for both web and mobile app.
        </div>
      </div>
    </div>
  );
};
