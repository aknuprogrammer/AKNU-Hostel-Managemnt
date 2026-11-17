import React from 'react';

export interface RadioOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string | number = string> {
  name: string;
  label?: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  direction?: 'horizontal' | 'vertical';
  className?: string;
  error?: string;
}

export function RadioGroup<T extends string | number = string>({
  name,
  label,
  options,
  value,
  onChange,
  direction = 'vertical',
  className = '',
  error
}: RadioGroupProps<T>) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <span className="block text-xs font-bold text-slate-700 tracking-wide mb-1">
          {label}
        </span>
      )}

      <div
        className={`flex ${
          direction === 'horizontal' ? 'flex-wrap gap-4' : 'flex-col gap-2'
        }`}
      >
        {options.map((opt) => {
          const isChecked = opt.value === value;
          const optId = `${name}-${String(opt.value)}`;

          return (
            <label
              key={String(opt.value)}
              htmlFor={optId}
              className={`inline-flex items-start gap-2.5 select-none ${
                opt.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
              }`}
            >
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  id={optId}
                  name={name}
                  type="radio"
                  checked={isChecked}
                  disabled={opt.disabled}
                  onChange={() => onChange(opt.value)}
                  className="sr-only peer"
                />

                <div
                  className={`w-4 h-4 rounded-full border transition-all duration-150 flex items-center justify-center ${
                    isChecked
                      ? 'border-[#92582F] bg-white'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  } peer-focus-visible:ring-2 peer-focus-visible:ring-[#92582F]/30`}
                >
                  {isChecked && (
                    <div className="w-2 h-2 rounded-full bg-[#92582F]" />
                  )}
                </div>
              </div>

              <div className="text-xs">
                <span className="font-semibold text-slate-800 block leading-tight">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                    {opt.description}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
    </div>
  );
}
