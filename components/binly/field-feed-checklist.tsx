'use client';

import { Camera, MapPin, TrendingUp } from 'lucide-react';

interface FeedItem {
  icon: React.ReactNode;
  title: string;
  timestamp: string;
  onClick?: () => void;
}

export function FieldFeedChecklist() {
  const items: FeedItem[] = [
    {
      icon: <Camera className="w-4 h-4 text-red-500" />,
      title: 'Photo of Bin #202 (Vandalized)',
      timestamp: 'Just now',
    },
    {
      icon: <MapPin className="w-4 h-4 text-blue-500" />,
      title: 'Plaza Mall bin relocation',
      timestamp: '5 min ago',
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-green-500" />,
      title: 'Route 4: 450kg confirmed',
      timestamp: '12 min ago',
    },
  ];

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
          onClick={item.onClick}
        >
          <div className="mt-0.5">{item.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-900 leading-tight group-hover:text-primary transition-colors">
              {item.title}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{item.timestamp}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
