import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { IconButton } from './IconButton.js';

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number | 'all';
  totalRecords: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number | 'all') => void;
  pageSizeOptions?: Array<number | 'all'>;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  pageSize,
  totalRecords,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 50, 100, 'all'],
  className = ''
}) => {
  const currentLimit = typeof pageSize === 'number' ? pageSize : 10;
  const startRecord = (currentPage - 1) * currentLimit + 1;
  const endRecord = Math.min(currentPage * currentLimit, totalRecords);

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-500 font-medium">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
            onPageSizeChange(val);
            onPageChange(1);
          }}
          className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs font-bold text-[#23395D] focus:border-[#92582F] focus:ring-1 focus:ring-[#92582F] transition cursor-pointer"
        >
          {pageSizeOptions.map((opt) => (
            <option key={String(opt)} value={opt}>
              {opt === 'all' ? 'All' : opt}
            </option>
          ))}
        </select>

        <span className="text-slate-300 mx-1">|</span>

        <span className="text-slate-600">
          {totalRecords === 0 ? (
            '0 records'
          ) : pageSize === 'all' ? (
            <span>
              Showing all <strong className="text-slate-800">{totalRecords}</strong> records
            </span>
          ) : (
            <span>
              Showing <strong className="text-slate-800">{startRecord}</strong> to{' '}
              <strong className="text-slate-800">{endRecord}</strong> of{' '}
              <strong className="text-slate-800">{totalRecords}</strong> records
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton
          icon={<ChevronsLeft className="w-4 h-4" />}
          size="xs"
          variant="outline"
          disabled={currentPage <= 1 || pageSize === 'all'}
          onClick={() => onPageChange(1)}
          title="First Page"
        />
        <IconButton
          icon={<ChevronLeft className="w-4 h-4" />}
          size="xs"
          variant="outline"
          disabled={currentPage <= 1 || pageSize === 'all'}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          title="Previous Page"
        />

        <span className="px-2.5 py-1 font-semibold text-slate-700 text-xs">
          Page {pageSize === 'all' ? 1 : currentPage} of {pageSize === 'all' ? 1 : Math.max(1, totalPages)}
        </span>

        <IconButton
          icon={<ChevronRight className="w-4 h-4" />}
          size="xs"
          variant="outline"
          disabled={currentPage >= totalPages || pageSize === 'all'}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          title="Next Page"
        />
        <IconButton
          icon={<ChevronsRight className="w-4 h-4" />}
          size="xs"
          variant="outline"
          disabled={currentPage >= totalPages || pageSize === 'all'}
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
        />
      </div>
    </div>
  );
};
