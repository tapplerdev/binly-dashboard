import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWebSocket, WebSocketMessage } from './use-websocket';
import { ActiveDriver, DriverLocation } from '../types/active-driver';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';
const WS_URL = BACKEND_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

interface UseActiveDriversOptions {
  token?: string;
  enabled?: boolean;
}

export function useActiveDrivers({ token, enabled = true }: UseActiveDriversOptions = {}) {
  const queryClient = useQueryClient();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚗 useActiveDrivers Hook Called');
  console.log('   Token:', token ? `${token.substring(0, 20)}...` : 'NONE');
  console.log('   Enabled:', enabled);
  console.log('   Backend URL:', BACKEND_URL);
  console.log('   WebSocket URL:', WS_URL);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Fetch initial list of active drivers
  const { data: drivers, isLoading, error } = useQuery({
    queryKey: ['active-drivers'],
    queryFn: async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📡 Fetching Active Drivers from API');
      console.log('   URL:', `${BACKEND_URL}/api/manager/active-drivers`);
      console.log('   Has Token:', !!token);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const response = await fetch(`${BACKEND_URL}/api/manager/active-drivers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      console.log('📡 API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        throw new Error(`Failed to fetch active drivers: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();
      console.log('✅ API Response:', responseData);

      // Handle both direct array and wrapped response {data: [...], success: true}
      const rawData = Array.isArray(responseData) ? responseData : responseData.data || [];

      // Transform snake_case to camelCase
      const data: ActiveDriver[] = rawData.map((driver: any) => ({
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

      console.log('✅ Active Drivers Fetched:', data.length, 'drivers');
      console.log('   Transformed Drivers:', data);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return data;
    },
    enabled,
    refetchInterval: 30000, // Refetch every 30 seconds as backup
    staleTime: 10000, // Consider data fresh for 10 seconds
    placeholderData: [], // Provide placeholder data to prevent undefined
  });

  const wsUrl = token ? `${WS_URL}/ws?token=${token}` : `${WS_URL}/ws`;
  console.log('🔌 Setting up WebSocket connection');
  console.log('   WebSocket URL:', wsUrl);

  // WebSocket connection for real-time updates
  const { status: wsStatus } = useWebSocket({
    url: wsUrl,
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message);
    },
    autoReconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
  });

  console.log('📊 Current State:');
  console.log('   Drivers Count:', drivers.length);
  console.log('   Loading:', isLoading);
  console.log('   Error:', error);
  console.log('   WebSocket Status:', wsStatus);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 Handling WebSocket Message');
    console.log('   Type:', message.type);
    console.log('   Data:', message.data);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    switch (message.type) {
      case 'driver:location':
      case 'driver_location_update': // Backend sends this format
        console.log('🚗 Processing driver location update...');
        handleDriverLocationUpdate(message.data);
        break;

      case 'shift:update':
      case 'shift_update': // Backend might send this format
        console.log('📋 Processing shift update...');
        handleShiftUpdate(message.data);
        break;

      case 'shift:started':
      case 'shift_started':
      case 'shift:paused':
      case 'shift_paused':
      case 'shift:resumed':
      case 'shift_resumed':
      case 'shift:ended':
      case 'shift_ended':
        console.log('🔄 Shift status changed, invalidating queries...');
        queryClient.invalidateQueries({ queryKey: ['active-drivers'] });
        break;

      default:
        console.log('⏭️  Ignoring message type:', message.type);
        break;
    }
  };

  const handleDriverLocationUpdate = (locationData: any) => {
    // Handle both snake_case (from backend) and camelCase
    const driverId = locationData.driver_id || locationData.driverId;
    const latitude = locationData.latitude;
    const longitude = locationData.longitude;
    const heading = locationData.heading;
    const speed = locationData.speed;
    const accuracy = locationData.accuracy;
    const timestamp = locationData.timestamp;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Updating Driver Location');
    console.log('   Driver ID:', driverId);
    console.log('   Lat/Lng:', latitude, longitude);
    console.log('   Heading:', heading);
    console.log('   Speed:', speed);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    queryClient.setQueryData<ActiveDriver[]>(['active-drivers'], (old) => {
      if (!old || !Array.isArray(old)) {
        console.log('⚠️  No existing driver data in cache');
        return old;
      }

      console.log('📊 Current drivers in cache:', old.length);
      const updatedDrivers = old.map((driver) => {
        if (driver.driverId === driverId) {
          console.log('✅ Found driver to update:', driver.driverName);
          return {
            ...driver,
            currentLocation: {
              driverId,
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

  const handleShiftUpdate = (shiftData: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Updating Shift Data');
    console.log('   Shift ID:', shiftData.shiftId);
    console.log('   Status:', shiftData.status);
    console.log('   Bins:', shiftData.completedBins, '/', shiftData.totalBins);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    queryClient.setQueryData<ActiveDriver[]>(['active-drivers'], (old) => {
      if (!old) {
        console.log('⚠️  No existing driver data in cache');
        return old;
      }

      const updatedDrivers = old.map((driver) => {
        if (driver.shiftId === shiftData.shiftId) {
          console.log('✅ Found shift to update for driver:', driver.driverName);
          return {
            ...driver,
            status: shiftData.status,
            completedBins: shiftData.completedBins,
            totalBins: shiftData.totalBins,
          };
        }
        return driver;
      });

      console.log('✅ Shift update complete');
      return updatedDrivers;
    });
  };

  return {
    drivers: drivers || [], // Ensure drivers is always an array
    isLoading,
    error,
    wsStatus,
  };
}
