'use client';

import { useState } from 'react';
import {
  X,
  AlertTriangle,
  MapPin,
  Calendar,
  CheckCircle2,
  Eye,
  ShieldAlert,
  ExternalLink,
  User,
  Truck,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { useZoneIncidents } from '@/lib/hooks/use-zones';
import {
  NoGoZone,
  ZoneIncident,
  formatIncidentType,
  getIncidentIcon,
} from '@/lib/types/zone';

interface ZoneDetailsDrawerProps {
  zone: NoGoZone;
  onClose: () => void;
  onNavigateTo?: (zoneId: string) => void;
}

export function ZoneDetailsDrawer({ zone, onClose }: ZoneDetailsDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const { data: incidents = [], isLoading } = useZoneIncidents(zone.id);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  // Since zones are now 1:1 with incidents, grab the single incident
  const incident = incidents[0] ?? null;

  const createdAt = new Date(zone.created_at_iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const createdTime = new Date(zone.created_at_iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const resolvedAt = zone.resolved_at_iso
    ? new Date(zone.resolved_at_iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <>
      <div
        className={`fixed top-0 right-0 h-full w-full md:w-[520px] lg:w-[600px] bg-white shadow-2xl z-20 overflow-hidden flex flex-col ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">{zone.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {zone.center_latitude.toFixed(4)}, {zone.center_longitude.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={zone.status} />
            {incident && <IncidentTypeBadge type={incident.incident_type} />}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {createdAt} at {createdTime}
            </span>
            {resolvedAt && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Resolved {resolvedAt}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Loading...
            </div>
          ) : incident ? (
            <>
              {/* Incident Details Card */}
              <div className="p-5 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Incident Details
                </h3>

                <div className="space-y-3">
                  {/* Type */}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getIncidentIcon(incident.incident_type)}</span>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{formatIncidentType(incident.incident_type)}</p>
                      <p className="text-xs text-gray-500">Incident Type</p>
                    </div>
                  </div>

                  {/* Description */}
                  {incident.description && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                      <p className="text-sm text-gray-800">
                        {incident.description.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Reported by */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <User className="w-3 h-3" /> Reported by
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {incident.reported_by_name || 'Unknown'}
                      </p>
                    </div>

                    {/* Source */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Source</p>
                      <div className="flex items-center gap-1.5">
                        {incident.shift_id ? (
                          <>
                            <Truck className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm font-medium text-gray-900">Driver Shift</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-sm font-medium text-gray-900">Manager Report</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bin */}
                    {incident.bin_number && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Bin</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">#{incident.bin_number}</p>
                          {incident.bin_id && (
                            <a
                              href={`/administration/bins?bin=${incident.bin_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                            >
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Status</p>
                      <p className="text-sm font-medium text-gray-900 capitalize">{incident.status}</p>
                    </div>

                    {/* Verification */}
                    {incident.verified_by_user_id && (
                      <div className="bg-green-50 rounded-lg p-3 col-span-2">
                        <p className="text-xs text-green-600 mb-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </p>
                        <p className="text-sm font-medium text-green-800">
                          {incident.verified_by_name || 'Manager'}
                          {incident.verified_at_iso && (
                            <span className="text-xs text-green-600 font-normal ml-2">
                              on {new Date(incident.verified_at_iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Unverified field observation warning */}
                    {incident.is_field_observation && !incident.verified_by_user_id && (
                      <div className="bg-amber-50 rounded-lg p-3 col-span-2">
                        <p className="text-xs text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Field observation — not yet verified by a manager
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Shift link */}
                  {incident.shift_id && (
                    <a
                      href={`/operations/shifts?id=${incident.shift_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <Truck className="w-4 h-4" />
                      View Shift Where Incident Was Reported
                      <ExternalLink className="w-3.5 h-3.5 ml-auto" />
                    </a>
                  )}
                </div>
              </div>

              {/* Photo evidence */}
              {incident.photo_url && (
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Evidence Photo
                  </h3>
                  <button
                    onClick={() => setFullscreenPhoto(incident.photo_url!)}
                    className="relative w-full max-w-xs rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors group"
                  >
                    <img
                      src={incident.photo_url}
                      alt="Incident evidence"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                </div>
              )}

              {/* Resolution notes */}
              {zone.resolution_notes && (
                <div className="p-5 border-b border-gray-100 bg-green-50">
                  <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Resolution Notes
                  </p>
                  <p className="text-sm text-green-900">{zone.resolution_notes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShieldAlert className="w-8 h-8 mb-2" />
              <p className="text-sm">No incident data found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 shrink-0">
          {zone.status !== 'resolved' ? (
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Resolve Zone
              </button>
              <button className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                Set to Monitoring
              </button>
            </div>
          ) : (
            <button className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Re-activate Zone
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen photo modal */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            onClick={() => setFullscreenPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={fullscreenPhoto}
            alt="Evidence photo"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: NoGoZone['status'] }) {
  if (status === 'active')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        Active
      </span>
    );
  if (status === 'monitoring')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <Eye className="w-3 h-3" />
        Monitoring
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 className="w-3 h-3" />
      Resolved
    </span>
  );
}

function IncidentTypeBadge({ type }: { type: ZoneIncident['incident_type'] }) {
  const cls =
    type === 'vandalism'
      ? 'bg-red-100 text-red-700'
      : type === 'theft'
      ? 'bg-purple-100 text-purple-700'
      : type === 'landlord_complaint'
      ? 'bg-orange-100 text-orange-700'
      : type === 'missing'
      ? 'bg-gray-200 text-gray-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {formatIncidentType(type)}
    </span>
  );
}
