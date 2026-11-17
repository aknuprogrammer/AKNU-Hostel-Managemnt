import React from 'react';
import { Plus, Minus } from 'lucide-react';

export interface NumberInputProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  placeholder,
  helperText,
  error,
  disabled = false,
  required = false,
  className = ''
}) => {
  const numVal = typeof value === 'number' ? value : parseInt(value, 10) || min;

  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, numVal - step);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = Math.min(max, numVal + step);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(min);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1 tracking-wide">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="flex items-center rounded-md border border-slate-300 bg-white overflow-hidden focus-within:border-[#92582F] focus-within:ring-2 focus-within:ring-[#92582F]/20">
        <button
          type="button"
          disabled={disabled || numVal <= min}
          onClick={handleDecrement}
          className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition border-r border-slate-200"
          title="Decrease"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="w-full text-center text-xs font-mono font-bold text-slate-800 py-2 focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <button
          type="button"
          disabled={disabled || numVal >= max}
          onClick={handleIncrement}
          className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 transition border-l border-slate-200"
          title="Increase"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};
