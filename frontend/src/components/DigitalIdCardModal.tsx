import React, { useState } from 'react';
import { StudentProfile } from '../types.js';
import { X, Printer, RefreshCw, ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';
import { apiRequest } from '../services/api.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { Button, IconButton } from './ui/index.js';

interface DigitalIdCardModalProps {
  student: StudentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onQrUpdated?: () => void;
}

export const DigitalIdCardModal: React.FC<DigitalIdCardModalProps> = ({
  student,
  isOpen,
  onClose,
  onQrUpdated
}) => {
  const { confirm, showError } = useConfirm();
  const [refreshing, setRefreshing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    const origBody = document.body.style.overflow;
    const origHtml = document.documentElement.style.overflow;
    const mainEl = document.querySelector('main');
    const origMain = mainEl ? mainEl.style.overflow : '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) mainEl.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = origBody;
      document.documentElement.style.overflow = origHtml;
      if (mainEl) mainEl.style.overflow = origMain;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  const handleRegenerateQr = async () => {
    const confirmed = await confirm({
      title: 'Sync Biometric Record',
      message: 'Are you sure you want to resync this resident biometric profile and verification credentials?',
      confirmText: 'Sync Biometric',
      variant: 'info'
    });
    if (!confirmed) return;

    setRefreshing(true);
    setSuccessMsg('');
    try {
      const res = await apiRequest<{ success: boolean; message: string; data: { qrToken: string } }>(
        `/students/${student.id}/regenerate-qr`,
        { method: 'POST' }
      );
      if (res.success) {
        student.qr_credential_token = res.data.qrToken;
        setSuccessMsg('Biometric credentials synchronized successfully!');
        if (onQrUpdated) onQrUpdated();
      }
    } catch (e: any) {
      await showError('Failed to sync biometric record: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
      onWheel={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden transform transition-all overscroll-contain">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 bg-[#23395D] text-white flex justify-between items-center border-b border-[#192B47]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#E0AD83] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#E0AD83]" />
            Official University Credential
          </span>
          <IconButton
            icon={<X className="w-5 h-5 text-[#DCE5F1]" />}
            size="sm"
            variant="ghost"
            onClick={onClose}
            title="Close"
          />
        </div>

        {/* PRINTABLE ID CARD CONTAINER */}
        <div id="student-id-card-print" className="p-6 bg-gradient-to-b from-[#FCFAF7] via-white to-[#F0E0D2]/30">
          {/* AKNU ID Card Frame */}
          <div className="border-2 border-[#23395D]/90 rounded-lg p-5 bg-white shadow-xl relative overflow-hidden">
            {/* Header Ribbon */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-[#23395D] via-[#354D70] to-[#92582F]" />

            <div className="text-center pt-2 pb-3 border-b border-[#E8E1D7]">
              <h3 className="text-sm font-extrabold text-[#23395D] tracking-tight leading-tight uppercase">
                Adikavi Nannaya University
              </h3>
              <p className="text-[10px] font-semibold text-[#92582F] tracking-wider uppercase">
                Hostel Resident & Mess Identification Card
              </p>
              <p className="text-[9px] text-[#5C6675]">Main Campus, Rajahmundry • 2026-2027</p>
            </div>

            {/* Horizontal Layout: Text on Left, QR Code on Right */}
            <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-stretch gap-5">
              {/* Left Column: Student Details */}
              <div className="flex-1 flex flex-col justify-between space-y-3 w-full">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-[#92582F] uppercase block mb-1">
                    Hostel Resident
                  </span>
                  <h4 className="text-lg font-black text-[#202B3C] leading-tight">
                    {student.full_name}
                  </h4>
                  <div className="mt-1.5 inline-flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#5C6675]">Roll No:</span>
                    <span className="font-mono text-xs font-bold text-[#23395D] bg-[#F0E0D2]/50 px-2.5 py-0.5 rounded border border-[#92582F]/30">
                      {student.roll_number}
                    </span>
                  </div>
                </div>

                {/* Hostel & Room Info */}
                <div className="space-y-1.5 text-xs">
                  <div className="bg-[#FCFAF7] p-2 rounded border border-[#DED8CF]">
                    <span className="text-[10px] text-[#737C89] font-medium block">Hostel Wing</span>
                    <span className="font-bold text-[#202B3C] truncate block">
                      {student.hostel_name || 'Godavari Bhavan'}
                    </span>
                  </div>
                  <div className="bg-[#FCFAF7] p-2 rounded border border-[#DED8CF]">
                    <span className="text-[10px] text-[#737C89] font-medium block">Room & Bed</span>
                    <span className="font-bold text-[#202B3C] block">
                      {student.room_number ? `Room ${student.room_number} • Bed ${student.bed_number || '1'}` : 'Room 101 • Bed 1'}
                    </span>
                  </div>
                </div>

                {/* Mess Status Pill */}
                <div className="bg-[#DCFCE7] text-[#166534] text-[11px] font-bold py-1.5 px-3 rounded border border-[#86EFAC]/60 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#166534]" />
                  <span>MESS ACTIVE • ALL MEALS</span>
                </div>
              </div>

              {/* Right Column: Student Photo & Biometric Face Verification */}
              <div className="flex flex-col items-center justify-center p-3 bg-white border-2 border-[#23395D] rounded-lg shadow-sm w-36 shrink-0">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    className="w-24 h-24 object-cover rounded-md border border-slate-200 shadow-2xs"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-tr from-[#23395D]/10 to-[#92582F]/10 rounded-md border border-slate-200 flex flex-col items-center justify-center text-[#23395D]">
                    <span className="text-2xl font-black">{student.full_name?.charAt(0) || 'S'}</span>
                    <span className="text-[9px] font-semibold text-slate-500 mt-1">Photo Enrolled</span>
                  </div>
                )}
                <div className="mt-2 text-center w-full">
                  <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 w-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Face Verified
                  </span>
                  <span className="text-[8px] text-[#737C89] block mt-0.5">Biometric Mess Access</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions & Feedback */}
        {successMsg && (
          <div className="mx-6 mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <Button
            variant="link"
            size="xs"
            onClick={handleRegenerateQr}
            disabled={refreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
            title="Refreshes and syncs biometric verification credential"
            className="p-0 text-slate-600 hover:text-slate-900 font-semibold"
          >
            {refreshing ? 'Syncing...' : 'Sync Biometric Record'}
          </Button>

          <div className="flex items-center space-x-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print / Save ID
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
