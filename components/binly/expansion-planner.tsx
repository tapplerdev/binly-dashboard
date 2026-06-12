'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, TrendingUp, AlertTriangle, Loader2, Sparkles, ChevronRight,
  BarChart3, Target, ArrowUpRight, Package, Clock,
} from 'lucide-react';
import { fetchBinAnalytics } from '@/lib/api/bin-analytics';
import { getPotentialLocations } from '@/lib/api/potential-locations';
import { sendChatMessage, LocationRecommendation } from '@/lib/api/chat';

interface ExpansionArea {
  city: string;
  binCount: number;
  avgFill: number;
  criticalCount: number;
  avgDailyRate: number;
  capacityPressure: 'high' | 'medium' | 'low';
  recommendation: string;
  pendingLocations: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem('binly-auth-storage') || '{}')?.state?.token;
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

export function ExpansionPlanner() {
  const [suggestingCity, setSuggestingCity] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<LocationRecommendation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const { data: potentialLocations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ['potential-locations', 'active'],
    queryFn: () => getPotentialLocations('active'),
    staleTime: 5 * 60 * 1000,
  });

  // Build expansion analysis per area
  const expansionAreas = useMemo((): ExpansionArea[] => {
    if (!analyticsData) return [];

    const bins = analyticsData.bins;
    const areas = analyticsData.areas;

    // Count pending potential locations per city
    const pendingByCity: Record<string, number> = {};
    potentialLocations.forEach(loc => {
      const city = loc.city || 'Unknown';
      pendingByCity[city] = (pendingByCity[city] || 0) + 1;
    });

    return areas
      .map(area => {
        const areaBins = bins.filter(b => b.city === area.city);
        const avgDailyRate = areaBins.length > 0
          ? areaBins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / areaBins.length
          : 0;
        const criticalCount = areaBins.filter(b => b.estimated_current_fill >= 80).length;
        const avgFill = area.avg_fill_rate || area.avg_fill_percentage || 0;

        let capacityPressure: 'high' | 'medium' | 'low' = 'low';
        let recommendation = 'Coverage adequate — monitor trends';
        if (avgFill >= 60 || criticalCount >= 3) {
          capacityPressure = 'high';
          recommendation = `High demand — ${criticalCount} bins near capacity. Add more bins to this area.`;
        } else if (avgFill >= 40 || criticalCount >= 1) {
          capacityPressure = 'medium';
          recommendation = `Growing demand — avg ${Math.round(avgFill)}% fill. Plan expansion soon.`;
        }

        return {
          city: area.city,
          binCount: area.bin_count,
          avgFill: Math.round(avgFill),
          criticalCount,
          avgDailyRate: Math.round(avgDailyRate * 10) / 10,
          capacityPressure,
          recommendation,
          pendingLocations: pendingByCity[area.city] || 0,
        };
      })
      .sort((a, b) => {
        const pressureOrder = { high: 0, medium: 1, low: 2 };
        return pressureOrder[a.capacityPressure] - pressureOrder[b.capacityPressure] || b.avgFill - a.avgFill;
      });
  }, [analyticsData, potentialLocations]);

  const totalBins = analyticsData?.summary.total_bins || 0;
  const totalPending = potentialLocations.length;
  const highPressureCount = expansionAreas.filter(a => a.capacityPressure === 'high').length;
  const avgFleetFill = analyticsData?.summary.avg_fill_rate || 0;

  const handleAISuggest = async (city: string) => {
    setSuggestingCity(city);
    setAiError(null);
    setAiResults([]);
    try {
      const resp = await sendChatMessage(
        `Recommend 3 potential bin locations in ${city}. Focus on high-traffic commercial areas with good foot traffic.`,
        conversationId,
      );
      setConversationId(resp.conversation_id);
      if (resp.recommendations?.recommendations) {
        setAiResults(resp.recommendations.recommendations);
      } else {
        setAiError('No locations returned. Try a different area.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to get AI suggestions');
    } finally {
      setSuggestingCity(null);
    }
  };

  const isLoading = loadingAnalytics || loadingLocations;

  const pressureColors = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Expansion Planner
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Coverage analysis and AI-powered expansion recommendations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Active Bins</p>
          <p className="text-xl font-bold text-gray-900">{totalBins}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Fleet Avg Fill</p>
          <p className="text-xl font-bold text-gray-900">{avgFleetFill}%</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3">
          <p className="text-xs text-gray-500">High-Pressure Areas</p>
          <p className="text-xl font-bold text-red-600">{highPressureCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-blue-200 p-3">
          <p className="text-xs text-gray-500">Pending Locations</p>
          <p className="text-xl font-bold text-blue-600">{totalPending}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : expansionAreas.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No area data available yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expansionAreas.map(area => {
            const colors = pressureColors[area.capacityPressure];
            return (
              <div key={area.city} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">{area.city}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {area.capacityPressure} pressure
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {area.binCount} bins
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        {area.avgFill}% avg fill
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {area.avgDailyRate}%/day
                      </span>
                      {area.criticalCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          {area.criticalCount} critical
                        </span>
                      )}
                      {area.pendingLocations > 0 && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Clock className="w-3 h-3" />
                          {area.pendingLocations} pending
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">{area.recommendation}</p>
                  </div>

                  <button
                    onClick={() => handleAISuggest(area.city)}
                    disabled={suggestingCity !== null}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {suggestingCity === area.city ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    AI Suggest
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Results Panel */}
      {(aiResults.length > 0 || aiError) && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Recommended Locations
          </h3>

          {aiError && (
            <p className="text-xs text-red-600">{aiError}</p>
          )}

          {aiResults.length > 0 && (
            <div className="space-y-2">
              {aiResults.map((rec, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{rec.address}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.city} {rec.zip}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                      rec.score >= 7 ? 'bg-green-100 text-green-700' :
                      rec.score >= 5 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {rec.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-2">
                    <span>Nearest bin: #{rec.nearest_bin_number} ({rec.nearest_bin_distance_miles.toFixed(1)} mi)</span>
                    <span>Area fill: {rec.area_avg_fill_rate}%</span>
                    {rec.median_income && <span>Income: ${(rec.median_income / 1000).toFixed(0)}k</span>}
                  </div>
                  {rec.reasoning && (
                    <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2">{rec.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="text-[10px] text-gray-400 space-y-1">
        <p><strong>Capacity Pressure</strong> — based on average fill rate and number of bins at 80%+ fill</p>
        <p><strong>AI Suggest</strong> — uses fill rates, demographics, traffic, and POI density to recommend commercial locations</p>
      </div>
    </div>
  );
}
