/**
 * Shared placement types for the Create Potential Location flow.
 *
 * The queue is a single "basket" that BOTH input tabs feed: a manually entered
 * address (source 'manual') and an AI recommendation (source 'ai') land in the
 * same list and are submitted together. AI items carry the recommender's
 * enrichment — score, reasoning, and whether the spot is inside the target area
 * or a nearby profile-match.
 */

export type PlacementSource = 'manual' | 'ai';

/** Where an AI pick sits relative to the picked target area. */
export type Locality = 'in_area' | 'near_area';

export interface QueuedLocation {
  /** Stable id for React keys + removal (crypto.randomUUID in the client). */
  id: string;
  street: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  notes?: string;
  source: PlacementSource;

  // ---- AI-only enrichment (undefined for manual entries) ----
  score?: number;
  reasoning?: string;
  locality?: Locality;
  /** Miles past the target-area edge; 0 when inside. */
  distanceFromAreaMi?: number;
  /** 0..1 similarity to the target area's profile (near_area picks). */
  areaMatch?: number;
  /** Short area name this pick was generated for, e.g. "Brentwood". */
  areaLabel?: string;
}
