'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';

/** A resolved city/district target — mirrors the backend's areaTarget. */
export interface TargetArea {
  label: string;
  type?: string; // locality | district | administrativeArea
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // west, south, east, north
}

const HERE_KEY = process.env.NEXT_PUBLIC_HERE_API_KEY;

const TYPE_LABELS: Record<string, string> = {
  city: 'city',
  district: 'district',
  county: 'county',
  locality: 'city',
  administrativeArea: 'county/area',
  street: 'address',
  houseNumber: 'address',
  address: 'address',
  intersection: 'address',
};

interface AreaAutocompleteProps {
  value: TargetArea | null;
  onChange: (area: TargetArea | null) => void;
  placeholder?: string;
}

/**
 * City/district picker backed by HERE geocoding. Unlike a plain text field,
 * ambiguity becomes a visible choice — "Brentwood" shows both the LA district
 * and the Contra Costa city, each with its bounding box, so the recommender
 * gets geometry instead of a guessable name.
 */
export function AreaAutocomplete({ value, onChange, placeholder = 'Target a city or district (optional)…' }: AreaAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TargetArea[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0); // stale-response guard: only the latest fetch may set options
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3 || !HERE_KEY) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      setLoading(true);
      try {
        // US-wide: Binly places bins nationwide. A common name that exists in
        // several states (Springfield, Fremont…) returns multiple options; each
        // option's title carries the state (e.g. "Germantown, TN, United States"),
        // so the user disambiguates by picking the right one.
        const url =
          `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(q + ', USA')}` +
          `&in=countryCode:USA&limit=6&apiKey=${HERE_KEY}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (seq !== requestSeqRef.current) return; // a newer query superseded this response
        const areas: TargetArea[] = [];
        const seen = new Set<string>();
        for (const item of data.items ?? []) {
          // Cities/districts (locality, administrativeArea) AND specific addresses
          // (street, houseNumber, address, intersection) — a precise address is a
          // valid target; the recommender sweeps a radius around the point.
          if (!['locality', 'administrativeArea', 'street', 'houseNumber', 'address', 'intersection'].includes(item.resultType)) continue;
          // States/countries aren't placement targets; districts arrive as
          // resultType=locality with localityType=district (HERE v7).
          if (item.administrativeAreaType === 'state' || item.administrativeAreaType === 'country') continue;
          if (item.localityType === 'postalCode') continue;
          if (seen.has(item.title)) continue;
          seen.add(item.title);
          const a: TargetArea = {
            label: item.title,
            type: item.localityType || item.administrativeAreaType || item.resultType,
            lat: item.position?.lat,
            lng: item.position?.lng,
          };
          if (item.mapView) {
            a.bbox = [item.mapView.west, item.mapView.south, item.mapView.east, item.mapView.north];
          }
          if (a.lat != null && a.lng != null) areas.push(a);
        }
        setOptions(areas);
        setOpen(areas.length > 0);
      } catch {
        if (seq === requestSeqRef.current) setOptions([]);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
        <MapPin className="w-3 h-3" />
        {value.label}
        {value.type && <span className="text-primary/60">· {TYPE_LABELS[value.type] ?? value.type}</span>}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-0.5 text-primary/60 hover:text-primary"
          title="Clear target area"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  if (!HERE_KEY) {
    // Missing build-time key: a live-looking input that never responds is
    // worse than an honest disabled one.
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400" title="NEXT_PUBLIC_HERE_API_KEY is not configured">
        <MapPin className="w-3.5 h-3.5" /> Area search unavailable
      </span>
    );
  }

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => options.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-gray-600 placeholder:text-gray-400 outline-none"
        />
        {loading && <Loader2 className="w-3 h-3 text-gray-400 animate-spin shrink-0" />}
      </div>
      {open && options.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-50">
          {options.map((o) => (
            <button
              key={`${o.label}-${o.lat}`}
              type="button"
              onClick={() => {
                onChange(o);
                setQuery('');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-800 truncate">{o.label}</span>
              <span className="ml-auto text-[10px] text-gray-400 shrink-0">{TYPE_LABELS[o.type ?? ''] ?? o.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
