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
