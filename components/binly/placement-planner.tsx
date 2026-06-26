'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { MapPin, TrendingUp, TrendingDown, Users, DollarSign, Sparkles, ChevronRight, X, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlacementOpportunities } from '@/lib/hooks/use-placement-opportunities';
import { CityOpportunity } from '@/lib/api/placement-opportunities';
import { sendChatMessage, LocationRecommendation } from '@/lib/api/chat';
import { useBins } from '@/lib/hooks/use-bins';
import { cn } from '@/lib/utils';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || '';
const DEFAULT_CENTER = { lat: 37.5, lng: -122.05 };
const DEFAULT_ZOOM = 10;

function getOpportunityColor(score: number): string {
  if (score >= 7) return '#22c55e'; // green
  if (score >= 4) return '#eab308'; // yellow
  return '#9ca3af'; // gray
}

function getOpportunityBg(label: string): string {
  if (label === 'high') return 'bg-green-100 text-green-800';
  if (label === 'moderate') return 'bg-yellow-100 text-yellow-800';
  return 'bg-gray-100 text-gray-700';
}

// Component that loads GeoJSON and renders city polygons on the map
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

  useEffect(() => {
    if (!map) return;

    // Clean up previous data layer
    if (dataLayerRef.current) {
      dataLayerRef.current.setMap(null);
    }

    const dataLayer = new google.maps.Data({ map });
    dataLayerRef.current = dataLayer;

    // Load GeoJSON
    dataLayer.loadGeoJson('/data/bay-area-cities.geojson', undefined, (features) => {
      // Style each polygon based on opportunity score
      dataLayer.setStyle((feature) => {
        const cityName = feature.getProperty('NAME') as string;
        const opp = opportunities.find(o => o.city.toLowerCase() === cityName?.toLowerCase());
        const isSelected = selectedCity?.toLowerCase() === cityName?.toLowerCase();
        const score = opp?.opportunity_score || 0;

        return {
          fillColor: opp ? getOpportunityColor(score) : '#e5e7eb',
          fillOpacity: isSelected ? 0.5 : 0.25,
          strokeColor: isSelected ? '#1d4ed8' : '#6b7280',
          strokeWeight: isSelected ? 3 : 1,
          clickable: true,
        };
      });
    });

    // Click handler
    const clickListener = dataLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const cityName = event.feature.getProperty('NAME') as string;
      if (cityName) onCityClick(cityName);
    });

    // Hover effect
    const mouseoverListener = dataLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
      dataLayer.overrideStyle(event.feature, { strokeWeight: 2, fillOpacity: 0.4 });
    });
    const mouseoutListener = dataLayer.addListener('mouseout', (event: google.maps.Data.MouseEvent) => {
      dataLayer.revertStyle(event.feature);
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(mouseoverListener);
      google.maps.event.removeListener(mouseoutListener);
      dataLayer.setMap(null);
    };
  }, [map, opportunities, selectedCity, onCityClick]);

  // Re-apply styles when selection changes
  useEffect(() => {
    if (!dataLayerRef.current) return;
    const dl = dataLayerRef.current;
    dl.setStyle((feature) => {
      const cityName = feature.getProperty('NAME') as string;
      const opp = opportunities.find(o => o.city.toLowerCase() === cityName?.toLowerCase());
      const isSelected = selectedCity?.toLowerCase() === cityName?.toLowerCase();
      const score = opp?.opportunity_score || 0;
      return {
        fillColor: opp ? getOpportunityColor(score) : '#e5e7eb',
        fillOpacity: isSelected ? 0.5 : 0.25,
        strokeColor: isSelected ? '#1d4ed8' : '#6b7280',
        strokeWeight: isSelected ? 3 : 1,
        clickable: true,
      };
    });
  }, [selectedCity, opportunities]);

  return null;
}

