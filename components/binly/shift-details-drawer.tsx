'use client';

import { useState } from 'react';
import { X, MapPin, Clock, Package, Weight, TrendingUp, Check, Circle } from 'lucide-react';
import { Shift, getShiftStatusColor, getShiftStatusLabel } from '@/lib/types/shift';

interface ShiftDetailsDrawerProps {
  shift: Shift;
  onClose: () => void;
}

export function ShiftDetailsDrawer({ shift, onClose }: ShiftDetailsDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };
  const statusColor = getShiftStatusColor(shift.status);
  const statusLabel = getShiftStatusLabel(shift.status);
  const isActive = shift.status === 'active';
  const isCompleted = shift.status === 'completed';

  // Mock bin data for this shift
  const mockBins = [
    { id: '1', number: 1045, address: '123 Main St', collected: true, collectedAt: '08:15 AM', weight: 45 },
    { id: '2', number: 1046, address: '456 Oak Ave', collected: true, collectedAt: '08:32 AM', weight: 52 },
    { id: '3', number: 1047, address: '789 Pine Rd', collected: isActive, collectedAt: isActive ? '09:05 AM' : undefined, weight: isActive ? 48 : undefined },
    { id: '4', number: 1048, address: '321 Elm Dr', collected: false },
    { id: '5', number: 1049, address: '654 Maple Ln', collected: false },
  ];

  const collectedCount = mockBins.filter(b => b.collected).length;
  const progressPercentage = Math.round((collectedCount / mockBins.length) * 100);
  const totalWeight = mockBins.reduce((sum, b) => sum + (b.weight || 0), 0);

  return (
    <>
      {/* Overlay */}
      <div className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">Shift Details</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-green-600 text-white' : statusColor
              }`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{shift.startTime} - {shift.endTime}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{shift.route}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-fast"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Driver Info */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Driver</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                {shift.driverName.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className="font-medium text-gray-900">{shift.driverName}</p>
                {shift.truckId && (
                  <p className="text-sm text-gray-500">Truck #{shift.truckId}</p>
                )}
              </div>
            </div>
          </div>

          {/* Progress Metrics */}
          {(isActive || isCompleted) && (
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress</h3>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Collection Progress</span>
                  <span className="text-sm font-semibold text-primary">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Collected</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {collectedCount}/{mockBins.length}
                  </p>
                </div>

                {totalWeight > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Weight className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Total Weight</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{totalWeight} kg</p>
                  </div>
                )}

                {isActive && shift.estimatedCompletion && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Est. Complete</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(shift.estimatedCompletion).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {isCompleted && shift.duration && (
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Duration</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{shift.duration}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map Placeholder */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Route Map</h3>
            <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Map integration coming soon</p>
                <p className="text-xs text-gray-400 mt-1">Route: {shift.route}</p>
              </div>
            </div>
          </div>

          {/* Bin List */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Bins ({mockBins.length})</h3>
            <div className="space-y-2">
              {mockBins.map((bin, index) => (
                <div
                  key={bin.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-fast ${
                    bin.collected
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {bin.collected ? (
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                        <Circle className="w-3 h-3 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Bin Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-gray-900">Bin #{bin.number}</p>
                      {bin.collected && bin.collectedAt && (
                        <span className="text-xs text-green-600">@ {bin.collectedAt}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{bin.address}</p>
                  </div>

                  {/* Weight */}
                  {bin.weight && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{bin.weight} kg</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        {shift.status === 'scheduled' && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-3">
            <button className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-fast">
              Edit Shift
            </button>
            <button className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast">
              Cancel Shift
            </button>
          </div>
        )}

        {shift.status === 'active' && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-3">
            <button className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-fast">
              Contact Driver
            </button>
            <button className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-fast">
              Cancel Shift
            </button>
          </div>
        )}
      </div>
    </>
  );
}
