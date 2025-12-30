'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Route, AlertTriangle, CheckCircle2, Send, TrendingUp, ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface AISuggestion {
  id: string;
  type: 'critical' | 'optimization' | 'success';
  title: string;
  description: string;
  timestamp: string;
  confidence?: number;
  impact?: string;
  actions?: Array<{
    label: string;
    primary?: boolean;
    onClick: () => void;
  }>;
}

export function AIAssistantPanel() {
  const [suggestions] = useState<AISuggestion[]>([
    {
      id: '1',
      type: 'critical',
      title: '5 bins will reach 100% capacity in 3.2 hours',
      description: 'North Sector bins #45, #67, #89, #102, #134 need immediate attention',
      timestamp: '2 min ago',
      confidence: 94,
      impact: 'High Priority',
      actions: [
        {
          label: 'Schedule Pickup',
          primary: true,
          onClick: () => console.log('Schedule pickup'),
        },
        {
          label: 'View Bins',
          onClick: () => console.log('View bins'),
        },
      ],
    },
    {
      id: '2',
      type: 'optimization',
      title: 'Reroute Driver Ariel to save 12 miles',
      description: 'Smart-Path algorithm found a 22-minute faster route by swapping bins #45 and #67',
      timestamp: '15 min ago',
      confidence: 87,
      impact: 'Save $45 + 22 min',
      actions: [
        {
          label: 'Apply Route',
          primary: true,
          onClick: () => console.log('Apply route'),
        },
        {
          label: 'Preview',
          onClick: () => console.log('Preview route'),
        },
      ],
    },
    {
      id: '3',
      type: 'success',
      title: 'Morning routes completed 15% faster',
      description: 'Routes RT-001, RT-002, RT-003 finished ahead of schedule. Great job team!',
      timestamp: '1 hour ago',
    },
  ]);

  const getTypeStyles = (type: AISuggestion['type']) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-red-100/50',
          border: 'border-red-200',
          iconBg: 'bg-red-500',
          icon: <AlertTriangle className="w-4 h-4 text-white" />,
          badge: 'bg-red-100 text-red-700 border-red-200',
        };
      case 'optimization':
        return {
          bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
          border: 'border-blue-200',
          iconBg: 'bg-blue-500',
          icon: <Route className="w-4 h-4 text-white" />,
          badge: 'bg-blue-100 text-blue-700 border-blue-200',
        };
      case 'success':
        return {
          bg: 'bg-gradient-to-br from-green-50 to-green-100/50',
          border: 'border-green-200',
          iconBg: 'bg-green-500',
          icon: <CheckCircle2 className="w-4 h-4 text-white" />,
          badge: 'bg-green-100 text-green-700 border-green-200',
        };
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
        <Badge className="gap-1 bg-primary hover:bg-primary text-[10px] px-1.5 py-0.5">
          <Sparkles className="w-2.5 h-2.5" />
          Live
        </Badge>
      </div>

      {/* Suggestions - Compact */}
      <div className="p-3 space-y-2 max-h-[350px] overflow-y-auto">
        {suggestions.map((suggestion) => {
          const styles = getTypeStyles(suggestion.type);

          return (
            <Card
              key={suggestion.id}
              className={`${styles.bg} ${styles.border} border overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer`}
            >
              <div className="p-2.5">
                <div className="flex gap-2">
                  {/* Icon */}
                  <div className={`${styles.iconBg} rounded-lg p-1.5 h-fit`}>
                    {styles.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1.5">
                    {/* Title & Confidence */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-gray-900 leading-tight text-xs">
                        {suggestion.title}
                      </h4>
                      {suggestion.confidence && (
                        <Badge
                          variant="outline"
                          className={`${styles.badge} text-[10px] font-semibold shrink-0 px-1 py-0`}
                        >
                          {suggestion.confidence}%
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-600 leading-snug line-clamp-2">
                      {suggestion.description}
                    </p>

                    {/* Impact & Timestamp */}
                    <div className="flex items-center justify-between text-[10px]">
                      {suggestion.impact && (
                        <div className="flex items-center gap-1 text-gray-600 font-medium">
                          <TrendingUp className="w-3 h-3" />
                          {suggestion.impact}
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 text-gray-500 ml-auto">
                        <Clock className="w-2.5 h-2.5" />
                        {suggestion.timestamp}
                      </div>
                    </div>

                    {/* Actions */}
                    {suggestion.actions && suggestion.actions.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {suggestion.actions.map((action, index) => (
                          <Button
                            key={index}
                            size="sm"
                            variant={action.primary ? 'default' : 'outline'}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick();
                            }}
                            className={`text-[10px] h-6 px-2 ${
                              action.primary
                                ? 'bg-primary hover:bg-primary/90'
                                : 'bg-white hover:bg-gray-50'
                            } transition-all duration-200`}
                          >
                            {action.label}
                            {action.primary && <ArrowRight className="w-2.5 h-2.5 ml-0.5" />}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ask AI Input - Footer */}
      <div className="p-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 hover:border-primary/30 transition-all duration-200">
          <Sparkles className="w-3 h-3 text-primary" />
          <input
            type="text"
            placeholder="Ask AI..."
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
