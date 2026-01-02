export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: string;
}

export interface ActiveDriver {
  driverId: string;
  driverName: string;
  status: 'active' | 'paused' | 'inactive' | 'ended';
  shiftId: string;
  routeName?: string;
  totalBins?: number;
  completedBins?: number;
  currentLocation: DriverLocation | null;
  startTime?: string;
  lastLocationUpdate?: string;
}
