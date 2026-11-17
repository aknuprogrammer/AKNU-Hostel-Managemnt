import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = 'bg-[#23395D]/5 border-[#23395D]/10',
  iconColor = 'text-[#23395D]',
  badge,
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">
              {title}
            </span>
            {badge}
          </div>
          <span className="text-2xl sm:text-3xl font-black text-[#23395D] mt-1 block tracking-tight">
            {value}
          </span>
          {subtitle && (
            <div className="mt-1.5 text-[11px] font-semibold truncate">
              {subtitle}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
