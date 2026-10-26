import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const handleClear = () => {
      onChange('');
      if (onClear) onClear();
    };

    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-900 pl-9 pr-9 py-2.5 transition placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#92582F] focus:ring-2 focus:ring-[#92582F]/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
          {...props}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
