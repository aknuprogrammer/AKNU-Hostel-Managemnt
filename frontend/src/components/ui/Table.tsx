import React from 'react';
import { Loader2, Inbox } from 'lucide-react';

/* =========================================================================
   1. TABLE PRIMITIVES
   ========================================================================= */

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

export const Table: React.FC<TableProps> = ({
  children,
  containerClassName = '',
  className = '',
  ...props
}) => (
  <div
    className={`bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden ${containerClassName}`}
  >
    <div className="overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <table className={`w-full text-left text-xs ${className}`} {...props}>
        {children}
      </table>
    </div>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <thead
    className={`bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 select-none ${className}`}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tbody className={`divide-y divide-slate-100 ${className}`} {...props}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isClickable?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  isClickable = false,
  className = '',
  ...props
}) => (
  <tr
    className={`transition ${isClickable ? 'cursor-pointer hover:bg-slate-50/80 active:bg-slate-100/70' : 'hover:bg-slate-50/60'
      } ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  align = 'left',
  className = '',
  ...props
}) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3.5 font-bold ${alignClass} ${className}`} {...props}>
      {children}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  align = 'left',
  className = '',
  ...props
}) => {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`px-4 py-3.5 text-slate-700 ${alignClass} ${className}`} {...props}>
      {children}
    </td>
  );
};

export const TableLoading: React.FC<{ colSpan: number; message?: string }> = ({
  colSpan,
  message = 'Loading records...'
}) => (
  <tr>
    <td colSpan={colSpan} className="text-center py-12 text-slate-500">
      <div className="flex flex-col items-center justify-center space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#92582F]" />
        <span className="text-xs font-semibold">{message}</span>
      </div>
    </td>
  </tr>
);

export const TableEmpty: React.FC<{ colSpan: number; message?: string; icon?: React.ReactNode }> = ({
  colSpan,
  message = 'No matching records found.',
  icon
}) => (
  <tr>
    <td colSpan={colSpan} className="text-center py-12 text-slate-400">
      <div className="flex flex-col items-center justify-center space-y-2">
        {icon || <Inbox className="w-7 h-7 text-slate-300 stroke-[1.5]" />}
        <span className="text-xs font-medium text-slate-500">{message}</span>
      </div>
    </td>
  </tr>
);

/* =========================================================================
   2. HIGH-LEVEL GENERIC DATA TABLE
   ========================================================================= */

export interface ColumnDef<T> {
  header: React.ReactNode;
  accessor?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headClassName?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  containerClassName?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No matching records found.',
  keyExtractor,
  onRowClick,
  containerClassName = '',
  className = ''
}: DataTableProps<T>): React.ReactElement {
  return (
    <Table containerClassName={containerClassName} className={className}>
      <TableHeader>
        <tr>
          {columns.map((col, idx) => (
            <TableHead
              key={idx}
              align={col.align}
              className={`${col.headClassName || ''} ${col.className || ''}`}
            >
              {col.header}
            </TableHead>
          ))}
        </tr>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableLoading colSpan={columns.length} />
        ) : data.length === 0 ? (
          <TableEmpty colSpan={columns.length} message={emptyMessage} />
        ) : (
          data.map((item, rowIdx) => (
            <TableRow
              key={keyExtractor(item, rowIdx)}
              isClickable={!!onRowClick}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col, colIdx) => {
                const cellContent = col.render
                  ? col.render(item, rowIdx)
                  : col.accessor
                    ? String(item[col.accessor] ?? '')
                    : null;

                return (
                  <TableCell
                    key={colIdx}
                    align={col.align}
                    className={col.className}
                  >
                    {cellContent}
                  </TableCell>
                );
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