// Sidebar component
function PlannerSidebar({
  opportunities,
  selectedCity,
  onCitySelect,
  onClose,
  onGeneratePlacements,
  isGenerating,
  placements,
}: {
  opportunities: CityOpportunity[];
  selectedCity: CityOpportunity | null;
  onCitySelect: (city: string) => void;
  onClose: () => void;
  onGeneratePlacements: (city: string, count: number) => void;
  isGenerating: boolean;
  placements: LocationRecommendation[];
}) {
  if (selectedCity) {
    const c = selectedCity;
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{c.city}</h2>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getOpportunityBg(c.opportunity_label))}>
              {c.opportunity_label.charAt(0).toUpperCase() + c.opportunity_label.slice(1)} Opportunity
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Active Bins</div>
              <div className="text-xl font-bold">{c.bin_count}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Avg Fill Rate</div>
              <div className="text-xl font-bold flex items-center gap-1">
                {c.avg_fill_rate > 0 ? `${c.avg_fill_rate}%` : 'N/A'}
                {c.avg_fill_rate > 40 && <TrendingUp className="w-4 h-4 text-green-500" />}
                {c.avg_fill_rate > 0 && c.avg_fill_rate < 20 && <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Population</div>
              <div className="text-xl font-bold">{c.population > 0 ? `${Math.round(c.population/1000)}k` : 'N/A'}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Avg Income</div>
              <div className="text-xl font-bold">{c.median_income > 0 ? `$${Math.round(c.median_income/1000)}k` : 'N/A'}</div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-blue-600 font-medium">Opportunity Score</span>
              <span className="text-lg font-bold text-blue-700">{c.opportunity_score}/10</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${c.opportunity_score * 10}%` }} />
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="bg-purple-50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-700">AI Analysis</span>
            </div>
            <p className="text-sm text-purple-900">{c.reasoning}</p>
          </div>

          {/* Recommended bins */}
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs text-green-700 font-medium mb-1">Recommended Additional Bins</div>
            <div className="text-2xl font-bold text-green-800">{c.recommended_bins}</div>
          </div>

          {/* Top corridors */}
          {c.top_corridors.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-medium mb-2">Top Performing Corridors</div>
              <div className="space-y-1.5">
                {c.top_corridors.map((corridor, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>{corridor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Generate button */}
        <div className="mt-auto p-4 border-t">
          <Button
            onClick={() => onGeneratePlacements(c.city, c.recommended_bins)}
            disabled={isGenerating}
            className="w-full bg-[#4880FF] hover:bg-[#3a6ae0] text-white"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate {c.recommended_bins} Placements</>
            )}
          </Button>
          {placements.length > 0 && (
            <p className="text-xs text-center text-gray-500 mt-2">
              {placements.filter(p => p.city.toLowerCase() === c.city.toLowerCase()).length} placements shown on map
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: city list sorted by opportunity
  const sorted = [...opportunities].sort((a, b) => b.opportunity_score - a.opportunity_score);
  const totalRec = sorted.reduce((s, c) => s + c.recommended_bins, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Placement Planner</h2>
        <p className="text-sm text-gray-500">{sorted.length} cities analyzed</p>
      </div>

      {/* Summary */}
      <div className="p-4 border-b">
        <div className="bg-blue-50 rounded-xl p-3 mb-3">
          <div className="text-xs text-blue-600 font-medium">Total Recommended Bins</div>
          <div className="text-2xl font-bold text-blue-700">{totalRec}</div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded bg-green-500" /> High
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded bg-yellow-500" /> Moderate
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded bg-gray-400" /> Low
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{c.city}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getOpportunityBg(c.opportunity_label))}>
                  {c.opportunity_score}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {c.bin_count} bins{c.avg_fill_rate > 0 ? ` · ${c.avg_fill_rate}% fill` : ''} · +{c.recommended_bins} recommended
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Main placement planner component
export function PlacementPlanner({ onClose }: { onClose: () => void }) {
  const { data: opportunities, isLoading } = usePlacementOpportunities();
  const { data: bins } = useBins();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [placements, setPlacements] = useState<LocationRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedOpp = opportunities?.cities.find(
    c => c.city.toLowerCase() === selectedCity?.toLowerCase()
  ) || null;

  const handleCityClick = useCallback((city: string) => {
    setSelectedCity(prev => prev?.toLowerCase() === city.toLowerCase() ? null : city);
  }, []);

  const handleGeneratePlacements = useCallback(async (city: string, count: number) => {
    setIsGenerating(true);
    try {
      const result = await sendChatMessage(
        `recommend ${count} bin placements in ${city} using auto mode`
      );
      if (result.recommendations?.recommendations) {
        setPlacements(prev => {
          // Remove old placements for this city, add new ones
          const other = prev.filter(p => p.city.toLowerCase() !== city.toLowerCase());
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
        <PlannerSidebar
          opportunities={opportunities?.cities || []}
          selectedCity={selectedOpp}
          onCitySelect={handleCityClick}
          onClose={onClose}
          onGeneratePlacements={handleGeneratePlacements}
          isGenerating={isGenerating}
          placements={placements}
        />
      </div>

      {/* Map */}
      <div className="flex-1">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={DEFAULT_ZOOM}
            mapId={MAP_ID}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="w-full h-full"
          >
            {/* City polygon overlays */}
            <CityPolygonLayer
              opportunities={opportunities?.cities || []}
              selectedCity={selectedCity}
              onCityClick={handleCityClick}
            />

            {/* Existing bin markers */}
            {bins?.filter(b => b.latitude && b.longitude && b.status === 'active').map((bin) => (
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

            {/* Placement recommendation pins */}
            {placements.map((p, i) => (
              <AdvancedMarker
                key={`placement-${i}`}
                position={{ lat: p.latitude, lng: p.longitude }}
                title={`${p.address} — Score: ${p.score}`}
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-green-500 border-2 border-white shadow-lg flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{i + 1}</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 border border-white flex items-center justify-center">
                    <span className="text-[7px] font-bold">{p.score}</span>
                  </div>
                </div>
              </AdvancedMarker>
            ))}
          </GoogleMap>
        </APIProvider>
      </div>

      {/* Close button (top right) */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
