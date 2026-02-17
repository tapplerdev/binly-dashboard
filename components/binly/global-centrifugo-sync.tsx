'use client';

/**
 * GlobalCentrifugoSync
 *
 * Mounts ONCE in the dashboard layout. Subscribes to company:events and
 * surgically updates the React Query cache for every event type.
 *
 * Because all consumers (useBins, useNoGoZones, usePotentialLocations, etc.)
 * share the same QueryClient, every component in the app — modals, tables,
 * maps, shift creators — automatically sees the latest state without polling.
 *
 * This component renders nothing (returns null).
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCentrifugo } from '@/lib/hooks/use-centrifugo';
import { binKeys } from '@/lib/hooks/use-bins';
import { zoneKeys } from '@/lib/hooks/use-zones';
import { potentialLocationKeys } from '@/lib/hooks/use-potential-locations';
import { Bin } from '@/lib/types/bin';
import { NoGoZone } from '@/lib/types/zone';
import { PotentialLocation } from '@/lib/api/potential-locations';

export function GlobalCentrifugoSync() {
  const queryClient = useQueryClient();
  const { subscribe, isConnected } = useCentrifugo();

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('company:events', (raw: unknown) => {
      const event = raw as { type: string; data: unknown };

      switch (event.type) {
        // ── Bin events ─────────────────────────────────────────────────────────

        case 'bin_updated': {
          // e.g. status flipped to 'missing' by a driver shift check
          const updatedBin = event.data as Bin;
          // Update the all-bins list cache
          queryClient.setQueryData<Bin[]>(
            binKeys.all,
            (old) => old?.map((b) => (b.id === updatedBin.id ? updatedBin : b)) ?? [updatedBin]
          );
          // Update the detail cache if it happens to be loaded
          queryClient.setQueryData<Bin>(binKeys.detail(updatedBin.id), updatedBin);
          break;
        }

        // ── No-Go Zone events ──────────────────────────────────────────────────

        case 'zone_created': {
          const newZone = event.data as NoGoZone;
          // Upsert into both cache variants used across the app
          const upsertZone = (old: NoGoZone[] | undefined) => {
            const filtered = old?.filter((z) => z.id !== newZone.id) ?? [];
            return [...filtered, newZone];
          };
          queryClient.setQueryData<NoGoZone[]>(zoneKeys.byStatus('active'), upsertZone);
          queryClient.setQueryData<NoGoZone[]>(zoneKeys.byStatus(undefined), upsertZone);
          break;
        }

        case 'zone_updated': {
          // Surviving zone gained score/radius after a merge — update in place
          const updatedZone = event.data as NoGoZone;
          const replaceZone = (old: NoGoZone[] | undefined) =>
            old?.map((z) => (z.id === updatedZone.id ? updatedZone : z)) ?? [updatedZone];
          queryClient.setQueryData<NoGoZone[]>(zoneKeys.byStatus('active'), replaceZone);
          queryClient.setQueryData<NoGoZone[]>(zoneKeys.byStatus(undefined), replaceZone);
          break;
        }

        case 'zone_merged': {
          const { consumed_zone_id } = event.data as {
            consumed_zone_id: string;
            surviving_zone_id: string;
          };
          // Live map: remove the consumed zone circle
          queryClient.setQueryData<NoGoZone[]>(
            zoneKeys.byStatus('active'),
            (old) => old?.filter((z) => z.id !== consumed_zone_id) ?? []
          );
          // Zones list view: mark as resolved+merged (keeps it in the resolved tab)
          queryClient.setQueryData<NoGoZone[]>(
            zoneKeys.byStatus(undefined),
            (old) =>
              old?.map((z) =>
                z.id === consumed_zone_id
                  ? { ...z, status: 'resolved' as const, resolution_type: 'merged' as const }
                  : z
              ) ?? []
          );
          break;
        }

        // ── Potential Location events ──────────────────────────────────────────

        case 'potential_location_created': {
          // Invalidate so the active list refetches (simpler than constructing the full object)
          queryClient.invalidateQueries({ queryKey: potentialLocationKeys.list('active') });
          break;
        }

        case 'potential_location_deleted': {
          const d = event.data as { location_id: string };
          // Remove from every status variant of the list cache
          const removeLocation = (old: PotentialLocation[] | undefined) =>
            old?.filter((loc) => loc.id !== d.location_id) ?? [];
          queryClient.setQueryData<PotentialLocation[]>(
            potentialLocationKeys.list('active'),
            removeLocation
          );
          queryClient.setQueryData<PotentialLocation[]>(
            potentialLocationKeys.list('converted'),
            removeLocation
          );
          break;
        }

        case 'potential_location_converted': {
          const d = event.data as { location_id: string };
          // Remove from active list immediately
          queryClient.setQueryData<PotentialLocation[]>(
            potentialLocationKeys.list('active'),
            (old) => old?.filter((loc) => loc.id !== d.location_id) ?? []
          );
          // Invalidate converted list so it reflects the new entry when viewed
          queryClient.invalidateQueries({ queryKey: potentialLocationKeys.list('converted') });
          // Invalidate bins so the new bin appears in the bins list/map
          queryClient.invalidateQueries({ queryKey: binKeys.all });
          break;
        }

        default:
          break;
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, queryClient]);

  return null;
}
