'use client';

import { useState } from 'react';
import {
  X,
  AlertTriangle,
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  Eye,
  ShieldAlert,
  ExternalLink,
  GitMerge,
  User,
  Truck,
} from 'lucide-react';
import { useZoneIncidents } from '@/lib/hooks/use-zones';
import {
  NoGoZone,
  ZoneIncident,
  formatIncidentType,
  getIncidentIcon,
  getZoneSeverity,
  getZoneColor,
} from '@/lib/types/zone';

interface ZoneDetailsDrawerProps {
  zone: NoGoZone;
  onClose: () => void;
  onNavigateTo?: (zoneId: string) => void;
}

export function ZoneDetailsDrawer({ zone, onClose, onNavigateTo }: ZoneDetailsDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const { data: incidents = [], isLoading } = useZoneIncidents(zone.id);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const severity = getZoneSeverity(zone.conflict_score);
  const color = getZoneColor(zone.conflict_score);

  const incidentsByType = {
    vandalism: incidents.filter((i) => i.incident_type === 'vandalism').length,
    landlord_complaint: incidents.filter((i) => i.incident_type === 'landlord_complaint').length,
    theft: incidents.filter((i) => i.incident_type === 'theft').length,
    relocation_request: incidents.filter((i) => i.incident_type === 'relocation_request').length,
    missing: incidents.filter((i) => i.incident_type === 'missing').length,
  };

  const shiftReports = incidents.filter((i) => !!i.shift_id).length;
  const managerReports = incidents.filter((i) => !i.shift_id).length;

  // Only show types that have at least one incident
  const activeTypes = (
    [
      { type: 'vandalism', label: 'Vandalism', count: incidentsByType.vandalism },
      { type: 'landlord_complaint', label: 'Landlord Complaint', count: incidentsByType.landlord_complaint },
      { type: 'theft', label: 'Theft', count: incidentsByType.theft },
      { type: 'relocation_request', label: 'Relocation Request', count: incidentsByType.relocation_request },
      { type: 'missing', label: 'Missing Bin', count: incidentsByType.missing },
    ] as const
  ).filter(({ count }) => count > 0);

  const resolvedAt = zone.resolved_at_iso
    ? new Date(zone.resolved_at_iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const createdAt = new Date(zone.created_at_iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`fixed top-0 right-0 h-full w-full md:w-[520px] lg:w-[600px] bg-white shadow-2xl z-20 overflow-hidden flex flex-col ${
        isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
    >
      {/* ── Header ── */}
      <div className="p-5 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: color + '20' }}
            >
              <ShieldAlert className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 truncate">{zone.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {zone.center_latitude.toFixed(4)}, {zone.center_longitude.toFixed(4)} · {zone.radius_meters}m radius
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

        {/* Status + Severity row */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={zone.status} />
          {zone.resolution_type === 'merged' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <GitMerge className="w-3 h-3" />
              Merged
            </span>
          )}
          <SeverityPill score={zone.conflict_score} />
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Reported {createdAt}
          </span>
          {resolvedAt && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Resolved {resolvedAt}
            </span>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Incident Breakdown — only non-zero types */}
        {incidents.length > 0 && (
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Incident Breakdown
            </h3>
            {activeTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeTypes.map(({ type, label, count }) => (
                  <div
                    key={type}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-base">{getIncidentIcon(type)}</span>
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Source breakdown */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
              {shiftReports > 0 && (
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  {shiftReports} from shifts
                </span>
              )}
              {managerReports > 0 && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {managerReports} manager report{managerReports !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Consumed zone banner */}
        {zone.merged_into_zone_id && (
          <div className="mx-5 mt-4 mb-1 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2.5">
            <GitMerge className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900">This zone was absorbed</p>
              <p className="text-xs text-purple-600 mt-0.5">
                Its incidents and conflict score were transferred to a higher-priority overlapping zone.
              </p>
            </div>
            {onNavigateTo && (
              <button
                onClick={() => onNavigateTo(zone.merged_into_zone_id!)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 whitespace-nowrap underline underline-offset-2"
              >
                View surviving zone →
              </button>
            )}
          </div>
        )}

        {/* Surviving zone section */}
        {(zone.merged_zone_count ?? 0) > 0 && (
          <div className="mx-5 mt-4 mb-1 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2.5">
            <GitMerge className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-purple-900">
                Absorbed {zone.merged_zone_count} zone{zone.merged_zone_count !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                This zone's score and incident log include data from {zone.merged_zone_count}{' '}
                previously separate overlapping zone{zone.merged_zone_count !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        )}

        {/* Resolution notes */}
        {zone.resolution_notes && (
          <div className="px-5 py-4 border-b border-gray-100 bg-green-50">
            <p className="text-xs font-semibold text-green-700 mb-1">Resolution Notes</p>
            <p className="text-sm text-green-900">{zone.resolution_notes}</p>
          </div>
        )}

        {/* Incident timeline */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Incident Log</h3>
            <span className="ml-auto text-xs text-gray-400">{incidents.length} total</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Loading incidents...
            </div>
          ) : incidents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No incidents recorded</p>
          ) : (
            <div className="space-y-1">
              {incidents.map((incident, idx) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  isLast={idx === incidents.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Evidence gallery */}
        {incidents.some((i) => i.photo_url) && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Evidence Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {incidents
                .filter((i) => i.photo_url)
                .map((incident) => (
                  <a
                    key={incident.id}
                    href={incident.photo_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden bg-gray-100 block hover:opacity-80 transition-opacity relative group"
                  >
                    <img
                      src={incident.photo_url!}
                      alt={`Evidence: ${formatIncidentType(incident.incident_type)}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
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
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function SeverityPill({ score }: { score: number }) {
  const sev = getZoneSeverity(score);
  const color = getZoneColor(score);
  const cls =
    sev === 'critical'
      ? 'bg-red-100 text-red-800'
      : sev === 'high'
      ? 'bg-orange-100 text-orange-800'
      : sev === 'medium'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {sev.charAt(0).toUpperCase() + sev.slice(1)} · {score}
    </span>
  );
}

function IncidentRow({ incident, isLast }: { incident: ZoneIncident; isLast: boolean }) {
  const date = new Date(incident.reported_at_iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Source: shift report vs manager report
  const isShiftReport = !!incident.shift_id;
  const sourceLine = isShiftReport
    ? `Driver report${incident.reported_by_name ? ` · ${incident.reported_by_name}` : ''}`
    : `Manager report${incident.reported_by_name ? ` · ${incident.reported_by_name}` : ''}`;

  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm">
          {getIncidentIcon(incident.incident_type)}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-100 mt-1 mb-1 min-h-[12px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        {/* Top row: date + badges */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-gray-700">{date}</span>
          <IncidentTypeBadge type={incident.incident_type} />
          {isShiftReport ? (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              <Truck className="w-2.5 h-2.5" />
              On shift
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">
              <User className="w-2.5 h-2.5" />
              Manual
            </span>
          )}
          {incident.is_field_observation && !incident.verified_by_user_id && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              Unverified
            </span>
          )}
          {incident.verified_by_user_id && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
              ✓ Verified
            </span>
          )}
        </div>

        {/* Reporter line */}
        <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1 flex-wrap">
          <span>{sourceLine}</span>
          {incident.bin_number && (
            <span className="text-gray-400">· Bin #{incident.bin_number}</span>
          )}
          {isShiftReport && incident.shift_id && (
            <a
              href={`/operations/shifts?id=${incident.shift_id}`}
              className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              View shift <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </p>

        {/* Detail card */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-400">
              Type: <span className="text-gray-700 font-medium">{formatIncidentType(incident.incident_type)}</span>
            </span>
            {incident.bin_number && (
              <span className="text-xs text-gray-400">
                Bin: <span className="text-gray-700 font-medium">#{incident.bin_number}</span>
              </span>
            )}
            {incident.verified_by_name && (
              <span className="text-xs text-green-600">
                Verified by <span className="font-medium">{incident.verified_by_name}</span>
              </span>
            )}
          </div>
          {incident.description && (
            <p className="text-xs text-gray-600 pt-0.5 border-t border-gray-100">
              {incident.description}
            </p>
          )}
        </div>
      </div>
    </div>
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
