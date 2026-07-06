'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useModalClose } from '@/components/binly/modal-wrapper';
import { createMoveRequest, MoveRequestConflictError } from '@/lib/api/move-requests';
import { MapPin, AlertTriangle } from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://ropacal-backend-production.up.railway.app';

interface ScoredCandidate {
  id: string;
  address: string;
  street: string;
  city: string;
  zip?: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
  in_no_go_zone: boolean;
  nearest_bin_m: number;
}

/**
 * "Relocate to a better spot": the weak-site prescription. Instead of a blank
 * destination, the Growth candidate scorer's top locations are offered —
 * Phase 2 diagnoses, Phase 4 prescribes, schedule-move executes.
 */
export function RelocateSuggestModal({
  bin,
  reason,
  onClose,
  onDone,
}: {
  bin: { id: string; bin_number: number };
  reason: string; // evidence line written into the move notes
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { handleClose, backdropClass, containerClass } = useModalClose(onClose);
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<ScoredCandidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['growth-candidates'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE_URL}/api/analytics/growth/candidates`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed to fetch candidates');
      return r.json().then(j => j.data as { candidates: ScoredCandidate[] });
    },
    staleTime: 5 * 60 * 1000,
  });
  const suggestions = (data?.candidates ?? []).filter(c => !c.in_no_go_zone).slice(0, 5);

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    setErr(null);
    try {
      await createMoveRequest({
        bin_id: bin.id,
        move_type: 'relocation',
        scheduled_date: Math.floor(Date.now() / 1000) + 7 * 86400,
        reason_category: 'relocation_request',
        new_street: choice.street,
        new_city: choice.city,
        new_zip: choice.zip || '',
        new_latitude: choice.latitude ?? undefined,
        new_longitude: choice.longitude ?? undefined,
        notes: `${reason} → suggested destination (score ${choice.score}/100): ${choice.address}`,
      });
      queryClient.invalidateQueries({ queryKey: ['growth-candidates'] });
      onDone(`Relocation move created for Bin #${bin.bin_number} → ${choice.street}`);
      handleClose();
    } catch (e) {
      setErr(
        e instanceof MoveRequestConflictError
          ? 'This bin already has an open move — cancel or edit it first.'
          : 'Failed to create the move request.',
      );
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={backdropClass} onClick={handleClose} />
      <div className={containerClass}>
        <div className="modal-content modal-sm">
          <div className="p-5">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-500" />
              Relocate Bin #{bin.bin_number} to a better spot
            </p>
            <p className="text-xs text-gray-500 mt-1">{reason}</p>

            <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
              {isLoading && <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />}
              {!isLoading && suggestions.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> No scored candidate locations available.
                </p>
              )}
              {suggestions.map(c => (
                <button
                  key={c.id}
                  onClick={() => setChoice(c)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-fast focus:outline-none ${
                    choice?.id === c.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-9 h-6 rounded-lg font-bold text-white text-xs shrink-0 ${
                      c.score >= 60 ? 'bg-green-600' : c.score >= 35 ? 'bg-amber-500' : 'bg-gray-400'
                    }`}
                  >
                    {c.score}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-gray-900 truncate">{c.street}</span>
                    <span className="block text-[11px] text-gray-500">
                      {c.city} · nearest bin {c.nearest_bin_m >= 1200 ? '1.2km+' : `${c.nearest_bin_m}m`}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-fast focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!choice || submitting}
                className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-fast focus:outline-none"
              >
                {submitting ? 'Creating…' : 'Create relocation move'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
