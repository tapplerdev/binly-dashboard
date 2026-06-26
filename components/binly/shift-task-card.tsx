'use client';

import { useState } from 'react';
import { MapPin, Package, ArrowRightLeft, Warehouse, Wrench, Check, SkipForward, Circle, Navigation, Image as ImageIcon } from 'lucide-react';

interface TaskCardProps {
  task: {
    id?: string;
    task_type: string;
    bin_number?: number | null;
    address?: string | null;
    is_completed: number;
    skipped?: boolean;
    fill_percentage?: number | null;
    updated_fill_percentage?: number | null;
    sequence_order: number;
    task_label?: string | null;
    destination_address?: string | null;
    completed_at?: number | null;
    photo_url?: string | null;
  };
  isCurrentTask?: boolean;
}

const TASK_ICONS: Record<string, { icon: typeof MapPin; color: string; bg: string }> = {
  collection:     { icon: MapPin,         color: 'text-blue-600',   bg: 'bg-blue-50' },
  placement:      { icon: Package,        color: 'text-orange-600', bg: 'bg-orange-50' },
  pickup:         { icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50' },
  dropoff:        { icon: ArrowRightLeft, color: 'text-purple-600', bg: 'bg-purple-50' },
  warehouse_stop: { icon: Warehouse,      color: 'text-gray-600',   bg: 'bg-gray-100' },
  service:        { icon: Wrench,         color: 'text-green-600',  bg: 'bg-green-50' },
};

export function ShiftTaskCard({ task, isCurrentTask = false }: TaskCardProps) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const isDone = task.is_completed === 1 && !task.skipped;
  const isSkipped = task.skipped;
  const iconConfig = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
  const Icon = iconConfig.icon;

  const displayFill = task.updated_fill_percentage ?? task.fill_percentage ?? 0;

  const label = task.task_type === 'warehouse_stop'
    ? 'Warehouse'
    : task.task_type === 'service'
      ? (task.task_label || 'Service Stop')
      : task.bin_number
        ? `Bin #${task.bin_number}`
        : task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1);

  const addr = task.address || '';
  const truncAddr = addr.length > 35 ? addr.slice(0, 33) + '…' : addr;

  const completedTime = isDone && task.completed_at
    ? new Date(task.completed_at * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  return (
    <>
      <div
        className={`flex items-center gap-2 p-2.5 rounded-lg border transition-fast ${
          isSkipped
            ? 'bg-yellow-50 border-l-4 border-yellow-500 opacity-75'
            : isDone
            ? 'bg-green-50 border-l-4 border-green-500 opacity-75'
            : isCurrentTask
            ? 'bg-blue-50 border-l-4 border-blue-600 ring-1 ring-blue-100'
            : 'bg-white border-l-4 border-gray-300 hover:bg-gray-50'
        }`}
      >
        {/* Task Type Icon */}
        <div className="flex-shrink-0">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconConfig.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${iconConfig.color}`} />
          </div>
        </div>

        {/* Status Icon */}
        <div className="flex-shrink-0">
          {isSkipped ? (
            <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <SkipForward className="w-3 h-3 text-white" />
            </div>
          ) : isDone ? (
            <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : isCurrentTask ? (
            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
              <Navigation className="w-3 h-3 text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
              <Circle className="w-2.5 h-2.5 text-gray-400" />
            </div>
          )}
        </div>

        {/* Task Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-xs font-medium truncate ${isDone || isSkipped ? 'text-gray-500' : isCurrentTask ? 'text-blue-900 font-semibold' : 'text-gray-800'}`}>
              {label}
            </p>
            {isCurrentTask && (
              <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-medium whitespace-nowrap">
                Active
              </span>
            )}
            {completedTime && !isSkipped && (
              <span className="text-[10px] text-green-600 whitespace-nowrap">{completedTime}</span>
            )}
          </div>
          <p className={`text-[11px] truncate ${isDone || isSkipped ? 'text-gray-400' : 'text-gray-500'}`}>
            {truncAddr}
          </p>
        </div>

        {/* Right side: fill % + photo */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {/* Fill % badge — hide on skipped tasks */}
          {task.task_type === 'collection' && displayFill > 0 && !isSkipped && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              displayFill >= 80 ? 'bg-red-100 text-red-700' :
              displayFill >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>
              {displayFill}%
            </span>
          )}

          {/* Photo thumbnail with hover overlay */}
          {isDone && task.photo_url && (
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(task.photo_url!); }}
              className="relative w-9 h-9 rounded-md overflow-hidden border border-gray-200 hover:border-blue-500 transition-colors group flex-shrink-0"
            >
              <img
                src={task.photo_url}
                alt="Collection"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen photo overlay */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(null); }}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <span className="text-white text-xl font-light">&#x2715;</span>
          </button>
          <img
            src={fullscreenPhoto}
            alt="Collection photo"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
