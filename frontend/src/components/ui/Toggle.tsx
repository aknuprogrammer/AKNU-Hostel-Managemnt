import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  id
}) => {
  const toggleId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const switchSize = size === 'sm' ? 'w-8 h-4.5' : 'w-10 h-5.5';
  const knobSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const translateClass = size === 'sm' ? 'translate-x-3.5' : 'translate-x-4.5';

  return (
    <label
      htmlFor={toggleId}
      className={`inline-flex items-start gap-3 select-none ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${className}`}
    >
      <div className="relative inline-flex items-center mt-0.5">
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />

        <div
          className={`${switchSize} rounded-full transition-colors duration-200 ease-in-out ${
            checked ? 'bg-[#92582F]' : 'bg-slate-300'
          } peer-focus-visible:ring-2 peer-focus-visible:ring-[#92582F]/30 p-0.5`}
        >
          <div
            className={`${knobSize} rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
              checked ? translateClass : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      {(label || description) && (
        <div className="text-xs">
          {label && (
            <span className="font-semibold text-slate-800 block leading-tight">
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
};
