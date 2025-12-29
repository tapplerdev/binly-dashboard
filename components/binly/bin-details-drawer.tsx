'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Bin, getFillLevelCategory } from '@/lib/types/bin';
import { getBinChecks, BinCheck } from '@/lib/api/bins';
import { X, MapPin, Calendar, ChevronDown, User, Clock, Camera, Loader2 } from 'lucide-react';

interface BinDetailsDrawerProps {
  bin: Bin;
  onClose: () => void;
}

export function BinDetailsDrawer({ bin, onClose }: BinDetailsDrawerProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [checks, setChecks] = useState<BinCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const fillPercentage = bin.fill_percentage ?? 0;
  const fillCategory = getFillLevelCategory(fillPercentage);
  const isHighPriority = fillPercentage >= 80;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  // Fetch check history when drawer opens
  useEffect(() => {
    async function fetchCheckHistory() {
      try {
        setLoading(true);
        const checkData = await getBinChecks(bin.id);
        setChecks(checkData);
      } catch (error) {
        console.error('Failed to fetch check history:', error);
        setChecks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchCheckHistory();
  }, [bin.id]);

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

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Determine which records to show
  const visibleHistory = showAllHistory ? checks : checks.slice(0, 3);
  const hasMoreHistory = checks.length > 3;

  // Format full address from bin data
  const getFullAddress = () => {
    if (bin.location_name) {
      return bin.location_name;
    }
    // Construct from parts if available
    const parts = [bin.current_street, bin.city, bin.zip].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(', ');
    }
    // Fallback to coordinates
    return `${bin.latitude}, ${bin.longitude}`;
  };

  return (
    <div className={`absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-20 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Bin #{bin.bin_number}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Location - Compact */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">
                Location
              </p>
              <p className="text-sm text-gray-900 leading-snug">
                {getFullAddress()}
              </p>
            </div>
          </div>
        </div>

        {/* Current Fill Level - Compact */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Current Fill
            </h3>
            <span
              className={`text-lg font-bold ${
                fillPercentage >= 80
                  ? 'text-red-600'
                  : fillPercentage >= 50
                  ? 'text-orange-600'
                  : fillPercentage >= 25
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {fillPercentage}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${getFillColor()} transition-all duration-300`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>

        {/* Collection History */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Collection History
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : checks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No collection history available
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {visibleHistory.map((check) => (
                  <CollectionHistoryRow
                    key={check.id}
                    check={check}
                    isExpanded={expandedRow === check.id}
                    onToggle={() => toggleRow(check.id)}
                    formatDate={formatDate}
                    formatTimestamp={formatTimestamp}
                  />
                ))}
              </div>

              {/* View Full History Link */}
              {hasMoreHistory && !showAllHistory && (
                <button
                  onClick={() => setShowAllHistory(true)}
                  className="w-full mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  View Full History ({checks.length} total)
                </button>
              )}
              {showAllHistory && (
                <button
                  onClick={() => setShowAllHistory(false)}
                  className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  Show Less
                </button>
              )}
            </>
          )}
        </div>

        {/* Latest Photo Preview */}
        {bin.photo_url && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Latest Photo
              </h3>
            </div>
            <div className="rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
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
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          className={`w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            isHighPriority
              ? 'bg-green-600 text-white shadow-sm hover:shadow-md hover:bg-green-700'
              : 'bg-white border-2 border-green-600 text-green-600 hover:bg-green-50'
          }`}
        >
          Request Move
        </button>
      </div>
    </div>
  );
}

// Collection History Row Component with Expand/Collapse
function CollectionHistoryRow({
  check,
  isExpanded,
  onToggle,
  formatDate,
  formatTimestamp,
}: {
  check: BinCheck;
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
        className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          <span className="text-sm text-gray-700">{formatDate(check.checkedOnIso)}</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">
          {check.fillPercentage !== null ? `${check.fillPercentage}%` : 'N/A'}
        </span>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-2 bg-gray-50 border-t border-gray-200 space-y-2 animate-fade-in">
          {/* Driver/Checker Info */}
          {check.checkedByName && (
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Checked By</p>
                <p className="text-sm font-medium text-gray-900">{check.checkedByName}</p>
              </div>
            </div>
          )}

          {/* Location at time of check */}
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Location</p>
              <p className="text-sm font-medium text-gray-900 leading-snug">{check.checkedFrom}</p>
            </div>
          </div>

          {/* Exact Timestamp */}
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Timestamp</p>
              <p className="text-sm font-medium text-gray-900">
                {formatTimestamp(check.checkedOnIso)}
              </p>
            </div>
          </div>

          {/* Photo */}
          {check.photoUrl && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4 text-gray-500" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">Photo</p>
              </div>
              <div className="rounded-lg overflow-hidden bg-gray-200 border border-gray-300">
                <img
                  src={check.photoUrl}
                  alt="Check photo"
                  className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(check.photoUrl!, '_blank')}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
