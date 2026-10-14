import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { StudentProfile } from '../types.js';
import { X, Printer, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../services/api.js';

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
    setRefreshing(true);
    setSuccessMsg('');
    try {
      const res = await apiRequest<{ success: boolean; message: string; data: { qrToken: string } }>(
        `/students/${student.id}/regenerate-qr`,
        { method: 'POST' }
      );
      if (res.success) {
        student.qr_credential_token = res.data.qrToken;
        setSuccessMsg('QR Credential regenerated! Old QR code is now revoked.');
        if (onQrUpdated) onQrUpdated();
      }
    } catch (e: any) {
      alert('Failed to regenerate QR: ' + e.message);
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
          <button onClick={onClose} className="p-1 hover:text-white rounded-md transition text-[#DCE5F1]">
            <X className="w-5 h-5" />
          </button>
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

            {/* Student Photo & QR Grid */}
            <div className="mt-4 flex flex-col items-center">
              <div className="relative">
                <img
                  src={student.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop'}
                  alt={student.full_name}
                  className="w-24 h-24 rounded-md object-cover border-2 border-aknu-navy shadow-md"
                />
                <span className="absolute -bottom-2 -right-1 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                  Active
                </span>
              </div>

              <div className="mt-3 text-center">
                <h4 className="text-base font-bold text-slate-900 leading-snug">{student.full_name}</h4>
                <div className="flex items-center justify-center gap-2 mt-0.5">
                  <span className="font-mono text-xs font-bold text-aknu-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {student.roll_number}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {student.reg_number}
                  </span>
                </div>
              </div>

              {/* Verified QR Code */}
              <div className="mt-4 p-3 bg-white border-2 border-slate-800/80 rounded-md shadow-inner flex flex-col items-center">
                <QRCodeSVG
                  value={student.qr_credential_token}
                  size={150}
                  level="H"
                  includeMargin={false}
                  fgColor="#0f2744"
                />
                <span className="mt-1.5 text-[9px] font-mono text-slate-400 tracking-widest uppercase">
                  Digital HMAC-SHA256 Token
                </span>
              </div>

              {/* Allocation Info Badges */}
              <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded-md border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-medium">Hostel</span>
                  <span className="font-bold text-slate-800 truncate block">
                    {student.hostel_name || 'Godavari Bhavan'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-md border border-slate-200">
                  <span className="text-[10px] text-slate-400 block font-medium">Room / Bed</span>
                  <span className="font-bold text-slate-800 block">
                    {student.room_number ? `Room ${student.room_number}` : 'Room 101'} • {student.bed_number || 'Bed 1'}
                  </span>
                </div>
              </div>

              {/* Mess Status */}
              <div className="w-full mt-2 bg-emerald-50 text-emerald-800 text-[11px] font-semibold py-1 px-3 rounded-md flex items-center justify-between border border-emerald-200">
                <span>Mess Dining Eligibility:</span>
                <span className="font-bold uppercase tracking-wider text-emerald-700">All Sessions Active</span>
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
          <button
            onClick={handleRegenerateQr}
            disabled={refreshing}
            className="flex items-center space-x-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition"
            title="Revokes previous QR and issues a fresh digital credential"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Revoking & Generating...' : 'Regenerate QR'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save ID</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
