import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'subtle'
  | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  isFullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#23395D] hover:bg-[#192B47] text-white border border-[#192B47] shadow-sm active:scale-[0.98]',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-2xs active:scale-[0.98]',
  accent:
    'bg-[#92582F] hover:bg-[#754522] text-white border border-[#754522] shadow-sm active:scale-[0.98]',
  outline:
    'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs active:scale-[0.98]',
  danger:
    'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-sm active:scale-[0.98]',
  success:
    'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-sm active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-transparent active:scale-[0.98]',
  subtle:
    'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs active:scale-[0.98]',
  link:
    'bg-transparent hover:underline text-[#92582F] hover:text-[#754522] border-transparent shadow-none !p-0 font-semibold'
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded gap-1.5',
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-xs font-semibold rounded-md gap-2',
  lg: 'px-5 py-2.5 text-sm font-bold rounded-lg gap-2.5'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      isFullWidth = false,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isBusy = isLoading || loading;
    const isExpanded = fullWidth || isFullWidth;
    const isDisabled = disabled || isBusy;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-medium transition duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${
          variantStyles[variant]
        } ${sizeStyles[size]} ${isExpanded ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {!isBusy && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children && <span className="inline-flex items-center gap-1.5 whitespace-nowrap">{children}</span>}
        {!isBusy && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
