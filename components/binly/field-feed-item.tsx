'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface FieldFeedItemProps {
  title: string;
  description?: string;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function FieldFeedItem({
  title,
  description,
  onClick,
  icon,
  className,
}: FieldFeedItemProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 hover:bg-gray-hover-bg cursor-pointer transition-colors border-b border-gray-100 last:border-b-0',
        className
      )}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {icon && (
          <div className="flex-shrink-0 mt-0.5">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">{title}</p>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
