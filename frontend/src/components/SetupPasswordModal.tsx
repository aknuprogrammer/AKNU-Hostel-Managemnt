import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { apiRequest, setStoredToken } from '../services/api.js';
import { Modal, Input, Button, IconButton } from './ui/index.js';

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
    if (initialIdentifier) setIdentifier(initialIdentifier);
    if (initialTemporaryPassword) setTemporaryPassword(initialTemporaryPassword);
  }, [initialIdentifier, initialTemporaryPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setErrorMsg('Identifier (roll number or email) is required.');
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
      const payload: any = {
        identifier: identifier.trim(),
        newPassword
      };
      if (temporaryPassword.trim()) {
        payload.currentPassword = temporaryPassword.trim();
      }

      const res = await apiRequest('/auth/setup-password', {
        method: 'POST',
        body: JSON.stringify(payload)
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Setup New Password"
      description="Replace temporary password with your private credentials"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-medium block text-[11px]">Authorized Account</span>
            <span className="font-extrabold text-slate-800">{identifier || 'Current User'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Temp Password Verified</span>
          </div>
        </div>

        {/* Field 1: New Password (with eye toggle) */}
        <Input
          required
          type={showNew ? 'text' : 'password'}
          label="New Password"
          placeholder="Enter new password (min 6 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoFocus
          leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
          rightIcon={
            <IconButton
              icon={showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              size="xs"
              variant="ghost"
              onClick={() => setShowNew(!showNew)}
              title={showNew ? 'Hide password' : 'View password'}
            />
          }
        />

        {/* Field 2: Confirm Password (with eye toggle) */}
        <Input
          required
          type={showConfirm ? 'text' : 'password'}
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
          rightIcon={
            <IconButton
              icon={showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              size="xs"
              variant="ghost"
              onClick={() => setShowConfirm(!showConfirm)}
              title={showConfirm ? 'Hide password' : 'View password'}
            />
          }
        />

        {/* Submit Action */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isFullWidth
            loading={loading}
          >
            Save & Set New Password
          </Button>
        </div>

        <div className="pt-2 text-center text-[11px] text-slate-400">
          Password will be updated immediately for both web and mobile app.
        </div>
      </form>
    </Modal>
  );
};
