import React, { useState, useRef, useEffect, useId } from 'react';
import { Search, Plus, Check, ChevronDown, Loader2, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface SearchableCreatableSelectProps {
  label?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  onCreateOption?: (query: string) => Promise<{ value: string; label: string } | null | void> | { value: string; label: string } | null | void;
  placeholder?: string;
  searchPlaceholder?: string;
  createPromptPrefix?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  id?: string;
}

export const SearchableCreatableSelect: React.FC<SearchableCreatableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  onCreateOption,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Type to search or add new...',
  createPromptPrefix = 'Create',
  error,
  helperText,
  required,
  disabled,
  className = '',
  containerClassName = '',
  id
}) => {
  const generatedId = useId();
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : generatedId);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Filter options based on search query
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = options.filter((opt) => {
    if (!trimmedQuery) return true;
    return (
      opt.label.toLowerCase().includes(trimmedQuery) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(trimmedQuery)) ||
      (opt.badge && opt.badge.toLowerCase().includes(trimmedQuery)) ||
      opt.value.toLowerCase().includes(trimmedQuery)
    );
  });

  // Only allow creation when search query is not empty and no matching option is present
  const isSearchedValuePresent = filteredOptions.length > 0;
  const canCreate = Boolean(onCreateOption && searchQuery.trim() && !isSearchedValuePresent);

  // Handle creating a new option
  const handleCreate = async () => {
    if (!onCreateOption || !searchQuery.trim() || isCreating) return;
    const queryToCreate = searchQuery.trim();
    setIsCreating(true);
    try {
      const created = await onCreateOption(queryToCreate);
      if (created && created.value) {
        onChange(created.value);
      }
      setIsOpen(false);
      setSearchQuery('');
    } catch (err: any) {
      console.error('Failed to create dynamic option:', err);
      alert(err.message || 'Failed to add option');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle keyboard events inside the search box
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      e.stopPropagation();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (canCreate) {
        handleCreate();
      } else if (filteredOptions[highlightedIndex]) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-slate-700 mb-1 tracking-wide"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Select Trigger Box */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full bg-slate-50 border rounded-md text-xs text-left px-3 py-2.5 transition flex items-center justify-between focus:outline-none focus:bg-white focus:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/30'
            : isOpen
            ? 'border-[#92582F] ring-2 ring-[#92582F]/20 bg-white'
            : 'border-slate-300 hover:border-slate-400 focus:border-[#92582F] focus:ring-[#92582F]/20'
        } ${className}`}
      >
        <span className={`block truncate ${selectedOption ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ml-2 ${
            isOpen ? 'rotate-180 text-[#92582F]' : ''
          }`}
        />
      </button>

      {/* Error or Helper text */}
      {error ? (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
      ) : null}

      {/* Dynamic Searchable Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-64">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 bg-[#FCFAF7] sticky top-0 z-10 flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-[#E8EDF5] text-[#23395D] font-bold'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[9px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-semibold uppercase">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                          {opt.subLabel}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#23395D] shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      No matching options found for <span className="font-semibold text-slate-800">"{searchQuery.trim()}"</span>
                    </p>
                    {canCreate && (
                      <button
                        type="button"
                        disabled={isCreating}
                        onClick={handleCreate}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#23395D] hover:bg-[#1a2b47] active:scale-[0.99] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        {isCreating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-white" />
                        )}
                        <span>
                          {isCreating ? 'Creating and selecting...' : `${createPromptPrefix} "${searchQuery.trim()}"`}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No options available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
