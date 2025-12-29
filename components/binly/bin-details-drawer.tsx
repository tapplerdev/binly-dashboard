'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Bin, getFillLevelCategory } from '@/lib/types/bin';
import { X, MapPin, Calendar, ChevronDown, User, Truck, Clock, Camera } from 'lucide-react';

interface BinDetailsDrawerProps {
  bin: Bin;
  onClose: () => void;
}

interface CollectionRecord {
  id: string;
  date: string;
  weight: number;
  driverName: string;
  driverPhoto?: string;
  routeNumber: string;
  truckId: string;
  timestamp: string;
  beforePhoto?: string;
  afterPhoto?: string;
  notes?: string;
}

export function BinDetailsDrawer({ bin, onClose }: BinDetailsDrawerProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const fillPercentage = bin.fill_percentage ?? 0;
  const fillCategory = getFillLevelCategory(fillPercentage);
  const isHighPriority = fillPercentage >= 80;

  // Format collection history dates
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get fill level color
  const getFillColor = () => {
    if (fillPercentage >= 80) return 'bg-red-600';
    if (fillPercentage >= 50) return 'bg-orange-600';
    if (fillPercentage >= 25) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  // Mock collection history with full details (replace with real data from API later)
  const collectionHistory: CollectionRecord[] = [
    {
      id: '1',
      date: '2024-10-26T14:30:00Z',
      weight: 140,
      driverName: 'Omar Gabr',
      routeNumber: 'Route 4',
      truckId: 'TRK-042',
      timestamp: '2024-10-26T14:30:00Z',
      beforePhoto: '/placeholder-bin-before.jpg',
      afterPhoto: '/placeholder-bin-after.jpg',
      notes: 'Regular collection, no issues',
    },
    {
      id: '2',
      date: '2024-10-19T09:15:00Z',
      weight: 135,
      driverName: 'Ariel Santos',
      routeNumber: 'Route 2',
      truckId: 'TRK-023',
      timestamp: '2024-10-19T09:15:00Z',
      notes: 'Bin was slightly overfilled',
    },
    {
      id: '3',
      date: '2024-10-12T16:45:00Z',
      weight: 130,
      driverName: 'Maria Lopez',
      routeNumber: 'Route 4',
      truckId: 'TRK-042',
      timestamp: '2024-10-12T16:45:00Z',
    },
  ];

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Determine which records to show
  const visibleHistory = showAllHistory ? collectionHistory : collectionHistory.slice(0, 3);
  const hasMoreHistory = collectionHistory.length > 3;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-20 overflow-hidden flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Bin Details: #{bin.bin_number}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Location */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Location:
              </h3>
              <p className="text-sm text-gray-700">
                {bin.location_name || `${bin.latitude}, ${bin.longitude}`}
              </p>
            </div>
          </div>
        </div>

        {/* Current Fill Level */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Current Fill:{' '}
            <span
              className={`${
                fillPercentage >= 80
                  ? 'text-red-600'
                  : fillPercentage >= 50
                  ? 'text-orange-600'
                  : 'text-gray-900'
              }`}
            >
              {fillPercentage}%{' '}
              {fillPercentage >= 80 && '(Critical)'}
            </span>
          </h3>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${getFillColor()} transition-all duration-300`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* Collection History */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Collection History
            </h3>
          </div>

          <div className="space-y-2">
            {visibleHistory.map((entry) => (
              <CollectionHistoryRow
                key={entry.id}
                entry={entry}
                isExpanded={expandedRow === entry.id}
                onToggle={() => toggleRow(entry.id)}
                formatDate={formatDate}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </div>

          {/* View Full History Link */}
          {hasMoreHistory && !showAllHistory && (
            <button
              onClick={() => setShowAllHistory(true)}
              className="w-full mt-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View Full History ({collectionHistory.length} total)
            </button>
          )}
          {showAllHistory && (
            <button
              onClick={() => setShowAllHistory(false)}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Show Less
            </button>
          )}
        </div>

        {/* Proof of Work Photos */}
        {bin.photo_url && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Proof of Work Photos
            </h3>
            <div className="rounded-lg overflow-hidden bg-gray-100">
              <img
                src={bin.photo_url}
                alt={`Bin #${bin.bin_number}`}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <button
          className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 uppercase tracking-wide ${
            isHighPriority
              ? 'bg-green-600 text-white shadow-sm hover:shadow-md hover:bg-green-700'
              : 'bg-white border-2 border-green-600 text-green-600 hover:bg-green-50'
          }`}
        >
          Move Request
        </button>
      </div>
    </div>
  );
}

// Collection History Row Component with Expand/Collapse
function CollectionHistoryRow({
  entry,
  isExpanded,
  onToggle,
  formatDate,
  formatTimestamp,
}: {
  entry: CollectionRecord;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (date: string) => string;
  formatTimestamp: (date: string) => string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden transition-all">
      {/* Clickable Row Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          <span className="text-sm text-gray-700">{formatDate(entry.date)}</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">{entry.weight}kg</span>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-100 border-t border-gray-200 space-y-3 animate-fade-in">
          {/* Driver Info */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Driver</p>
              <p className="text-sm font-medium text-gray-900">{entry.driverName}</p>
            </div>
          </div>

          {/* Route & Truck */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Route</p>
                <p className="text-sm font-medium text-gray-900">{entry.routeNumber}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Truck ID</p>
              <p className="text-sm font-medium text-gray-900">{entry.truckId}</p>
            </div>
          </div>

          {/* Exact Timestamp */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Collected At</p>
              <p className="text-sm font-medium text-gray-900">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-gray-500" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Proof of Work</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {entry.beforePhoto ? (
                <div className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      Before
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] text-gray-400">No Photo</span>
                </div>
              )}
              {entry.afterPhoto ? (
                <div className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity">
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      After
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1">
                  <Camera className="w-5 h-5 text-gray-400" />
                  <span className="text-[10px] text-gray-400">No Photo</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {entry.notes && (
            <div className="pt-2 border-t border-gray-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">Notes</p>
              <p className="text-sm text-gray-700 italic">{entry.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
