'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface IntelligenceCardProps {
  title: string;
  description: string;
  timestamp?: string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function IntelligenceCard({
  title,
  description,
  timestamp,
  icon,
  onClick,
  className,
}: IntelligenceCardProps) {
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer hover:card-shadow-hover hover:border-primary/20 border border-transparent transition-all',
        className
      )}
      onClick={onClick}
    >
      <div className="flex gap-3">
        {icon && (
          <div className="flex-shrink-0 mt-1">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          {timestamp && (
            <p className="text-xs text-gray-400 mt-2">{timestamp}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
