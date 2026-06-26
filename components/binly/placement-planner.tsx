'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { TrendingUp, TrendingDown, Users, DollarSign, Sparkles, ChevronRight, ChevronLeft, X, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlacementOpportunities } from '@/lib/hooks/use-placement-opportunities';
import { CityOpportunity } from '@/lib/api/placement-opportunities';
import { sendChatMessage, LocationRecommendation } from '@/lib/api/chat';
import { useBins } from '@/lib/hooks/use-bins';
import { cn } from '@/lib/utils';

const DEFAULT_CENTER = { lat: 37.5, lng: -122.05 };
const DEFAULT_ZOOM = 10;

function getOpportunityColor(score: number): string {
  if (score >= 5) return '#22c55e'; // green — high
  if (score >= 3) return '#eab308'; // yellow — moderate
  return '#9ca3af'; // gray — low
}

function getOpportunityBg(label: string): string {
  if (label === 'high') return 'bg-green-100 text-green-800';
  if (label === 'moderate') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-700';
}

// Renders city polygons + handles click + hover
function CityPolygonLayer({
  opportunities,
  selectedCity,
  onCityClick,
}: {
  opportunities: CityOpportunity[];
  selectedCity: string | null;
  onCityClick: (city: string) => void;
}) {
  const map = useMap();
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const listenersRef = useRef<google.maps.MapsEventListener[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clean up
    if (dataLayerRef.current) {
      dataLayerRef.current.setMap(null);
    }
    listenersRef.current.forEach(l => google.maps.event.removeListener(l));
    listenersRef.current = [];

    const dataLayer = new google.maps.Data({ map });
    dataLayerRef.current = dataLayer;

    const applyStyles = () => {
      dataLayer.setStyle((feature) => {
        const cityName = feature.getProperty('NAME') as string;
        const opp = opportunities.find(o => o.city === cityName);
        const isSelected = selectedCity === cityName;
        const score = opp?.opportunity_score || 0;

        return {
          fillColor: opp ? getOpportunityColor(score) : '#d1d5db',
          fillOpacity: isSelected ? 0.55 : (opp ? 0.35 : 0.1),
          strokeColor: isSelected ? '#1d4ed8' : (opp ? '#374151' : '#9ca3af'),
          strokeWeight: isSelected ? 3 : 1,
          clickable: true,
        };
      });
    };

    // Load GeoJSON
    dataLayer.loadGeoJson('/data/bay-area-cities.geojson', undefined, () => {
      applyStyles();
    });

    // Click
    listenersRef.current.push(
      dataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
        const cityName = event.feature.getProperty('NAME') as string;
        if (cityName) onCityClick(cityName);
      })
    );

    // Hover
    listenersRef.current.push(
      dataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
        dataLayer.overrideStyle(event.feature, { strokeWeight: 2, fillOpacity: 0.45 });
        map.getDiv().style.cursor = 'pointer';
      })
    );
    listenersRef.current.push(
      dataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
        dataLayer.revertStyle(event.feature);
        map.getDiv().style.cursor = '';
      })
    );

    return () => {
      listenersRef.current.forEach(l => google.maps.event.removeListener(l));
      listenersRef.current = [];
      dataLayer.setMap(null);
    };
  }, [map, opportunities, onCityClick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply styles when selection changes
  useEffect(() => {
    if (!dataLayerRef.current) return;
    dataLayerRef.current.setStyle((feature) => {
      const cityName = feature.getProperty('NAME') as string;
      const opp = opportunities.find(o => o.city === cityName);
      const isSelected = selectedCity === cityName;
      const score = opp?.opportunity_score || 0;
      return {
        fillColor: opp ? getOpportunityColor(score) : '#d1d5db',
        fillOpacity: isSelected ? 0.55 : (opp ? 0.35 : 0.1),
        strokeColor: isSelected ? '#1d4ed8' : (opp ? '#374151' : '#9ca3af'),
        strokeWeight: isSelected ? 3 : 1,
        clickable: true,
      };
    });
  }, [selectedCity, opportunities]);

  return null;
}

