'use client';

import { BinCheck } from '@/lib/types/bin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Calendar, MapPin, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CheckDetailModalProps {
  check: BinCheck | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CheckDetailModal({ check, isOpen, onClose }: CheckDetailModalProps) {
  if (!check) return null;

  // Calculate fill percentage change
  const fillChange =
    check.fillPercentage != null && check.previousFillPercentage != null
      ? check.fillPercentage - check.previousFillPercentage
      : null;

  // Get fill change icon and color
  const getFillChangeDisplay = () => {
    if (fillChange === null || fillChange === 0) {
      return {
        icon: <Minus className="h-4 w-4" />,
        color: 'text-gray-500',
        text: 'No change',
      };
    } else if (fillChange > 0) {
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-red-600',
        text: `+${fillChange}%`,
      };
    } else {
      return {
        icon: <TrendingDown className="h-4 w-4" />,
        color: 'text-green-600',
        text: `${fillChange}%`,
      };
    }
  };

  const fillChangeDisplay = getFillChangeDisplay();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Photo Section */}
          {check.photoUrl && (
            <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
              <img
                src={check.photoUrl}
                alt="Bin check photo"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Fill Percentage Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-3">Fill Level</p>
            <div className="flex items-center justify-between">
              <div>
                {check.previousFillPercentage != null ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">Previous:</span>
                      <span className="text-2xl font-semibold text-gray-400">
                        {check.previousFillPercentage}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 font-medium">Current:</span>
                      <span className="text-4xl font-bold text-primary">
                        {check.fillPercentage ?? 'N/A'}
                        {check.fillPercentage != null && '%'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-4xl font-bold text-primary">
                    {check.fillPercentage ?? 'N/A'}
                    {check.fillPercentage != null && '%'}
                  </span>
                )}
              </div>
              {fillChange !== null && fillChange !== 0 && (
                <div className={`flex items-center gap-2 ${fillChangeDisplay.color} bg-white px-4 py-3 rounded-lg shadow-sm`}>
                  {fillChangeDisplay.icon}
                  <span className="text-xl font-bold">{fillChangeDisplay.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Info */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Checked By</p>
                <p className="text-sm font-semibold text-gray-900">
                  {check.checkedByName || 'Unknown'}
                </p>
                {check.shiftId && (
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Shift {check.shiftId.slice(0, 8)}
                    </Badge>
                    {check.shiftStatus && (
                      <Badge
                        variant={check.shiftStatus === 'active' ? 'default' : 'secondary'}
                        className="text-xs capitalize"
                      >
                        {check.shiftStatus}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date/Time */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Date & Time</p>
                <p className="text-sm font-semibold text-gray-900">{check.checkedOn}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(check.checkedOnIso).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg md:col-span-2">
              <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Location</p>
                <p className="text-sm font-semibold text-gray-900">{check.checkedFrom}</p>
              </div>
            </div>

            {/* Move Request Link (if applicable) */}
            {check.moveRequestId && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg md:col-span-2">
                <Package className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Part of Move Request</p>
                  <p className="text-sm font-semibold text-amber-900">
                    ID: {check.moveRequestId.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This check was performed as part of a bin relocation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
