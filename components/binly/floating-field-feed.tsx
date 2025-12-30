'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Camera, MapPin, TrendingUp } from 'lucide-react';

interface FieldFeedItemProps {
  icon: React.ReactNode;
  title: string;
  timestamp?: string;
  onClick?: () => void;
}

function FieldFeedItem({ icon, title, timestamp, onClick }: FieldFeedItemProps) {
  return (
    <div
      className="flex items-start gap-3 p-3 hover:bg-white/50 rounded-lg transition-all duration-200 cursor-pointer group"
      onClick={onClick}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 leading-tight group-hover:text-primary transition-colors">
          {title}
        </p>
        {timestamp && (
          <p className="text-xs text-gray-500 mt-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

export function FloatingFieldFeed() {
  const [isExpanded, setIsExpanded] = useState(true);

  const feedItems = [
    {
      icon: <Camera className="w-4 h-4 text-red-500" />,
      title: 'Driver Omar uploaded a photo of Bin #202 (Vandalized)',
      timestamp: 'Just now',
    },
    {
      icon: <MapPin className="w-4 h-4 text-blue-500" />,
      title: 'Landlord at Plaza Mall requested a bin relocation',
      timestamp: '5 min ago',
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-green-500" />,
      title: 'Scalemaster confirmed 450kg for Route 4',
      timestamp: '12 min ago',
    },
  ];

  return (
    <div className="absolute bottom-6 left-6 w-[380px] z-20">
      <Card className="bg-white/95 backdrop-blur-md border border-gray-200/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between p-3 bg-white/80 border-b border-gray-200/50 cursor-pointer hover:bg-white transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-sm font-semibold text-gray-900">Field Friction Feed</h3>
          <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronUp className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Feed Items */}
        {isExpanded && (
          <div className="divide-y divide-gray-100/50">
            {feedItems.map((item, index) => (
              <FieldFeedItem
                key={index}
                icon={item.icon}
                title={item.title}
                timestamp={item.timestamp}
                onClick={() => console.log('Open field report')}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {isExpanded && (
          <div className="p-3 bg-gradient-to-r from-gray-50/80 to-white/80 border-t border-gray-200/50">
            <button className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
              View all activity →
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
