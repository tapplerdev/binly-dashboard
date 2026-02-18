'use client';

import { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import {
  X, Hash, MapPin, AlertTriangle, Loader2, CheckCircle2,
  ChevronDown, Search, Building2, CheckCircle,
} from 'lucide-react';
import { useCreateManagerIncidentReport } from '@/lib/hooks/use-zones';
import { useBins } from '@/lib/hooks/use-bins';
import { IncidentType, formatIncidentType } from '@/lib/types/zone';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { HerePlacesAutocomplete } from '@/components/ui/here-places-autocomplete';
import { HerePlaceDetails, hereReverseGeocode } from '@/lib/services/geocoding.service';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 }; // San Jose, CA

const INCIDENT_TYPES: IncidentType[] = [
  'vandalism',
  'landlord_complaint',
  'theft',
  'relocation_request',
  'missing',
];

type Mode = 'bin' | 'address';

// ── Map helpers ───────────────────────────────────────────────────────────────

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick(e.latLng.lat(), e.latLng.lng());
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onClick]);
  return null;
}

function MapCenterController({
  center,
  onDone,
}: {
  center: { lat: number; lng: number } | null;
  onDone: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    map.setZoom(16);
    const t = setTimeout(onDone, 400);
    return () => clearTimeout(t);
  }, [map, center, onDone]);
  return null;
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface ReportIncidentModalProps {
  onClose: () => void;
}

