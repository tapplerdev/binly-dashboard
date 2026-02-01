/**
 * Config API service
 * Handles warehouse location configuration requests
 */

import { WarehouseLocation } from '@/lib/types/config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Fetch warehouse location from config
 * @returns Promise<WarehouseLocation> Current warehouse location
 */
export async function getWarehouseLocation(): Promise<WarehouseLocation> {
  try {
    const response = await fetch(`${API_URL}/api/config/warehouse`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch warehouse location: ${response.statusText}`);
    }

    const warehouse: WarehouseLocation = await response.json();
    return warehouse;
  } catch (error) {
    console.error('Error fetching warehouse location:', error);
    throw error;
  }
}

/**
 * Update warehouse location in config
 * @param location New warehouse location
 * @returns Promise<WarehouseLocation> Updated warehouse location
 */
export async function updateWarehouseLocation(
  location: WarehouseLocation
): Promise<WarehouseLocation> {
  try {
    const response = await fetch(`${API_URL}/api/config/warehouse`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update warehouse location');
    }

    const result = await response.json();
    return result.location;
  } catch (error) {
    console.error('Error updating warehouse location:', error);
    throw error;
  }
}
