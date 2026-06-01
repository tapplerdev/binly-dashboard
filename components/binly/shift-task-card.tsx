'use client';

import { useState } from 'react';
import { MapPin, Package, ArrowRightLeft, Warehouse, Wrench, Check, SkipForward, Circle, ChevronDown } from 'lucide-react';

interface TaskCardProps {
  task: {
    id?: string;
    task_type: string;
    bin_number?: number | null;
    address?: string | null;
    is_completed: number;
    skipped?: boolean;
    fill_percentage?: number | null;
    sequence_order: number;
    task_label?: string | null;
    destination_address?: string | null;
    completed_at?: number | null;
  };
  isCurrentTask?: boolean;
}

const TASK_ICONS: Record<string, { icon: typeof MapPin; color: string; bg: string; label: string }> = {
  collection:     { icon: MapPin,           color: 'text-blue-600',   bg: 'bg-blue-50',    label: 'Collection' },
  placement:      { icon: Package,          color: 'text-orange-600', bg: 'bg-orange-50',  label: 'Placement' },
  pickup:         { icon: ArrowRightLeft,   color: 'text-purple-600', bg: 'bg-purple-50',  label: 'Move Pickup' },
  dropoff:        { icon: ArrowRightLeft,   color: 'text-purple-600', bg: 'bg-purple-50',  label: 'Move Dropoff' },
  warehouse_stop: { icon: Warehouse,        color: 'text-gray-600',   bg: 'bg-gray-100',   label: 'Warehouse' },
  service:        { icon: Wrench,           color: 'text-green-600',  bg: 'bg-green-50',   label: 'Service' },
};

export function ShiftTaskCard({ task, isCurrentTask = false }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDone = task.is_completed === 1 && !task.skipped;
  const isSkipped = task.skipped;
  const iconConfig = TASK_ICONS[task.task_type] || TASK_ICONS.collection;
  const Icon = iconConfig.icon;

  const fill = task.fill_percentage ?? 0;
  const fillTint = task.task_type === 'collection' && !isDone && !isSkipped
    ? fill >= 80 ? 'bg-red-50 border-red-200' : fill >= 50 ? 'bg-amber-50 border-amber-200' : ''
    : '';

  const label = task.task_type === 'warehouse_stop'
    ? 'Warehouse'
    : task.task_type === 'service'
      ? (task.task_label || 'Service Stop')
      : task.bin_number
        ? `Bin #${task.bin_number}`
        : task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1);

  const addr = task.address || '';
  const truncAddr = addr.length > 28 ? addr.slice(0, 26) + '…' : addr;

  return (
    <div
      className={`
        rounded-lg border transition-all cursor-pointer
        ${isCurrentTask ? 'bg-blue-50 border-blue-300 border-l-[3px] border-l-blue-500' : ''}
        ${isDone ? 'opacity-60 bg-white border-gray-100' : ''}
        ${isSkipped ? 'opacity-50 bg-white border-gray-100' : ''}
        ${!isDone && !isSkipped && !isCurrentTask ? `bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm ${fillTint}` : ''}
      `}
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
    >
      {/* Main row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconConfig.color}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${isDone || isSkipped ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {label}
          </div>
          {!expanded && truncAddr && (
            <div className={`text-xs truncate ${isDone || isSkipped ? 'text-gray-300' : 'text-gray-500'}`}>
              {truncAddr}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {isDone && <Check className="w-4 h-4 text-green-500" />}
          {isSkipped && <SkipForward className="w-4 h-4 text-orange-400" />}
          {isCurrentTask && <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />}
          {!isDone && !isSkipped && !isCurrentTask && <Circle className="w-3.5 h-3.5 text-gray-300" />}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded details */}
      <div
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: expanded ? '200px' : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-3 pb-2.5 border-t border-gray-100">
          <div className="pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-gray-400">Type</span>
              <p className="text-gray-700 font-medium">{iconConfig.label}</p>
            </div>
            <div>
              <span className="text-gray-400">Sequence</span>
              <p className="text-gray-700 font-medium">#{task.sequence_order}</p>
            </div>
            {addr && (
              <div className="col-span-2">
                <span className="text-gray-400">Address</span>
                <p className="text-gray-700">{addr}</p>
              </div>
            )}
            {task.task_type === 'collection' && fill > 0 && (
              <div>
                <span className="text-gray-400">Fill Level</span>
                <p className={`font-medium ${fill >= 80 ? 'text-red-600' : fill >= 50 ? 'text-amber-600' : 'text-gray-700'}`}>{fill}%</p>
              </div>
            )}
            {task.destination_address && (
              <div className="col-span-2">
                <span className="text-gray-400">Destination</span>
                <p className="text-gray-700">{task.destination_address}</p>
              </div>
            )}
            {isDone && task.completed_at && (
              <div>
                <span className="text-gray-400">Completed</span>
                <p className="text-gray-700">{new Date(task.completed_at * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
