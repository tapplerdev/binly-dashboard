'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  iconBgColor?: string;
  trend?: 'up' | 'down';
  trendValue?: string;
  subtitle?: string;
  chart?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  iconBgColor = 'bg-gray-100',
  trend,
  trendValue,
  subtitle,
  chart,
  onClick,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 bg-white border-gray-200 rounded-lg',
        className
      )}
      onClick={onClick}
    >
      {/* Horizontal Layout */}
      <div className="flex items-start justify-between gap-3">
        {/* Left Side - Icon + Title + Value */}
        <div className="flex items-start gap-3 flex-1">
          {/* Icon */}
          {icon && (
            <div
              className={cn(
                'p-2 rounded-lg flex items-center justify-center shrink-0',
                iconBgColor
              )}
            >
              {icon}
            </div>
          )}

          {/* Title + Value stacked */}
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500 font-normal">{title}</p>
            <h2 className="text-2xl font-bold text-gray-900 leading-none">{value}</h2>
          </div>
        </div>

        {/* Right Side - Trend */}
        {trend && trendValue && (
          <span
            className={cn(
              'text-sm font-semibold inline-flex items-center gap-1',
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}
      </div>
    </Card>
  );
}
