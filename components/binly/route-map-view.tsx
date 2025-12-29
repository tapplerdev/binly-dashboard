'use client';

import { useEffect, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Route } from '@/lib/types/route';
import { getBins } from '@/lib/api/bins';
import { Bin, isMappableBin } from '@/lib/types/bin';

// Default map center (San Jose, CA area)
const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };
const DEFAULT_ZOOM = 10;

interface RouteMapViewProps {
  route: Route;
}

// Polyline Component - Must be child of Map to use useMap
interface RoutePolylineProps {
  bins: Bin[];
}

function RoutePolyline({ bins }: RoutePolylineProps) {
  const map = useMap();
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || bins.length === 0) return;

    async function fetchMapboxRoute() {
      try {
        // Build coordinates string for Mapbox (lng,lat format)
        const coordinates = bins.map(bin => `${bin.longitude},${bin.latitude}`).join(';');

        // Mapbox Directions API endpoint
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=pk.eyJ1IjoiYmlubHl5YWkiLCJhIjoiY21pNzN4bzlhMDVheTJpcHdqd2FtYjhpeSJ9.sQM8WHE2C9zWH0xG107xhw`;

        const response = await fetch(mapboxUrl);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          // Convert Mapbox GeoJSON coordinates to Google Maps LatLng
          const path = data.routes[0].geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1], // GeoJSON is [lng, lat]
            lng: coord[0],
          }));

          // Create pulsing polyline following roads
          const line = new google.maps.Polyline({
            path: path,
            geodesic: false,
            strokeColor: '#4880FF',
            strokeOpacity: 1,
            strokeWeight: 4,
            map: map,
          });

          setPolyline(line);

          // Fit map bounds to show all bins with more padding to zoom out
          const bounds = new google.maps.LatLngBounds();
          bins.forEach(bin => {
            bounds.extend({ lat: bin.latitude, lng: bin.longitude });
          });
          map.fitBounds(bounds, { padding: 150 });

          // Animate the polyline (pulsing opacity and thickness)
          let opacity = 1;
          let opacityDirection = -0.005;
          let strokeWeight = 4;
          let weightDirection = -0.03;

          const animatePolyline = () => {
            // Pulsing opacity
            opacity += opacityDirection;
            if (opacity <= 0.5 || opacity >= 1) {
              opacityDirection *= -1;
            }

            // Pulsing stroke weight
            strokeWeight += weightDirection;
            if (strokeWeight <= 3 || strokeWeight >= 5) {
              weightDirection *= -1;
            }

            line.setOptions({
              strokeOpacity: opacity,
              strokeWeight: strokeWeight,
            });

            requestAnimationFrame(animatePolyline);
          };
          animatePolyline();
        } else {
          console.error('Mapbox Directions failed:', data);
        }
      } catch (error) {
        console.error('Error fetching Mapbox route:', error);
      }
    }

    fetchMapboxRoute();

    return () => {
      if (polyline) {
        polyline.setMap(null);
      }
    };
  }, [map, bins]);

  return null;
}

export function RouteMapView({ route }: RouteMapViewProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);

  // Load bins and filter to route's bins
  useEffect(() => {
    async function loadRouteBins() {
      try {
        setLoading(true);
        const allBins = await getBins();
        console.log('All bins from backend:', allBins.length);
        console.log('First 5 bin IDs from backend:', allBins.slice(0, 5).map(b => b.id));
        console.log('First 5 bins with coords:', allBins.slice(0, 5).map(b => ({ id: b.id, lat: b.latitude, lng: b.longitude })));
        console.log('Route bin IDs we are looking for:', route.bin_ids);

        // Filter to only bins in this route
        const routeBins = allBins.filter(bin =>
          route.bin_ids.includes(bin.id) && isMappableBin(bin)
        );

        console.log('Filtered mappable bins for route:', routeBins.length, routeBins);

        // Also check bins that match ID but don't have coordinates
        const matchingBinsNoCoords = allBins.filter(bin =>
          route.bin_ids.includes(bin.id) && !isMappableBin(bin)
        );
        console.log('Matching bins WITHOUT coordinates:', matchingBinsNoCoords.length, matchingBinsNoCoords);
        setBins(routeBins);
      } catch (error) {
        console.error('Failed to load route bins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRouteBins();
  }, [route.bin_ids]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">Loading route map...</p>
        </div>
      </div>
    );
  }

  if (bins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p className="text-sm text-gray-600 mb-1">No mappable bins in this route</p>
          <p className="text-xs text-gray-500">Assign bins with valid coordinates</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
      <Map
        defaultCenter={DEFAULT_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId="binly-route-view"
        gestureHandling="none"
        disableDefaultUI={true}
        className="w-full h-full rounded-lg"
        mapTypeId="roadmap"
      >
        {/* Route Polyline with Animation */}
        <RoutePolyline bins={bins} />

        {/* Bin Markers */}
        {bins.map((bin, index) => {
          const isFirst = index === 0;
          const isLast = index === bins.length - 1;

          return (
            <AdvancedMarker
              key={bin.id}
              position={{ lat: bin.latitude, lng: bin.longitude }}
            >
              <div className="relative">
                {/* Numbered marker */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg ${
                    isFirst ? 'bg-green-600 ring-4 ring-green-200' :
                    isLast ? 'bg-red-600 ring-4 ring-red-200' :
                    'bg-primary'
                  }`}
                  title={`Stop ${index + 1}: Bin #${bin.bin_number}`}
                >
                  {index + 1}
                </div>

                {/* Label for first/last */}
                {(isFirst || isLast) && (
                  <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold ${
                    isFirst ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {isFirst ? 'START' : 'END'}
                  </div>
                )}
              </div>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}
