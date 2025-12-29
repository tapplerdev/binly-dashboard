'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Route, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface AISuggestion {
  id: string;
  type: 'critical' | 'optimization' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
  timestamp: string;
  confidence?: number;
  actions?: Array<{
    label: string;
    variant?: 'default' | 'outline' | 'ghost';
    onClick: () => void;
  }>;
}

export function AIAssistantPanel() {
  const [suggestions] = useState<AISuggestion[]>([
    {
      id: '1',
      type: 'critical',
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      title: '5 bins will reach 100% capacity in 3.2 hours',
      description: 'North Sector bins #45, #67, #89, #102, #134 need immediate attention',
      timestamp: '2 min ago',
      confidence: 94,
      actions: [
        {
          label: 'Schedule Pickup',
          variant: 'default',
          onClick: () => console.log('Schedule pickup'),
        },
        {
          label: 'View Bins',
          variant: 'outline',
          onClick: () => console.log('View bins'),
        },
      ],
    },
    {
      id: '2',
      type: 'optimization',
      icon: <Route className="w-5 h-5 text-blue-500" />,
      title: 'Reroute Driver Ariel to save 12 miles',
      description: 'Smart-Path algorithm found a 22-minute faster route by swapping bins #45 and #67',
      timestamp: '15 min ago',
      confidence: 87,
      actions: [
        {
          label: 'Apply Route',
          variant: 'default',
          onClick: () => console.log('Apply route'),
        },
        {
          label: 'Preview',
          variant: 'outline',
          onClick: () => console.log('Preview route'),
        },
      ],
    },
    {
      id: '3',
      type: 'info',
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      title: 'Morning routes completed 15% faster',
      description: 'Routes RT-001, RT-002, RT-003 finished ahead of schedule. Great job team!',
      timestamp: '1 hour ago',
    },
  ]);

  const getTypeColor = (type: AISuggestion['type']) => {
    switch (type) {
      case 'critical':
        return 'border-l-red-500 bg-red-50';
      case 'optimization':
        return 'border-l-blue-500 bg-blue-50';
      case 'info':
        return 'border-l-green-500 bg-green-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">AI Assistant</h2>
        <Badge variant="default" className="gap-1">
          <Sparkles className="w-3 h-3" />
          Live
        </Badge>
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <Card
            key={suggestion.id}
            className={`p-4 border-l-4 ${getTypeColor(suggestion.type)} cursor-pointer hover:card-shadow-hover transition-card`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5">{suggestion.icon}</div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                      {suggestion.title}
                    </h3>
                    {suggestion.confidence && (
                      <Badge variant="outline" className="text-xs">
                        {suggestion.confidence}% confident
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {suggestion.description}
                  </p>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {suggestion.timestamp}
                </div>

                {/* Actions */}
                {suggestion.actions && suggestion.actions.length > 0 && (
                  <div className="flex items-center gap-2 pt-2">
                    {suggestion.actions.map((action, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant={action.variant || 'default'}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick();
                        }}
                        className="text-xs h-7"
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Ask AI Input (Future Enhancement) */}
      <Card className="p-3 bg-gray-50 border-dashed">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Sparkles className="w-4 h-4" />
          <span>Ask AI about routes, bins, or drivers...</span>
        </div>
      </Card>
    </div>
  );
}
