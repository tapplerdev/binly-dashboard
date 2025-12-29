'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { getZoneIncidents } from '@/lib/api/zones';
import {
  NoGoZone,
  ZoneIncident,
  formatIncidentType,
  getIncidentIcon,
  getZoneSeverity,
} from '@/lib/types/zone';
import { Loader2, X, AlertTriangle, FileText } from 'lucide-react';

interface ZoneDetailsDrawerProps {
  zone: NoGoZone;
  onClose: () => void;
}

export function ZoneDetailsDrawer({ zone, onClose }: ZoneDetailsDrawerProps) {
  const [incidents, setIncidents] = useState<ZoneIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  useEffect(() => {
    async function fetchIncidents() {
      try {
        setLoading(true);
        const data = await getZoneIncidents(zone.id);
        setIncidents(data);
      } catch (error) {
        console.error('Failed to fetch incidents:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchIncidents();
  }, [zone.id]);

  const vandalismCount = incidents.filter((i) => i.incident_type === 'vandalism').length;
  const complaintCount = incidents.filter((i) => i.incident_type === 'landlord_complaint').length;
  const severity = getZoneSeverity(zone.conflict_score);

  // Group incidents with photos for gallery
  const incidentsWithPhotos = incidents.filter((i) => i.photo_url);

  return (
    <div className={`absolute top-0 right-0 h-full w-96 bg-white shadow-2xl z-20 overflow-hidden flex flex-col ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Restricted Area
              </h2>
            </div>
            <p className="text-sm text-gray-600">{zone.name}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Score Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            severity === 'critical'
              ? 'bg-red-100 text-red-800'
              : severity === 'high'
              ? 'bg-orange-100 text-orange-800'
              : severity === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          <span className="text-xs font-semibold">
            Conflict Score: {severity.toUpperCase()}
          </span>
          <span className="text-sm font-bold">{zone.conflict_score}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Stats Cards */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon="🔨"
              label="Vandalism Reports"
              value={vandalismCount}
            />
            <StatCard
              icon="📋"
              label="Move Requests"
              value={complaintCount}
            />
          </div>
        </div>

        {/* Evidence Timeline */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Evidence History
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No incidents recorded
            </p>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <IncidentTimelineItem key={incident.id} incident={incident} />
              ))}
            </div>
          )}
        </div>

        {/* Evidence Gallery */}
        {incidentsWithPhotos.length > 0 && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Evidence Gallery
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {incidentsWithPhotos.map((incident) => (
                <div
                  key={incident.id}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img
                    src={incident.photo_url!}
                    alt={`Evidence from ${formatIncidentType(incident.incident_type)}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-3">
          <button className="flex-1 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            Clear Zone
          </button>
          <button className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function IncidentTimelineItem({ incident }: { incident: ZoneIncident }) {
  const date = new Date(incident.reported_at_iso);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm relative">
          {getIncidentIcon(incident.incident_type)}
          {incident.is_field_observation && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" title="Field Observation" />
          )}
        </div>
        <div className="w-px h-full bg-gray-200 mt-2" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-900">
            {formattedDate}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              incident.incident_type === 'vandalism'
                ? 'bg-red-100 text-red-700'
                : incident.incident_type === 'landlord_complaint'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {formatIncidentType(incident.incident_type)}
          </span>
          {incident.is_field_observation && !incident.verified_by_user_id && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              Needs Verification
            </span>
          )}
          {incident.is_field_observation && incident.verified_by_user_id && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              ✓ Verified
            </span>
          )}
        </div>
        <p className="text-sm text-gray-900 mb-1">
          {incident.is_field_observation && (
            <span className="text-blue-600 font-medium">Field Report: </span>
          )}
          {incident.incident_type === 'vandalism'
            ? `Vandalism reported${incident.reported_by_name ? ` by ${incident.reported_by_name}` : ''}`
            : incident.incident_type === 'landlord_complaint'
            ? `Landlord requested removal${incident.bin_number ? ` of Bin #${incident.bin_number}` : ''}`
            : formatIncidentType(incident.incident_type)}
        </p>
        {incident.description && (
          <p className="text-xs text-gray-600">{incident.description}</p>
        )}
        {incident.is_field_observation && incident.verified_by_name && (
          <p className="text-xs text-green-600 mt-1">
            Verified by {incident.verified_by_name}
          </p>
        )}
      </div>
    </div>
  );
}
