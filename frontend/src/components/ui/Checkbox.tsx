import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  label?: React.ReactNode;
  description?: string;
  indeterminate?: boolean;
  error?: string;
  size?: 'sm' | 'md';
  onChange?: (checkedOrEvent: any) => void;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      indeterminate = false,
      error,
      size = 'md',
      checked,
      disabled,
      className = '',
      id,
      onChange,
      onCheckedChange,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const boxSize = size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5';
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

    return (
      <div className={`flex flex-col ${className}`}>
        <label
          htmlFor={checkboxId}
          className={`inline-flex items-start gap-2.5 select-none ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              ref={inputRef}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              className="sr-only peer"
              onChange={(e) => {
                if (onCheckedChange) onCheckedChange(e.target.checked);
                if (onChange) onChange(e.target.checked);
              }}
              {...props}
            />

            <div
              className={`${boxSize} rounded border transition-all duration-150 flex items-center justify-center ${
                error
                  ? 'border-rose-400 bg-rose-50/50'
                  : 'border-slate-300 bg-white hover:border-[#92582F]'
              } peer-focus-visible:ring-2 peer-focus-visible:ring-[#92582F]/30 peer-checked:bg-[#92582F] peer-checked:border-[#92582F] peer-checked:text-white ${
                indeterminate ? '!bg-[#92582F] !border-[#92582F] text-white' : ''
              }`}
            >
              {indeterminate ? (
                <Minus className={`${iconSize} stroke-[3]`} />
              ) : (
                <Check
                  className={`${iconSize} stroke-[3] transition-transform ${
                    checked ? 'scale-100' : 'scale-0'
                  }`}
                />
              )}
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

        {error && <span className="text-[11px] text-rose-600 mt-1">{error}</span>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
