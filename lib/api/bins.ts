/**
 * Bins API service
 * Handles all bin-related API requests to the backend
 */

import { Bin } from '@/lib/types/bin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Fetch all bins from the backend
 * @returns Promise<Bin[]> Array of all bins
 */
export async function getBins(): Promise<Bin[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data for real-time updates
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bins: ${response.statusText}`);
    }

    const bins: Bin[] = await response.json();
    return bins;
  } catch (error) {
    console.error('Error fetching bins:', error);
    throw error;
  }
}

/**
 * Fetch a single bin by ID
 * @param id Bin ID
 * @returns Promise<Bin> Single bin object
 */
export async function getBinById(id: string): Promise<Bin> {
  try {
    const bins = await getBins();
    const bin = bins.find((b) => b.id === id);

    if (!bin) {
      throw new Error(`Bin with id ${id} not found`);
    }

    return bin;
  } catch (error) {
    console.error(`Error fetching bin ${id}:`, error);
    throw error;
  }
}

/**
 * Check/Collection record from the backend
 */
export interface BinCheck {
  id: number;
  binId: string;
  checkedFrom: string;
  fillPercentage: number | null;
  checkedOnIso: string;
  checkedOn: string;
  photoUrl: string | null;
  checkedBy: string | null;
  checkedByName: string | null;
}

/**
 * Fetch check history for a specific bin
 * @param binId Bin ID
 * @returns Promise<BinCheck[]> Array of check records (most recent first)
 */
export async function getBinChecks(binId: string): Promise<BinCheck[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins/${binId}/checks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bin checks: ${response.statusText}`);
    }

    const checks: BinCheck[] = await response.json();
    return checks;
  } catch (error) {
    console.error(`Error fetching checks for bin ${binId}:`, error);
    throw error;
  }
}

/**
 * Move record from the backend
 */
export interface BinMove {
  id: number;
  binId: string;
  movedFrom: string;
  movedTo: string;
  movedOnIso: string;
  movedOn: string;
}

/**
 * Fetch move history for a specific bin
 * @param binId Bin ID
 * @returns Promise<BinMove[]> Array of move records (most recent first)
 */
export async function getBinMoves(binId: string): Promise<BinMove[]> {
  try {
    const response = await fetch(`${API_URL}/api/bins/${binId}/moves`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch bin moves: ${response.statusText}`);
    }

    const moves: BinMove[] = await response.json();
    return moves;
  } catch (error) {
    console.error(`Error fetching moves for bin ${binId}:`, error);
    throw error;
  }
}