// Zooms map to a city when selected
function MapController({ selectedCity, opportunities }: { selectedCity: string | null; opportunities: CityOpportunity[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedCity) {
      const opp = opportunities.find(o => o.city === selectedCity);
      if (opp && opp.center_lat && opp.center_lng) {
        map.panTo({ lat: opp.center_lat, lng: opp.center_lng });
        map.setZoom(13);
      }
    } else {
      map.panTo(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }, [map, selectedCity, opportunities]);

  return null;
}

// City label markers (floating text on polygons at overview zoom)
function CityLabels({ opportunities, selectedCity }: { opportunities: CityOpportunity[]; selectedCity: string | null }) {
  if (selectedCity) return null; // Hide labels when drilled down

  return (
    <>
      {opportunities.map((opp) => (
        opp.center_lat && opp.center_lng ? (
          <AdvancedMarker
            key={`label-${opp.city}`}
            position={{ lat: opp.center_lat, lng: opp.center_lng }}
            zIndex={0}
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border pointer-events-none">
              <div className="text-xs font-semibold text-gray-800">{opp.city}</div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getOpportunityColor(opp.opportunity_score) }}
                />
                <span className="text-[10px] text-gray-600">
                  {opp.bin_count} bins · {opp.opportunity_score}
                </span>
              </div>
            </div>
          </AdvancedMarker>
        ) : null
      ))}
    </>
  );
}

