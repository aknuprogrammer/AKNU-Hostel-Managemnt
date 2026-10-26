import React from 'react';
import { Loader2 } from 'lucide-react';

export type IconButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'subtle';

export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: React.ReactNode;
  'aria-label'?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  tooltip?: string;
  rounded?: boolean;
}

const variantStyles: Record<IconButtonVariant, string> = {
  primary:
    'bg-[#23395D] hover:bg-[#192B47] text-white border border-[#192B47] shadow-2xs active:scale-95',
  secondary:
    'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs active:scale-95',
  accent:
    'bg-[#92582F] hover:bg-[#754522] text-white border border-[#754522] shadow-2xs active:scale-95',
  outline:
    'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs active:scale-95',
  danger:
    'bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 shadow-2xs active:scale-95',
  success:
    'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border border-emerald-200 shadow-2xs active:scale-95',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 border-transparent active:scale-95',
  subtle:
    'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200/80 active:scale-95'
};

const sizeStyles: Record<IconButtonSize, { btn: string; icon: string }> = {
  xs: { btn: 'p-1', icon: 'w-3.5 h-3.5' },
  sm: { btn: 'p-1.5', icon: 'w-4 h-4' },
  md: { btn: 'p-2', icon: 'w-4 h-4' },
  lg: { btn: 'p-2.5', icon: 'w-5 h-5' }
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'sm',
      isLoading = false,
      tooltip,
      rounded = false,
      disabled,
      className = '',
      type = 'button',
      title,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const { btn, icon: iconSize } = sizeStyles[size];
    const resolvedLabel = ariaLabel || tooltip || (title as string) || 'action';
    const resolvedTitle = tooltip || title || ariaLabel;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={resolvedLabel}
        title={resolvedTitle}
        className={`inline-flex items-center justify-center transition duration-150 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${
          rounded ? 'rounded-full' : 'rounded-md'
        } ${variantStyles[variant]} ${btn} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={`${iconSize} animate-spin shrink-0`} />
        ) : (
          <span className={`shrink-0 flex items-center justify-center [&>svg]:${iconSize}`}>
            {icon}
          </span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
