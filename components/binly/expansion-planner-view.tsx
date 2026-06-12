'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  Target, MapPin, Sparkles, Loader2, Plus, TrendingUp, Package,
  AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { fetchBinAnalytics } from '@/lib/api/bin-analytics';
import { getPotentialLocations } from '@/lib/api/potential-locations';
import { sendChatMessage, LocationRecommendation } from '@/lib/api/chat';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

export function ExpansionPlannerView() {
  const { data: bins = [] } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestCity, setSuggestCity] = useState('');
  const [aiPins, setAiPins] = useState<LocationRecommendation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<LocationRecommendation | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  const { data: analyticsData } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const { data: potentialLocations = [] } = useQuery({
    queryKey: ['potential-locations', 'active'],
    queryFn: () => getPotentialLocations('active'),
    staleTime: 5 * 60 * 1000,
  });

  // Area stats derived from bins
  const areaStats = useMemo(() => {
    const analyticsBins = analyticsData?.bins || [];
    const cityMap: Record<string, typeof analyticsBins> = {};
    analyticsBins.forEach(b => {
      const city = b.city || 'Unknown';
      if (!cityMap[city]) cityMap[city] = [];
      cityMap[city].push(b);
    });

    const pendingByCity: Record<string, number> = {};
    potentialLocations.forEach(loc => {
      const city = loc.city || 'Unknown';
      pendingByCity[city] = (pendingByCity[city] || 0) + 1;
    });

    return Object.entries(cityMap)
      .map(([city, areaBins]) => {
        const avgFill = Math.round(areaBins.reduce((s, b) => s + b.estimated_current_fill, 0) / areaBins.length);
        const criticalCount = areaBins.filter(b => b.estimated_current_fill >= 80).length;
        return {
          city,
          binCount: areaBins.length,
          avgFill,
          criticalCount,
          pendingLocations: pendingByCity[city] || 0,
        };
      })
      .sort((a, b) => b.avgFill - a.avgFill);
  }, [analyticsData, potentialLocations]);

  // Get bins for a hovered area
  const highlightedCities = useMemo(() => {
    if (!hoveredArea) return new Set<string>();
    return new Set([hoveredArea]);
  }, [hoveredArea]);

  const handleAISuggest = async () => {
    if (!suggestCity.trim()) return;
    setSuggesting(true);
    setAiError(null);
    setAiPins([]);
    setSelectedPin(null);
    try {
      const resp = await sendChatMessage(
        `Recommend 5 potential bin locations in ${suggestCity}. Focus on high-traffic commercial areas.`,
        conversationId,
      );
      setConversationId(resp.conversation_id);
      if (resp.recommendations?.recommendations?.length) {
        setAiPins(resp.recommendations.recommendations);
      } else {
        setAiError('No locations found. Try a different area.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  const mappableBins = bins.filter(isMappableBin);
  const mappablePotentials = potentialLocations.filter(l => l.latitude && l.longitude);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Panel */}
      <div className="w-[380px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600" />
            Expansion Planner
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Find coverage gaps & plan new locations</p>
        </div>

        {/* AI Suggest */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={suggestCity}
              onChange={e => setSuggestCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAISuggest()}
              placeholder="City name (e.g. Sunnyvale)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
            />
            <button
              onClick={handleAISuggest}
              disabled={suggesting || !suggestCity.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Suggest
            </button>
          </div>
          {aiError && <p className="text-xs text-red-600 mt-2">{aiError}</p>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* AI Suggestion Results */}
          {aiPins.length > 0 && (
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                AI Suggestions ({aiPins.length})
              </h3>
              <div className="space-y-1.5">
                {aiPins.map((pin, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPin(selectedPin === pin ? null : pin)}
                    className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                      selectedPin === pin
                        ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                        : 'border-gray-200 bg-white hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{pin.address}</p>
                        <p className="text-[10px] text-gray-500">{pin.city} {pin.zip}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        pin.score >= 7 ? 'bg-emerald-100 text-emerald-700' :
                        pin.score >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {pin.score.toFixed(1)}
                      </span>
                    </div>
                    {selectedPin === pin && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                          <span>Nearest: #{pin.nearest_bin_number} ({pin.nearest_bin_distance_miles.toFixed(1)} mi)</span>
                          <span>Area fill: {pin.area_avg_fill_rate}%</span>
                        </div>
                        {pin.reasoning && (
                          <p className="text-[10px] text-gray-400">{pin.reasoning}</p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Area Coverage */}
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Coverage by Area</h3>
            <div className="space-y-1">
              {areaStats.map(area => (
                <div
                  key={area.city}
                  onMouseEnter={() => setHoveredArea(area.city)}
                  onMouseLeave={() => setHoveredArea(null)}
                  className={`rounded-lg border p-2.5 transition-all cursor-default ${
                    hoveredArea === area.city
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{area.city}</span>
                    <div className="flex items-center gap-2">
                      {area.criticalCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
                          <AlertTriangle className="w-3 h-3" />{area.criticalCount}
                        </span>
                      )}
                      {area.pendingLocations > 0 && (
                        <span className="text-[10px] text-blue-600 font-medium">
                          {area.pendingLocations} pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          area.avgFill >= 70 ? 'bg-red-500' :
                          area.avgFill >= 45 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(area.avgFill, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 w-12 text-right">
                      {area.avgFill}% · {area.binCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative">
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <Map
            mapId="expansion-planner-map"
            defaultCenter={warehouse ? { lat: warehouse.latitude, lng: warehouse.longitude } : DEFAULT_CENTER}
            defaultZoom={11}
            mapTypeId="hybrid"
            disableDefaultUI={false}
            streetViewControl={false}
            gestureHandling="greedy"
            style={{ width: '100%', height: '100%' }}
          >
            {/* Warehouse */}
            {warehouse && (
              <AdvancedMarker position={{ lat: warehouse.latitude, lng: warehouse.longitude }} zIndex={20}>
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-500">
                  <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
              </AdvancedMarker>
            )}

            {/* Existing bins */}
            {mappableBins.map(bin => {
              const isHighlighted = highlightedCities.size === 0 || highlightedCities.has(bin.city);
              return (
                <AdvancedMarker
                  key={bin.id}
                  position={{ lat: bin.latitude, lng: bin.longitude }}
                  zIndex={10}
                >
                  <div
                    className={`rounded-full border-2 border-white shadow flex items-center justify-center transition-all duration-200 ${
                      isHighlighted ? 'w-7 h-7' : 'w-5 h-5 opacity-30'
                    }`}
                    style={{ backgroundColor: getBinMarkerColor(bin.fill_percentage, bin.status) }}
                    title={`Bin #${bin.bin_number} — ${bin.fill_percentage ?? 0}%`}
                  >
                    {isHighlighted && (
                      <span className="text-[9px] font-bold text-white">{bin.bin_number}</span>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Pending potential locations */}
            {mappablePotentials.map(loc => (
              <AdvancedMarker
                key={loc.id}
                position={{ lat: loc.latitude!, lng: loc.longitude! }}
                zIndex={12}
              >
                <div
                  className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                  title={`Pending: ${loc.street}, ${loc.city}`}
                >
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </AdvancedMarker>
            ))}

            {/* AI suggestion pins */}
            {aiPins.map((pin, i) => (
              <AdvancedMarker
                key={`ai-${i}`}
                position={{ lat: pin.latitude, lng: pin.longitude }}
                zIndex={selectedPin === pin ? 18 : 16}
                onClick={() => setSelectedPin(selectedPin === pin ? null : pin)}
              >
                <div
                  className={`rounded-full border-2 shadow-lg flex items-center justify-center cursor-pointer transition-all ${
                    selectedPin === pin
                      ? 'w-10 h-10 bg-emerald-500 border-white ring-4 ring-emerald-300/50'
                      : 'w-8 h-8 bg-emerald-500 border-white hover:scale-110'
                  }`}
                  title={`AI: ${pin.address} (${pin.score.toFixed(1)})`}
                >
                  <Sparkles className={`text-white ${selectedPin === pin ? 'w-5 h-5' : 'w-4 h-4'}`} />
                </div>
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full border-2 border-white shadow" style={{ backgroundColor: '#22c55e' }} /> Existing bin
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" /> Pending location
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" /> AI suggestion
          </span>
        </div>
      </div>
    </div>
  );
}
