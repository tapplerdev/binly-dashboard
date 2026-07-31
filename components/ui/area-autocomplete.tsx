'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/store';

/** A resolved city/district target — mirrors the backend's areaTarget. */
export interface TargetArea {
  label: string;
  type?: string; // locality | district | administrativeArea
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // west, south, east, north
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ropacal-backend-production.up.railway.app';

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
    if (q.length < 3) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      setLoading(true);
      try {
        // Goes through the BACKEND, not HERE directly. Two reasons:
        //
        //  1. Results are scoped to THIS ORGANIZATION'S country and ranked by
        //     distance from its warehouse. This component used to hardcode
        //     `q + ', USA'` and `in=countryCode:USA`, so a Canadian user typing
        //     "Brampton" got "Brampton Twp, MI, United States" — Ontario was
        //     excluded by construction. The browser has no authoritative way to
        //     know the org's country; the server does.
        //  2. The HERE key stays server-side. This used to send
        //     NEXT_PUBLIC_HERE_API_KEY, which ships in the JS bundle and could be
        //     lifted from devtools by anyone with dashboard access.
        //
        // Result filtering (which types count as a placement target) also moved
        // server-side, so the rule lives in one place instead of being
        // reimplemented here against raw HERE fields.
        const resp = await apiFetch(
          `${BACKEND_URL}/api/geocode/search?q=${encodeURIComponent(q)}`
        );
        if (!resp.ok) {
          if (seq === requestSeqRef.current) setOptions([]);
          return;
        }
        const data = await resp.json();
        if (seq !== requestSeqRef.current) return; // a newer query superseded this response
        const areas: TargetArea[] = [];
        const seen = new Set<string>();
        for (const item of data.results ?? []) {
          // Type/state/postal-code filtering now happens on the server.
          if (seen.has(item.label)) continue;
          seen.add(item.label);
          const a: TargetArea = {
            label: item.label,
            type: item.type,
            lat: item.lat,
            lng: item.lng,
          };
          if (item.bbox) a.bbox = item.bbox;
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