export function ReportIncidentModal({ onClose }: ReportIncidentModalProps) {
  const mutation = useCreateManagerIncidentReport();
  const { data: bins = [], isLoading: binsLoading } = useBins();
  const mappableBins = bins.filter(isMappableBin);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('bin');

  // ── Bin mode state ────────────────────────────────────────────────────────
  const [binSearch, setBinSearch] = useState('');
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);

  // ── Address mode state ────────────────────────────────────────────────────
  const [addressText, setAddressText] = useState('');
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);

  // ── Map state ─────────────────────────────────────────────────────────────
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);

  // ── Common form state ─────────────────────────────────────────────────────
  const [incidentType, setIncidentType] = useState<IncidentType>('vandalism');
  const [description, setDescription] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Filtered bins ─────────────────────────────────────────────────────────
  const filteredBins = binSearch.trim()
    ? bins.filter(
        (b) =>
          String(b.bin_number).includes(binSearch.trim().replace('#', '')) ||
          (b.current_street ?? '').toLowerCase().includes(binSearch.toLowerCase())
      )
    : bins;

  // ── Select a bin ─────────────────────────────────────────────────────────
  function selectBin(bin: Bin) {
    setSelectedBin(bin);
    if (bin.latitude && bin.longitude) {
      setPendingCenter({ lat: bin.latitude, lng: bin.longitude });
    }
  }

  // ── Bin marker clicked on map ─────────────────────────────────────────────
  function handleBinMarkerClick(bin: Bin) {
    if (mode === 'bin') selectBin(bin);
  }

  // ── Map click: address mode → reverse geocode ─────────────────────────────
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (mode !== 'address') return;
      setAddressLat(lat);
      setAddressLng(lng);
      setPendingCenter({ lat, lng });
      setReverseGeocoding(true);
      try {
        const result = await hereReverseGeocode(lat, lng);
        if (result) setAddressText(result.formattedAddress);
      } catch {
        // keep whatever address was there
      } finally {
        setReverseGeocoding(false);
      }
    },
    [mode]
  );

  // ── HERE autocomplete select ──────────────────────────────────────────────
  function handlePlaceSelect(place: HerePlaceDetails) {
    setAddressText(place.formattedAddress);
    setAddressLat(place.latitude);
    setAddressLng(place.longitude);
    setPendingCenter({ lat: place.latitude, lng: place.longitude });
  }

  // ── Mode switch ───────────────────────────────────────────────────────────
  function switchMode(m: Mode) {
    setMode(m);
    setSelectedBin(null);
    setBinSearch('');
    setAddressText('');
    setAddressLat(null);
    setAddressLng(null);
    setPendingCenter(null);
  }

  // ── Address mode marker pos ───────────────────────────────────────────────
  const addressMarkerPos =
    mode === 'address' && addressLat !== null && addressLng !== null
      ? { lat: addressLat, lng: addressLng }
      : null;

  // ── Validation ────────────────────────────────────────────────────────────
  function isValid() {
    if (!description.trim()) return false;
    if (mode === 'bin') return !!selectedBin;
    return addressLat !== null && addressLng !== null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!isValid()) return;
    const payload =
      mode === 'bin'
        ? { bin_id: selectedBin!.id, incident_type: incidentType, description: description.trim() }
        : {
            latitude: addressLat!,
            longitude: addressLng!,
            address: addressText.trim() || undefined,
            incident_type: incidentType,
            description: description.trim(),
          };

    mutation.mutate(payload, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(onClose, 2000);
      },
    });
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-[1px]">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal — match edit-bin-dialog sizing */}
      <div className="relative z-10 m-auto w-full max-w-[1400px] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Report No-Go Zone Incident</h2>
            <p className="text-xs text-gray-400">
              Creates a new zone or reinforces an existing one in the area
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: Map ─────────────────────────────────────────────── */}
          <div className="flex-1 relative bg-gray-100">
            <Map
              mapId="report-incident-map"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={11}
              mapTypeId="hybrid"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              zoomControl={true}
              gestureHandling="greedy"
              className="w-full h-full"
              style={{ borderRadius: 0 }}
            >
              <MapClickHandler onClick={handleMapClick} />
              {pendingCenter && (
                <MapCenterController
                  center={pendingCenter}
                  onDone={() => setPendingCenter(null)}
                />
              )}

              {/* All bin markers */}
              {mappableBins.map((bin) => {
                const isSelected = selectedBin?.id === bin.id;
                return (
                  <AdvancedMarker
                    key={bin.id}
                    position={{ lat: bin.latitude, lng: bin.longitude }}
                    zIndex={isSelected ? 20 : 10}
                    onClick={() => handleBinMarkerClick(bin)}
                  >
                    <div
                      className={`rounded-full border-2 border-white shadow-lg cursor-pointer transition-all duration-200 flex items-center justify-center text-white font-bold ${
                        isSelected
                          ? 'w-11 h-11 text-sm ring-2 ring-white ring-offset-2 ring-offset-red-500 scale-110'
                          : 'w-8 h-8 text-xs hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? '#EF4444'
                          : getBinMarkerColor(bin.fill_percentage, bin.status),
                      }}
                      title={`Bin #${bin.bin_number} — ${bin.current_street ?? ''}`}
                    >
                      {bin.bin_number}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Address mode pin */}
              {addressMarkerPos && (
                <AdvancedMarker position={addressMarkerPos} zIndex={30}>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-purple-600 border-2 border-white shadow-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full -mt-0.5 opacity-60" />
                  </div>
                </AdvancedMarker>
              )}
            </Map>

            {/* Address mode tap hint */}
            {mode === 'address' && !addressMarkerPos && (
              <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                <div className="bg-black/60 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm">
                  Search an address or tap the map to place a marker
                </div>
              </div>
            )}

            {/* Reverse geocoding spinner */}
            {reverseGeocoding && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1.5 shadow-md flex items-center gap-2 text-xs text-gray-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                Looking up address...
              </div>
            )}
          </div>

          {/* ── Right: Form ───────────────────────────────────────────── */}
          {success ? (
            <div className="w-[460px] flex flex-col items-center justify-center gap-4 px-8 border-l border-gray-100">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-base">Zone Reported</p>
                <p className="text-sm text-gray-500 mt-1">
                  The incident has been filed. The zone will appear on the map shortly via live sync.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-[460px] flex flex-col border-l border-gray-100 min-h-0">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* ── Mode toggle ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton
                    active={mode === 'bin'}
                    onClick={() => switchMode('bin')}
                    icon={<Hash className="w-4 h-4" />}
                    title="By Bin #"
                    subtitle="Pulls coords from bin record"
                  />
                  <ModeButton
                    active={mode === 'address'}
                    onClick={() => switchMode('address')}
                    icon={<Building2 className="w-4 h-4" />}
                    title="By Address"
                    subtitle="Search or tap map to place"
                  />
                </div>

                {/* ── Bin mode ─────────────────────────────────────────── */}
                {mode === 'bin' && (
                  <>
                    {/* Search bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={binSearch}
                        onChange={(e) => setBinSearch(e.target.value)}
                        placeholder="Search by bin # or street..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                      />
                    </div>

                    {/* Bin list — always visible, scrollable */}
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      {/* List header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {binSearch ? `${filteredBins.length} result${filteredBins.length !== 1 ? 's' : ''}` : `All Bins (${bins.length})`}
                        </span>
                        {selectedBin && (
                          <button
                            onClick={() => setSelectedBin(null)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                          >
                            Clear selection
                          </button>
                        )}
                      </div>

                      <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-100">
                        {binsLoading ? (
                          <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Loading bins...
                          </div>
                        ) : filteredBins.length === 0 ? (
                          <div className="py-8 text-center text-xs text-gray-400">
                            No bins match &ldquo;{binSearch}&rdquo;
                          </div>
                        ) : (
                          filteredBins.map((bin) => {
                            const isSelected = selectedBin?.id === bin.id;
                            const fill = bin.fill_percentage ?? 0;
                            return (
                              <button
                                key={bin.id}
                                type="button"
                                onClick={() => selectBin(bin)}
                                className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-all ${
                                  isSelected
                                    ? 'bg-red-50 border-l-2 border-l-red-500'
                                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                                }`}
                              >
                                {/* Marker-style color dot */}
                                <div
                                  className="w-8 h-8 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                                  style={{
                                    backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                                  }}
                                >
                                  {bin.bin_number}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-900">
                                      Bin #{bin.bin_number}
                                    </span>
                                    <span className="text-xs text-gray-500">{fill}%</span>
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        bin.status === 'active'
                                          ? 'bg-green-100 text-green-700'
                                          : bin.status === 'missing'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {bin.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {bin.location_name || `${bin.current_street ?? '—'}${bin.city ? ', ' + bin.city : ''}`}
                                  </p>
                                  {/* Fill bar */}
                                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full transition-all"
                                      style={{
                                        width: `${fill}%`,
                                        backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status),
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Selected checkmark */}
                                {isSelected && (
                                  <CheckCircle className="w-4 h-4 text-red-500 shrink-0 mt-1" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Map click hint */}
                    <p className="text-xs text-gray-400 -mt-1">
                      You can also click any bin marker on the map to select it.
                    </p>
                  </>
                )}

                {/* ── Address mode ────────────────────────────────────── */}
                {mode === 'address' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Search Address
                    </label>
                    <HerePlacesAutocomplete
                      value={addressText}
                      onChange={setAddressText}
                      onPlaceSelect={handlePlaceSelect}
                      placeholder="42 Sheikh Zayed Rd, Dubai..."
                      isAutoFilled={addressLat !== null}
                    />
                    {addressLat !== null && addressLng !== null && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono">
                          {addressLat.toFixed(5)}, {addressLng.toFixed(5)}
                        </span>
                        <button
                          onClick={() => { setAddressLat(null); setAddressLng(null); setAddressText(''); }}
                          className="ml-auto text-purple-400 hover:text-purple-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Incident type ─────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Incident Type
                  </label>
                  <div className="relative">
                    <select
                      value={incidentType}
                      onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                      className="w-full appearance-none px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 pr-8 bg-white"
                    >
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t} value={t}>{formatIncidentType(t)}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* ── Description ──────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the incident — what was reported, when, and any additional context from the caller..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
                  />
                </div>

                {/* ── Mutation error ─────────────────────────────────────── */}
                {mutation.isError && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : 'Failed to submit. Please try again.'}
                  </div>
                )}
              </div>

              {/* ── Footer ──────────────────────────────────────────────── */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid() || mutation.isPending}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModeButton({
  active, onClick, icon, title, subtitle,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
        active ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className={`flex items-center gap-1.5 font-semibold text-sm ${active ? 'text-red-700' : 'text-gray-700'}`}>
        <span className={active ? 'text-red-600' : 'text-gray-400'}>{icon}</span>
        {title}
      </div>
      <p className={`text-xs ${active ? 'text-red-500' : 'text-gray-400'}`}>{subtitle}</p>
    </button>
  );
}
