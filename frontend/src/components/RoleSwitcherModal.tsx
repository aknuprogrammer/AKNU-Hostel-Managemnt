import React from 'react';
import { useAuth, ROLE_PRESETS } from '../context/AuthContext.js';
import { UserRole } from '../types.js';
import { X, CheckCircle, ShieldCheck } from 'lucide-react';

interface RoleSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { user, quickSwitchRole, loading } = useAuth();

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

  if (!isOpen) return null;

  const handleSelectRole = async (roleKey: string) => {
    await quickSwitchRole(roleKey);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#151A22]/70 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
      onWheel={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full border border-[#DED8CF] overflow-hidden transform transition-all overscroll-contain">
        {/* Header */}
        <div className="px-6 py-4 bg-[#23395D] text-white flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#E0AD83]" />
            <div>
              <h3 className="font-bold text-base">Select University Role Persona</h3>
              <p className="text-xs text-[#DCE5F1]">
                Switch between active authorized university roles (Boys Wing, Girls Wing & Campus Admin)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#192B47] text-[#DCE5F1] hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roles Grid */}
        <div className="p-5 max-h-[75vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#FCFAF7]">
          {Object.keys(ROLE_PRESETS).map((roleKey) => {
            const roleInfo = ROLE_PRESETS[roleKey];
            if (!roleInfo) return null;
            const isCurrent = user?.email.toLowerCase() === roleInfo.email.toLowerCase();

            return (
              <button
                key={roleKey}
                disabled={loading}
                onClick={() => handleSelectRole(roleKey)}
                className={`p-3.5 rounded-md text-left border transition flex items-start space-x-3 ${
                  isCurrent
                    ? 'border-[#23395D] bg-[#E8EDF5] shadow-sm ring-2 ring-[#5276A5]/20'
                    : 'border-[#DED8CF] hover:border-[#92582F] hover:bg-white bg-white shadow-2xs'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                    roleInfo.category === 'boys'
                      ? 'bg-blue-100 text-blue-800'
                      : roleInfo.category === 'girls'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {roleInfo.category === 'boys' ? 'BW' : roleInfo.category === 'girls' ? 'GW' : 'ALL'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[#202B3C] truncate">{roleInfo.label}</h4>
                    {isCurrent && <CheckCircle className="w-4 h-4 text-[#23395D] flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                      roleInfo.category === 'boys'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : roleInfo.category === 'girls'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {roleInfo.category === 'boys' ? 'Boys Wing' : roleInfo.category === 'girls' ? 'Girls Wing' : 'Campus Admin'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5C6675] line-clamp-1 mt-1">{roleInfo.desc}</p>
                  <span className="text-[10px] text-[#737C89] block mt-1 font-mono truncate">{roleInfo.email}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#F1ECE5] border-t border-[#DED8CF] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#DED8CF] hover:bg-[#C8C0B5] text-[#202B3C] text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
