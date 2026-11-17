import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, Trash2, X } from 'lucide-react';

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  isAlertOnly?: boolean;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  variant = 'danger',
  isAlertOnly = false,
  icon,
  isLoading = false
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm/ok button on open
    const timer = setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  // Colors & visual tokens by variant
  const variantConfig = {
    danger: {
      defaultIcon: <Trash2 className="w-5 h-5 text-red-600" />,
      iconBg: 'bg-red-50 border-red-200 text-red-600 ring-4 ring-red-50',
      confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-red-500',
      defaultConfirmText: 'Delete'
    },
    warning: {
      defaultIcon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      iconBg: 'bg-amber-50 border-amber-200 text-amber-600 ring-4 ring-amber-50',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm focus:ring-amber-500',
      defaultConfirmText: 'Proceed'
    },
    success: {
      defaultIcon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600 ring-4 ring-emerald-50',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus:ring-emerald-500',
      defaultConfirmText: 'OK'
    },
    info: {
      defaultIcon: <Info className="w-5 h-5 text-[#23395D]" />,
      iconBg: 'bg-blue-50 border-blue-200 text-[#23395D] ring-4 ring-blue-50',
      confirmBtn: 'bg-[#23395D] hover:bg-[#192B47] text-white shadow-sm focus:ring-blue-500',
      defaultConfirmText: 'OK'
    }
  }[variant];

  const effectiveConfirmText = confirmText || (isAlertOnly ? 'Understood' : variantConfig.defaultConfirmText);
  const activeIcon = icon || variantConfig.defaultIcon;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      {/* Frosted Glass Dark Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={() => {
          if (!isLoading) onCancel();
        }}
      />

      {/* Modal Dialog Card */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          role="dialog"
          aria-modal="true"
          className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200 animate-in zoom-in-95 duration-150"
        >
          {/* Header Close Button (optional helper) */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="absolute top-3.5 right-3.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition focus:outline-none"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {/* Variant Icon Pill */}
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border ${variantConfig.iconBg}`}>
                {activeIcon}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-base font-bold text-slate-900 leading-6">
                  {title}
                </h3>
                <div className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {message}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-slate-50/80 px-4 py-3 sm:px-6 flex flex-row-reverse gap-2 border-t border-slate-100">
            <button
              ref={confirmBtnRef}
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`inline-flex justify-center items-center rounded-md px-3.5 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantConfig.confirmBtn}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                effectiveConfirmText
              )}
            </button>

            {!isAlertOnly && (
              <button
                type="button"
                disabled={isLoading}
                onClick={onCancel}
                className="inline-flex justify-center items-center rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
