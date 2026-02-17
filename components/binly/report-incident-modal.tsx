'use client';

import { useState } from 'react';
import {
  X,
  Hash,
  MapPin,
  ChevronDown,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useCreateManagerIncidentReport } from '@/lib/hooks/use-zones';
import { IncidentType, formatIncidentType } from '@/lib/types/zone';

interface ReportIncidentModalProps {
  onClose: () => void;
}

type Mode = 'bin' | 'address';

const INCIDENT_TYPES: IncidentType[] = [
  'vandalism',
  'landlord_complaint',
  'theft',
  'relocation_request',
  'missing',
];

export function ReportIncidentModal({ onClose }: ReportIncidentModalProps) {
  const [mode, setMode] = useState<Mode>('bin');

  // Bin mode
  const [binId, setBinId] = useState('');

  // Address mode
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');

  // Common
  const [incidentType, setIncidentType] = useState<IncidentType>('vandalism');
  const [description, setDescription] = useState('');

  const [success, setSuccess] = useState(false);

  const mutation = useCreateManagerIncidentReport();

  // ── Geocode address using Google Maps Geocoding API ──────────────────────
  async function handleGeocode() {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeError('');
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        setLat(String(loc.lat));
        setLng(String(loc.lng));
      } else {
        setGeocodeError('Address not found. Try a more specific address.');
      }
    } catch {
      setGeocodeError('Geocoding failed. Check your connection.');
    } finally {
      setGeocoding(false);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function isValid(): boolean {
    if (!description.trim()) return false;
    if (mode === 'bin') return binId.trim().length > 0;
    return !!lat && !!lng;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!isValid()) return;

    const payload =
      mode === 'bin'
        ? {
            bin_id: binId.trim(),
            incident_type: incidentType,
            description: description.trim(),
          }
        : {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            address: address.trim() || undefined,
            incident_type: incidentType,
            description: description.trim(),
          };

    mutation.mutate(payload, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(onClose, 1800);
      },
    });
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Report Incident</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-gray-900">Incident Reported</p>
              <p className="text-sm text-gray-500">The zone has been flagged and will appear in the list shortly.</p>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Location Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <ModeCard
                    active={mode === 'bin'}
                    onClick={() => setMode('bin')}
                    icon={<Hash className="w-4 h-4" />}
                    title="By Bin ID"
                    description="Coordinates pulled from the bin record"
                  />
                  <ModeCard
                    active={mode === 'address'}
                    onClick={() => setMode('address')}
                    icon={<MapPin className="w-4 h-4" />}
                    title="By Address"
                    description="Geocode a street address or landmark"
                  />
                </div>
              </div>

              {/* Bin ID input */}
              {mode === 'bin' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Bin ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BIN-0042"
                    value={binId}
                    onChange={(e) => setBinId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    The bin&apos;s GPS coordinates will be used for zone placement.
                  </p>
                </div>
              )}

              {/* Address input */}
              {mode === 'address' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Address or Landmark
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 42 Sheikh Zayed Rd, Dubai"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          setLat('');
                          setLng('');
                          setGeocodeError('');
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                      />
                      <button
                        onClick={handleGeocode}
                        disabled={geocoding || !address.trim()}
                        className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center gap-1.5"
                      >
                        {geocoding ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        Locate
                      </button>
                    </div>
                    {geocodeError && (
                      <p className="text-xs text-red-500 mt-1">{geocodeError}</p>
                    )}
                  </div>

                  {/* Resolved coords display */}
                  {lat && lng && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Located: {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
                      </span>
                    </div>
                  )}

                  {/* Manual override */}
                  {!lat && !lng && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Latitude (manual)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="25.2048"
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Longitude (manual)</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="55.2708"
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Incident type */}
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
                      <option key={t} value={t}>
                        {formatIncidentType(t)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the incident — what was reported, when, and any additional context from the caller..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
                />
              </div>

              {/* Mutation error */}
              {mutation.isError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : 'Failed to submit. Please try again.'}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!success && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all ${
        active
          ? 'border-red-500 bg-red-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 font-semibold text-sm ${
          active ? 'text-red-700' : 'text-gray-700'
        }`}
      >
        <span className={active ? 'text-red-600' : 'text-gray-500'}>{icon}</span>
        {title}
      </div>
      <p className={`text-xs ${active ? 'text-red-600' : 'text-gray-400'}`}>{description}</p>
    </button>
  );
}
