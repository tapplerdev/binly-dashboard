'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Navigation,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Shift } from '@/lib/types/shift';

interface ActiveRoutesTableProps {
  shifts: Shift[];
  onTrackRoute?: (shiftId: string) => void;
  onCallDriver?: (shiftId: string) => void;
  onRerouteDriver?: (shiftId: string) => void;
}

export function ActiveRoutesTable({
  shifts,
  onTrackRoute,
  onCallDriver,
  onRerouteDriver,
}: ActiveRoutesTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filter to only show active shifts
  const activeShifts = shifts.filter((shift) => shift.status === 'active');

  // Calculate route status based on progress and time
  const getRouteStatus = (shift: Shift) => {
    if (!shift.binsCollected || !shift.binCount) {
      return { label: 'Starting', color: 'bg-blue-500', icon: '🔵' };
    }

    const progress = (shift.binsCollected / shift.binCount) * 100;
    const now = new Date();
    const estimatedEnd = shift.estimatedCompletion
      ? new Date(shift.estimatedCompletion)
      : null;

    // Check if delayed (for demo purposes, consider delayed if less than 50% complete after 2 hours)
    const shiftStart = new Date(shift.date + 'T' + shift.startTime);
    const hoursElapsed = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
    const expectedProgress = (hoursElapsed / parseFloat(shift.estimatedCompletion || '8')) * 100;

    if (progress < expectedProgress - 20) {
      return { label: 'Delayed', color: 'bg-red-500', icon: '🔴' };
    } else if (progress >= 90) {
      return { label: 'Finishing', color: 'bg-green-500', icon: '🟢' };
    } else if (progress >= 50) {
      return { label: 'On Track', color: 'bg-green-500', icon: '🟢' };
    } else {
      return { label: 'In Progress', color: 'bg-blue-500', icon: '🔵' };
    }
  };

  // Calculate ETA difference
  const getETAStatus = (shift: Shift) => {
    if (!shift.estimatedCompletion) return null;

    const eta = new Date(shift.estimatedCompletion);
    const now = new Date();
    const diffMinutes = Math.floor((eta.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes < 0) {
      return { text: `+${Math.abs(diffMinutes)}m`, color: 'text-red-600' };
    } else if (diffMinutes < 30) {
      return { text: `${diffMinutes}m`, color: 'text-green-600' };
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return { text: `${hours}h ${minutes}m`, color: 'text-gray-600' };
    }
  };

  if (activeShifts.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Routes</h2>
          <Badge variant="outline">0 active</Badge>
        </div>
        <p className="text-sm text-gray-500 text-center py-8">
          No active routes at the moment
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Active Routes</h2>
          <Badge variant="default" className="bg-green-600">
            {activeShifts.length} active
          </Badge>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Table */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ETA
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeShifts.map((shift) => {
                const status = getRouteStatus(shift);
                const eta = getETAStatus(shift);
                const progress = shift.binsCollected && shift.binCount
                  ? (shift.binsCollected / shift.binCount) * 100
                  : 0;

                return (
                  <tr
                    key={shift.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${status.color}`}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {status.label}
                        </span>
                      </div>
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {shift.driverPhoto ? (
                          <img
                            src={shift.driverPhoto}
                            alt={shift.driverName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold">
                            {shift.driverName.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {shift.driverName}
                        </span>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{shift.route}</span>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {shift.binsCollected || 0}/{shift.binCount}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({Math.round(progress)}%)
                          </span>
                        </div>
                        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${status.color} transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* ETA */}
                    <td className="px-4 py-3">
                      {eta ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className={`text-sm font-medium ${eta.color}`}>
                            {eta.text}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onTrackRoute?.(shift.id)}
                          title="Track on map"
                        >
                          <MapPin className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onCallDriver?.(shift.id)}
                          title="Call driver"
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onRerouteDriver?.(shift.id)}
                          title="Reroute"
                        >
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
