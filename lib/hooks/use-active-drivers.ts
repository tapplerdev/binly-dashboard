import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useCentrifugo } from './use-centrifugo';
import { useAuthStore } from '@/lib/auth/store';
import { ActiveDriver, DriverLocation } from '../types/active-driver';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

export function useActiveDrivers() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch initial list of active drivers
  const { data: drivers, isLoading, error } = useQuery({
    queryKey: ['active-drivers'],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/manager/active-drivers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch active drivers: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();

      // Handle both direct array and wrapped response {data: [...], success: true}
      const rawData = Array.isArray(responseData) ? responseData : responseData.data || [];

      // Transform snake_case to camelCase
      const data: ActiveDriver[] = rawData.map((driver: Record<string, unknown>) => ({
        driverId: driver.driver_id || driver.driverId,
        driverName: driver.driver_name || driver.driverName || 'Unknown Driver',
        status: driver.status || 'inactive',
        shiftId: driver.shift_id || driver.shiftId,
        routeName: driver.route_id || driver.route_name || driver.routeName,
        totalBins: driver.total_bins || driver.totalBins || 0,
        completedBins: driver.completed_bins || driver.completedBins || 0,
        currentLocation: driver.current_location ? {
          driverId: driver.driver_id || driver.driverId,
          latitude: driver.current_location.latitude,
          longitude: driver.current_location.longitude,
          heading: driver.current_location.heading,
          speed: driver.current_location.speed,
          accuracy: driver.current_location.accuracy,
          timestamp: driver.current_location.timestamp?.toString() || new Date().toISOString(),
        } : null,
        startTime: driver.start_time || driver.startTime,
        lastLocationUpdate: driver.updated_at ? new Date(driver.updated_at * 1000).toISOString() : undefined,
      }));

      return data;
    },
    enabled: !!token,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
    staleTime: 10000, // Consider data fresh for 10 seconds
    placeholderData: [], // Provide placeholder data to prevent undefined
  });

  // Connect to the shared Centrifugo connection (singleton managed by CentrifugoProvider)
  const { subscribe, isConnected } = useCentrifugo();

  // Track currently subscribed driver IDs to avoid re-subscribing on location updates
  const subscribedDriverIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to all active driver location channels
  useEffect(() => {
    if (!drivers || drivers.length === 0 || !isConnected) {
      console.log('⏭️  [Centrifugo] Not ready to subscribe:');
      console.log('   Drivers:', drivers?.length || 0);
      console.log('   Connected:', isConnected);
      return;
    }

    const currentDriverIds = new Set(drivers.map(d => d.driverId));
    const previousDriverIds = subscribedDriverIdsRef.current;

    // Find drivers to subscribe to (new drivers)
    const driversToSubscribe = drivers.filter(d => !previousDriverIds.has(d.driverId));

    // Find drivers to unsubscribe from (drivers that left)
    const driverIdsToUnsubscribe = Array.from(previousDriverIds).filter(id => !currentDriverIds.has(id));

    // Only log if there are changes
    if (driversToSubscribe.length > 0 || driverIdsToUnsubscribe.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📡 [Centrifugo] Updating driver location subscriptions');
      console.log('   New drivers:', driversToSubscribe.length);
      console.log('   Removed drivers:', driverIdsToUnsubscribe.length);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    const unsubscribeFunctions: Array<() => void> = [];

    // Subscribe to new drivers only
    driversToSubscribe.forEach((driver) => {
      const channel = `driver:location:${driver.driverId}`;
      console.log(`   📍 Subscribing to ${driver.driverName} (${channel})`);

      const unsubscribe = subscribe(channel, (data: unknown) => {
        handleDriverLocationUpdate(data as Record<string, unknown>, driver.driverId);
      });

      unsubscribeFunctions.push(unsubscribe);
      subscribedDriverIdsRef.current.add(driver.driverId);
    });

    // Unsubscribe from drivers that left
    driverIdsToUnsubscribe.forEach((driverId) => {
      const channel = `driver:location:${driverId}`;
      console.log(`   🔄 Unsubscribing from ${channel}`);
      // Let the subscribe function handle unsubscribe via its return value
      subscribedDriverIdsRef.current.delete(driverId);
    });

    if (driversToSubscribe.length > 0) {
      console.log('✅ [Centrifugo] Subscription updates complete');
    }

    // Cleanup: only cleanup subscriptions we just created
    return () => {
      if (unsubscribeFunctions.length > 0) {
        console.log('🧹 [Centrifugo] Cleaning up new subscriptions...');
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      }
    };
  }, [drivers?.map(d => d.driverId).join(','), isConnected, subscribe]);

  const handleDriverLocationUpdate = (locationData: Record<string, unknown>, driverId: string) => {
    // Extract location data from Centrifugo message
    const latitude = locationData.latitude as number;
    const longitude = locationData.longitude as number;
    const heading = locationData.heading as number | undefined;
    const speed = locationData.speed as number | undefined;
    const accuracy = locationData.accuracy as number | undefined;
    const timestamp = locationData.timestamp as number;
    const shiftId = locationData.shift_id as string | undefined;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 [Centrifugo] Location Update Received');
    console.log('   Driver ID:', driverId);
    console.log('   Lat/Lng:', latitude, longitude);
    console.log('   Heading:', heading);
    console.log('   Speed:', speed);
    console.log('   Shift ID:', shiftId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    queryClient.setQueryData<ActiveDriver[]>(['active-drivers'], (old) => {
      if (!old || !Array.isArray(old)) {
        console.log('⚠️  No existing driver data in cache');
        return old;
      }

      console.log('📊 Current drivers in cache:', old.length);

      // Update the driver's location by driver_id (from channel name)
      const updatedDrivers = old.map((driver) => {
        if (driver.driverId === driverId) {
          console.log('✅ Found driver to update:', driver.driverName);
          return {
            ...driver,
            currentLocation: {
              driverId: driver.driverId,
              latitude,
              longitude,
              heading,
              speed,
              accuracy,
              timestamp: timestamp.toString(),
            },
            lastLocationUpdate: timestamp.toString(),
          };
        }
        return driver;
      });

      console.log('✅ Location update complete');
      return updatedDrivers;
    });
  };

  return {
    drivers: drivers || [], // Ensure drivers is always an array
    isLoading,
    error,
  };
}
