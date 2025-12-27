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
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  iconBgColor = 'bg-gray-100',
  trend,
  onClick,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer hover:card-shadow-hover hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-bold text-gray-900">{value}</h2>
            {trend && (
              <span
                className={cn(
                  'text-sm font-semibold',
                  trend === 'up' ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>
        {icon && (
          <div
            className={cn(
              'p-3 rounded-xl flex items-center justify-center',
              iconBgColor
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
