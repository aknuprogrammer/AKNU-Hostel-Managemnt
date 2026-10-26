import React from 'react';

export interface ButtonGroupOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface ButtonGroupProps<T extends string | number = string> {
  options: ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export function ButtonGroup<T extends string | number = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className = ''
}: ButtonGroupProps<T>) {
  const sizeClass = size === 'sm' ? 'py-1 px-2.5 text-xs' : 'py-2 px-3.5 text-xs font-bold';

  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 select-none ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      role="group"
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
              fullWidth ? 'flex-1' : ''
            } ${sizeClass} ${
              isSelected
                ? 'bg-white text-[#23395D] shadow-xs border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-[#23395D]/10 text-[#23395D]' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
