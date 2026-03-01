'use client';

import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  List,
  Map as MapIcon,
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useNoGoZones } from '@/lib/hooks/use-zones';
import {
  NoGoZone,
  ZoneStatus,
  getZoneSeverity,
  getZoneColor,
} from '@/lib/types/zone';
import { ZoneDetailsDrawer } from '@/components/binly/zone-details-drawer';
import { ReportIncidentModal } from '@/components/binly/report-incident-modal';

type ViewMode = 'list' | 'map';
type SortField = 'conflict_score' | 'created_at_iso' | 'name';
type SortDir = 'asc' | 'desc';

const STATUS_TABS: { value: ZoneStatus | 'all'; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { value: 'active', label: 'Active', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: 'monitoring', label: 'Monitoring', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'resolved', label: 'Resolved', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function statusBadge(status: ZoneStatus) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Active
        </span>
      );
    case 'monitoring':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Eye className="w-3 h-3" />
          Monitoring
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          Resolved
        </span>
      );
  }
}

function severityBadge(score: number) {
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
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {sev.charAt(0).toUpperCase() + sev.slice(1)} · {score}
    </span>
  );
}

function SortButton({
  field,
  label,
  current,
  dir,
  onClick,
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onClick(field)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${
        active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {active ? (
        dir === 'desc' ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  );
}

export function NoGoZonesView() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<ZoneStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('conflict_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedZone, setSelectedZone] = useState<NoGoZone | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: zones = [], isLoading, error } = useNoGoZones();

  // Real-time zone cache updates are handled globally by GlobalCentrifugoSync in the layout.

  const filtered = useMemo(() => {
    let list = [...zones];

    if (statusFilter !== 'all') {
      list = list.filter((z) => z.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((z) => z.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'conflict_score') {
        cmp = a.conflict_score - b.conflict_score;
      } else if (sortField === 'created_at_iso') {
        cmp = new Date(a.created_at_iso).getTime() - new Date(b.created_at_iso).getTime();
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [zones, statusFilter, search, sortField, sortDir]);

  const counts = useMemo(
    () => ({
      all: zones.length,
      active: zones.filter((z) => z.status === 'active').length,
      monitoring: zones.filter((z) => z.status === 'monitoring').length,
      resolved: zones.filter((z) => z.status === 'resolved').length,
    }),
    [zones],
  );

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">No-Go Zones</h1>
              <p className="text-sm text-gray-500">
                {counts.active} active · {counts.monitoring} monitoring · {counts.resolved} resolved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                  viewMode === 'map'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                Map
              </button>
            </div>

            {/* Report Incident */}
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Report Incident
            </button>
          </div>
        </div>

        {/* Status tabs + search row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value as ZoneStatus | 'all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    statusFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {counts[tab.value as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search zones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'list' ? (
          <ZoneListView
            zones={filtered}
            isLoading={isLoading}
            error={error}
            sortField={sortField}
            sortDir={sortDir}
            onSort={toggleSort}
            onSelect={setSelectedZone}
          />
        ) : (
          <ZoneMapView zones={filtered} onSelect={setSelectedZone} />
        )}

        {/* Drawer */}
        {selectedZone && (
          <>
            <div
              className="absolute inset-0 bg-black/20 z-10 animate-fade-in"
              onClick={() => setSelectedZone(null)}
            />
            <ZoneDetailsDrawer
              zone={selectedZone}
              onClose={() => setSelectedZone(null)}
              onNavigateTo={(zoneId) => {
                const target = zones.find((z) => z.id === zoneId);
                if (target) setSelectedZone(target);
              }}
            />
          </>
        )}
      </div>

      {/* Report Incident Modal */}
      {showReportModal && (
        <ReportIncidentModal onClose={() => setShowReportModal(false)} />
      )}
    </div>
  );
}

// ── List View ────────────────────────────────────────────────────────────────

function ZoneListView({
  zones,
  isLoading,
  error,
  sortField,
  sortDir,
  onSort,
  onSelect,
}: {
  zones: NoGoZone[];
  isLoading: boolean;
  error: Error | null;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onSelect: (z: NoGoZone) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm gap-2">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Loading zones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm gap-2">
        <AlertTriangle className="w-4 h-4" />
        Failed to load zones
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <ShieldAlert className="w-10 h-10 text-gray-300" />
        <p className="text-sm font-medium">No zones match your filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left">
              <SortButton field="name" label="Zone" current={sortField} dir={sortDir} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-left">
              <SortButton field="conflict_score" label="Severity" current={sortField} dir={sortDir} onClick={onSort} />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Radius</th>
            <th className="px-4 py-3 text-left">
              <SortButton field="created_at_iso" label="Reported" current={sortField} dir={sortDir} onClick={onSort} />
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {zones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ZoneRow({ zone, onSelect }: { zone: NoGoZone; onSelect: (z: NoGoZone) => void }) {
  const reported = new Date(zone.created_at_iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={() => onSelect(zone)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: getZoneColor(zone.conflict_score) }}
          />
          <span className="font-medium text-gray-900 group-hover:text-red-600 transition-colors">
            {zone.name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">{severityBadge(zone.conflict_score)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {statusBadge(zone.status)}
          {zone.resolution_type === 'merged' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Merged
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{zone.radius_meters}m</td>
      <td className="px-4 py-3 text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {reported}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors px-2 py-1 rounded"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(zone);
          }}
        >
          Details →
        </button>
      </td>
    </tr>
  );
}

// ── Map View ─────────────────────────────────────────────────────────────────

function ZoneMapView({
  zones,
  onSelect,
}: {
  zones: NoGoZone[];
  onSelect: (z: NoGoZone) => void;
}) {
  // Lazy import Google Maps to avoid SSR issues
  const [MapComponents, setMapComponents] = useState<{
    APIProvider: React.ComponentType<{ apiKey: string; children: React.ReactNode }>;
    Map: React.ComponentType<Record<string, unknown>>;
    AdvancedMarker: React.ComponentType<Record<string, unknown>>;
  } | null>(null);

  useState(() => {
    import('@vis.gl/react-google-maps').then((mod) => {
      setMapComponents({
        APIProvider: mod.APIProvider,
        Map: mod.Map,
        AdvancedMarker: mod.AdvancedMarker,
      });
    });
  });

  if (!MapComponents) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm gap-2">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        Loading map...
      </div>
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const center = { lat: 37.3382, lng: -121.8863 }; // San Jose, CA

  const { APIProvider, Map, AdvancedMarker } = MapComponents;

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={center}
        defaultZoom={11}
        mapId="no-go-zones-map"
        mapTypeId="hybrid"
        disableDefaultUI={false}
        streetViewControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {zones.map((zone) => (
          <ZoneMapMarker
            key={zone.id}
            zone={zone}
            AdvancedMarker={AdvancedMarker}
            onSelect={onSelect}
          />
        ))}
      </Map>
    </APIProvider>
  );
}

function ZoneMapMarker({
  zone,
  AdvancedMarker,
  onSelect,
}: {
  zone: NoGoZone;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AdvancedMarker: React.ComponentType<any>;
  onSelect: (z: NoGoZone) => void;
}) {
  const color = getZoneColor(zone.conflict_score);
  const isActive = zone.status === 'active';

  return (
    <AdvancedMarker
      position={{ lat: zone.center_latitude, lng: zone.center_longitude }}
      onClick={() => onSelect(zone)}
    >
      <div
        className="flex flex-col items-center cursor-pointer"
        title={zone.name}
      >
        {/* Zone circle with white ring for satellite contrast */}
        <div
          className={`rounded-full flex items-center justify-center hover:scale-110 transition-transform ${isActive ? 'animate-pulse' : ''}`}
          style={{
            width: 36,
            height: 36,
            backgroundColor: color + '99',
            border: '2px solid white',
            boxShadow: `0 0 0 2px ${color}, 0 2px 10px rgba(0,0,0,0.7)`,
          }}
        >
          <ShieldAlert
            className="w-4 h-4 text-white drop-shadow"
          />
        </div>
        {/* Always-visible label with drop shadow for satellite readability */}
        <div
          className="mt-1 px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap"
          style={{
            backgroundColor: color,
            boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
          }}
        >
          {zone.name}
        </div>
      </div>
    </AdvancedMarker>
  );
}
