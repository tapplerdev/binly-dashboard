'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import { createContext, useContext, useEffect, useState } from 'react';

interface MapProviderProps {
  children: React.ReactNode;
}

// Context for Places API
interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({
  isLoaded: false,
  loadError: undefined,
});

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within MapProvider');
  }
  return context;
}

export function MapProvider({ children }: MapProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    // Check if Google Maps is already loaded and has Places library
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsLoaded(true);
        return true;
      }
      return false;
    };

    // If already loaded, set immediately
    if (checkGoogleMaps()) {
      return;
    }

    // Otherwise, wait for it to load from APIProvider
    const interval = setInterval(() => {
      if (checkGoogleMaps()) {
        clearInterval(interval);
      }
    }, 100);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!checkGoogleMaps()) {
        setLoadError(new Error('Google Maps failed to load'));
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  if (!apiKey) {
    console.error(
      'Google Maps API key is missing. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.'
    );
    return <>{children}</>;
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      <APIProvider apiKey={apiKey} libraries={['places']}>
        {children}
      </APIProvider>
    </GoogleMapsContext.Provider>
  );
}
