'use client';

import { useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  Radio,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { AirTagLocation } from '@/lib/api/airtags';

interface AirTagDetailDrawerProps {
  location: AirTagLocation;
  lastSyncAt: string | null;
  onClose: () => void;
}

function formatLastSeen(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getLastSeenColor(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 30) return '#10B981';
  if (minutes < 120) return '#F59E0B';
  return '#EF4444';
}

function getBatteryLabel(status: number): string {
  switch (status) {
    case 0: return 'Full';
    case 1: return 'Medium';
    case 2: return 'Low';
    case 3: return 'Critical';
    default: return 'Unknown';
  }
}

function getBatteryColor(status: number): string {
  switch (status) {
    case 0: return '#10B981';
    case 1: return '#3B82F6';
    case 2: return '#F59E0B';
    case 3: return '#EF4444';
    default: return '#9CA3AF';
  }
}

function BatteryIcon({ status, className }: { status: number; className?: string }) {
  const color = getBatteryColor(status);
  const props = { className, style: { color } };
  switch (status) {
    case 0: return <BatteryFull {...props} />;
    case 1: return <BatteryMedium {...props} />;
    case 2: return <BatteryLow {...props} />;
    case 3: return <BatteryWarning {...props} />;
    default: return <BatteryFull {...props} />;
  }
}

export function AirTagDetailDrawer({ location, lastSyncAt, onClose }: AirTagDetailDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const coords = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

  const handleCopyCoords = async () => {
    await navigator.clipboard.writeText(coords);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const lastSeenColor = getLastSeenColor(location.last_seen);
  const batteryColor = getBatteryColor(location.battery_status);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[440px] bg-white shadow-2xl z-50 overflow-hidden flex flex-col ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md shrink-0"
                style={{ backgroundColor: '#4880FF' }}
              >
                {location.bin_number}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{location.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lastSeenColor }} />
                  <span className="text-xs text-gray-500">{formatLastSeen(location.last_seen)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center gap-2">
            <div
              className="rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1.5"
              style={{ backgroundColor: lastSeenColor + '15', color: lastSeenColor }}
            >
              <Clock className="w-3 h-3" />
              {formatLastSeen(location.last_seen)}
            </div>
            <div
              className="rounded-full px-2.5 py-1 text-xs font-medium flex items-center gap-1.5"
              style={{ backgroundColor: batteryColor + '15', color: batteryColor }}
            >
              <BatteryIcon status={location.battery_status} className="w-3 h-3" />
              {getBatteryLabel(location.battery_status)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Location */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Location</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{location.address}</p>
                  <p className="text-xs text-gray-500">{location.city}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-mono">{coords}</p>
                  <button
                    onClick={handleCopyCoords}
                    className="w-6 h-6 rounded-md hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
                    title="Copy coordinates"
                  >
                    {copiedCoords
                      ? <Check className="w-3 h-3 text-green-500" />
                      : <Copy className="w-3 h-3 text-gray-400" />
                    }
                  </button>
                </div>
              </div>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Google Maps
              </a>
            </div>
          </div>

          {/* Battery Status */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Battery</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: batteryColor + '15' }}
                >
                  <BatteryIcon status={location.battery_status} className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{getBatteryLabel(location.battery_status)}</p>
                  <p className="text-xs text-gray-500">
                    {location.battery_status === 0 && 'Battery is healthy'}
                    {location.battery_status === 1 && 'Battery is moderate'}
                    {location.battery_status === 2 && 'Consider replacing soon'}
                    {location.battery_status === 3 && 'Replace battery immediately'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Last Seen Details */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Timing</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Last seen</span>
                </div>
                <span className="text-xs font-medium text-gray-700">{formatTimestamp(location.last_seen)}</span>
              </div>
              {lastSyncAt && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Last synced from Apple</span>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{formatTimestamp(lastSyncAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* AirTag ID */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identifier</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tag ID</span>
                <span className="text-xs font-mono text-gray-600">{location.id.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