// City detail sidebar (Mode 2)
function CityDetailSidebar({
  city,
  onBack,
  onClose,
  onGenerate,
  isGenerating,
  placementCount,
}: {
  city: CityOpportunity;
  onBack: () => void;
  onClose: () => void;
  onGenerate: (city: string, count: number) => void;
  isGenerating: boolean;
  placementCount: number;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{city.city}</h2>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getOpportunityBg(city.opportunity_label))}>
            {city.opportunity_label.charAt(0).toUpperCase() + city.opportunity_label.slice(1)} Opportunity
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Active Bins</div>
            <div className="text-xl font-bold">{city.bin_count}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Avg Fill Rate</div>
            <div className="text-xl font-bold flex items-center gap-1">
              {city.avg_fill_rate > 0 ? `${city.avg_fill_rate}%` : 'N/A'}
              {city.avg_fill_rate > 40 && <TrendingUp className="w-4 h-4 text-green-500" />}
              {city.avg_fill_rate > 0 && city.avg_fill_rate < 20 && <TrendingDown className="w-4 h-4 text-red-500" />}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Population</div>
            <div className="text-xl font-bold">{city.population > 0 ? `${Math.round(city.population / 1000)}k` : '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Avg Income</div>
            <div className="text-xl font-bold">{city.median_income > 0 ? `$${Math.round(city.median_income / 1000)}k` : '—'}</div>
          </div>
        </div>

        {/* Score bar */}
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-600 font-medium">Opportunity Score</span>
            <span className="text-lg font-bold text-blue-700">{city.opportunity_score}/10</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${city.opportunity_score * 10}%` }} />
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="bg-purple-50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-medium text-purple-700">AI Analysis</span>
          </div>
          <p className="text-sm text-purple-900 leading-relaxed">{city.reasoning}</p>
        </div>

        {/* Recommended bins */}
        <div className="bg-green-50 rounded-xl p-3">
          <div className="text-xs text-green-700 font-medium mb-1">Recommended Additional Bins</div>
          <div className="text-2xl font-bold text-green-800">{city.recommended_bins}</div>
        </div>

        {/* Top corridors */}
        {city.top_corridors.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 font-medium mb-2">Top Performing Corridors</div>
            <div className="space-y-1.5">
              {city.top_corridors.map((corridor, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span>{corridor}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="p-4 border-t">
        <Button
          onClick={() => onGenerate(city.city, city.recommended_bins)}
          disabled={isGenerating}
          className="w-full bg-[#4880FF] hover:bg-[#3a6ae0] text-white"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Placements...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generate {city.recommended_bins} Placements</>
          )}
        </Button>
        {placementCount > 0 && (
          <p className="text-xs text-center text-green-600 mt-2 font-medium">
            {placementCount} placements shown on map
          </p>
        )}
      </div>
    </div>
  );
}

// Overview sidebar (Mode 1) — ranked city list
function OverviewSidebar({
  opportunities,
  onCitySelect,
  onClose,
  totalRecommended,
  allocationReasoning,
}: {
  opportunities: CityOpportunity[];
  onCitySelect: (city: string) => void;
  onClose: () => void;
  totalRecommended: number;
  allocationReasoning: string;
}) {
  const sorted = [...opportunities].sort((a, b) => b.opportunity_score - a.opportunity_score);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Placement Planner</h2>
            <p className="text-sm text-gray-500">{sorted.length} cities analyzed</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b space-y-3">
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="text-xs text-blue-600 font-medium">Total Recommended Bins</div>
          <div className="text-2xl font-bold text-blue-700">{totalRecommended}</div>
        </div>
        {allocationReasoning && (
          <p className="text-xs text-gray-600 leading-relaxed">{allocationReasoning}</p>
        )}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} /> High
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#eab308' }} /> Moderate
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#9ca3af' }} /> Low
          </div>
        </div>
      </div>

      {/* City list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((c) => (
          <button
            key={c.city}
            onClick={() => onCitySelect(c.city)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 border-b text-left transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-3 h-8 rounded-sm flex-shrink-0"
                style={{ backgroundColor: getOpportunityColor(c.opportunity_score) }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{c.city}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getOpportunityBg(c.opportunity_label))}>
                    {c.opportunity_score}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {c.bin_count} bins{c.avg_fill_rate > 0 ? ` · ${c.avg_fill_rate}% fill` : ''}{c.recommended_bins > 0 ? ` · +${c.recommended_bins} recommended` : ''}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Main placement planner
export function PlacementPlanner({ onClose }: { onClose: () => void }) {
  const { data: opportunities, isLoading } = usePlacementOpportunities();
  const { data: bins } = useBins();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [placements, setPlacements] = useState<LocationRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedOpp = opportunities?.cities.find(
    c => c.city === selectedCity
  ) || null;

  // Only show bin markers for the selected city (Mode 2)
  const visibleBins = selectedCity
    ? bins?.filter(b => b.latitude && b.longitude && b.status === 'active' && b.city?.toLowerCase() === selectedCity.toLowerCase())
    : [];

  const cityPlacementCount = selectedCity
    ? placements.filter(p => p.city?.toLowerCase() === selectedCity.toLowerCase()).length
    : 0;

  const handleCityClick = useCallback((city: string) => {
    setSelectedCity(prev => prev === city ? null : city);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedCity(null);
  }, []);

  const handleGeneratePlacements = useCallback(async (city: string, count: number) => {
    setIsGenerating(true);
    try {
      const result = await sendChatMessage(
        `recommend ${count} bin placements in ${city} using auto mode`
      );
      if (result.recommendations?.recommendations) {
        setPlacements(prev => {
          const other = prev.filter(p => p.city?.toLowerCase() !== city.toLowerCase());
          return [...other, ...result.recommendations!.recommendations];
        });
      }
    } catch (err) {
      console.error('Failed to generate placements:', err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#4880FF] mx-auto mb-3" />
          <p className="text-sm text-gray-500">Analyzing placement opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex">
      {/* Sidebar */}
      <div className="w-[360px] border-r bg-white flex-shrink-0 overflow-hidden flex flex-col">
        {selectedOpp ? (
          <CityDetailSidebar
            city={selectedOpp}
            onBack={handleBack}
            onClose={onClose}
            onGenerate={handleGeneratePlacements}
            isGenerating={isGenerating}
            placementCount={cityPlacementCount}
          />
        ) : (
          <OverviewSidebar
            opportunities={opportunities?.cities || []}
            onCitySelect={handleCityClick}
            onClose={onClose}
            totalRecommended={opportunities?.total_recommended || 0}
            allocationReasoning={opportunities?.allocation_reasoning || ''}
          />
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <GoogleMap
            mapId="placement-planner-map"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            gestureHandling="greedy"
            disableDefaultUI={false}
            zoomControl={true}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            {/* City polygon overlays */}
            <CityPolygonLayer
              opportunities={opportunities?.cities || []}
              selectedCity={selectedCity}
              onCityClick={handleCityClick}
            />

            {/* Map zoom controller */}
            <MapController
              selectedCity={selectedCity}
              opportunities={opportunities?.cities || []}
            />

            {/* City labels (overview mode only) */}
            <CityLabels
              opportunities={opportunities?.cities || []}
              selectedCity={selectedCity}
            />

            {/* Bin markers (city mode only) */}
            {visibleBins?.map((bin) => (
              <AdvancedMarker
                key={bin.id}
                position={{ lat: bin.latitude!, lng: bin.longitude! }}
                title={`Bin #${bin.bin_number} — ${bin.fill_percentage}% fill`}
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">{bin.bin_number}</span>
                </div>
              </AdvancedMarker>
            ))}

            {/* Placement recommendation pins (city mode only) */}
            {selectedCity && placements
              .filter(p => p.city?.toLowerCase() === selectedCity.toLowerCase())
              .map((p, i) => (
                <AdvancedMarker
                  key={`placement-${i}`}
                  position={{ lat: p.latitude, lng: p.longitude }}
                  title={`${p.address} — Score: ${p.score}`}
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                    <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full px-1 border border-white shadow">
                      <span className="text-[8px] font-bold">{p.score}</span>
                    </div>
                  </div>
                </AdvancedMarker>
              ))}
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
}
