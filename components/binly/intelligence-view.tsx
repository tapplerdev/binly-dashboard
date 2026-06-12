'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  Brain, AlertTriangle, Calendar, Check, X, Clock, Loader2,
  Sparkles, ChevronDown, ChevronUp, Route, Package, TrendingUp,
} from 'lucide-react';
import { useBins } from '@/lib/hooks/use-bins';
import { useWarehouseLocation } from '@/lib/hooks/use-warehouse';
import { Bin, isMappableBin, getBinMarkerColor } from '@/lib/types/bin';
import { fetchBinAnalytics, BinPerformance } from '@/lib/api/bin-analytics';
import {
  getRecommendations, acceptRecommendation, dismissRecommendation,
  snoozeRecommendation, AIRecommendation,
} from '@/lib/api/ai-recommendations';

const DEFAULT_CENTER = { lat: 37.3382, lng: -121.8863 };

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem('binly-auth-storage') || '{}')?.state?.token;
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

interface RouteTemplate {
  id: string;
  name: string;
  bin_count: number;
  geographic_area: string;
  estimated_duration_hours: number;
}

async function fetchRoutes(): Promise<RouteTemplate[]> {
  const resp = await fetch(`${API_URL}/api/routes`, { headers: getAuthHeaders() });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : data.data || data.routes || [];
}

// Day names
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

interface DayPlan {
  date: Date;
  dayName: string;
  dayShort: string;
  routes: Array<{
    route: RouteTemplate;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    criticalBins: number;
    avgFill: number;
    reason: string;
    binIds: string[]; // IDs of bins in this area for map highlighting
  }>;
  isToday: boolean;
  isPast: boolean;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function IntelligenceView() {
  const queryClient = useQueryClient();
  const { data: bins = [] } = useBins();
  const { data: warehouse } = useWarehouseLocation();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hoveredRecId, setHoveredRecId] = useState<string | null>(null);
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [tab, setTab] = useState<'week' | 'alerts'>('alerts');

  const { data: analyticsData } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes-list'],
    queryFn: fetchRoutes,
    staleTime: 5 * 60 * 1000,
  });

  const { data: recsData, refetch: refetchRecs } = useQuery({
    queryKey: ['ai-recommendations', 'pending'],
    queryFn: () => getRecommendations('pending'),
    refetchInterval: 60000,
  });

  const recommendations = recsData?.recommendations || [];
  const pendingCount = recsData?.counts?.pending || 0;

  // Weekly plan
  const weekDates = useMemo(() => getWeekDates(), []);
  const weeklyPlan = useMemo((): DayPlan[] => {
    const analyticsBins = analyticsData?.bins || [];
    const avgFleetRate = analyticsData?.summary?.avg_fill_rate || 0;

    const plan: DayPlan[] = weekDates.map((date, i) => ({
      date,
      dayName: dayNames[i],
      dayShort: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      routes: [],
      isToday: date.toDateString() === new Date().toDateString(),
      isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
    }));

    if (analyticsBins.length === 0 || routes.length === 0) return plan;

    // Score routes by area match
    const routeScores = routes.map(route => {
      const area = (route.geographic_area || '').toLowerCase();
      const routeBins = area
        ? analyticsBins.filter(b => (b.city || '').toLowerCase() === area)
        : [];

      if (routeBins.length === 0) {
        return { route, score: 0.1, criticalBins: 0, avgFill: 0, daysToFull: 999, binIds: [] as string[] };
      }

      const avgFill = routeBins.reduce((s, b) => s + b.estimated_current_fill, 0) / routeBins.length;
      const avgRate = routeBins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / routeBins.length;
      const criticalBins = routeBins.filter(b => b.estimated_current_fill >= 80).length;
      const daysToFull = avgRate > 0 ? (80 - avgFill) / avgRate : 999;
      const score = criticalBins * 10 + avgFill * 0.5 + (avgRate > avgFleetRate * 2 ? 20 : 0);

      return {
        route, score, criticalBins, avgFill: Math.round(avgFill), daysToFull,
        binIds: routeBins.map(b => b.id),
      };
    }).sort((a, b) => b.score - a.score);

    const workDays = [0, 1, 2, 3, 4];
    routeScores.forEach((rs, idx) => {
      if (rs.score <= 0) return;

      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let reason = 'Routine collection';
      if (rs.criticalBins >= 3 || rs.daysToFull <= 1) {
        urgency = 'critical';
        reason = `${rs.criticalBins} bins at critical fill`;
      } else if (rs.criticalBins >= 1 || rs.daysToFull <= 3) {
        urgency = 'high';
        reason = `${rs.criticalBins} critical, avg ${rs.avgFill}% fill`;
      } else if (rs.avgFill >= 50) {
        urgency = 'medium';
        reason = `Avg fill ${rs.avgFill}%`;
      } else {
        reason = `Low urgency — avg ${rs.avgFill}%`;
      }

      let targetDay = urgency === 'critical' ? workDays[0]
        : urgency === 'high' ? workDays[Math.min(idx, workDays.length - 1)]
        : workDays[Math.min(idx + 2, workDays.length - 1)];

      while (targetDay < workDays.length && plan[targetDay].isPast) targetDay++;
      if (targetDay >= 7) return;

      plan[targetDay].routes.push({
        route: rs.route,
        urgency,
        criticalBins: rs.criticalBins,
        avgFill: rs.avgFill,
        reason,
        binIds: rs.binIds,
      });
    });

    return plan;
  }, [analyticsData, routes, weekDates]);

  // Determine which bin IDs to highlight on map
  const highlightedBinIds = useMemo(() => {
    const ids = new Set<string>();

    // From selected day in weekly plan
    if (tab === 'week' && selectedDay !== null) {
      weeklyPlan[selectedDay]?.routes.forEach(r => r.binIds.forEach(id => ids.add(id)));
    }

    // From hovered recommendation
    if (tab === 'alerts' && hoveredRecId) {
      const rec = recommendations.find(r => r.id === hoveredRecId);
      if (rec?.entity_id) {
        ids.add(rec.entity_id);
      }
    }

    return ids;
  }, [tab, selectedDay, weeklyPlan, hoveredRecId, recommendations]);

  // Recommendation actions
  const handleAccept = useCallback(async (id: string) => {
    setActingOnId(id);
    try {
      await acceptRecommendation(id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      refetchRecs();
    } catch { /* ignore */ }
    setActingOnId(null);
  }, [queryClient, refetchRecs]);

  const handleDismiss = useCallback(async (id: string) => {
    setActingOnId(id);
    try {
      await dismissRecommendation(id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      refetchRecs();
    } catch { /* ignore */ }
    setActingOnId(null);
  }, [queryClient, refetchRecs]);

  const handleSnooze = useCallback(async (id: string) => {
    setActingOnId(id);
    try {
      await snoozeRecommendation(id);
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
      refetchRecs();
    } catch { /* ignore */ }
    setActingOnId(null);
  }, [queryClient, refetchRecs]);

  // Urgency colors
  const urgencyStyle: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-50',
    high: 'border-l-orange-500 bg-orange-50',
    medium: 'border-l-blue-500 bg-blue-50',
    low: 'border-l-gray-300 bg-gray-50',
  };

  const severityStyle: Record<string, { dot: string; text: string }> = {
    critical: { dot: 'bg-red-500', text: 'text-red-700' },
    high: { dot: 'bg-orange-500', text: 'text-orange-700' },
    medium: { dot: 'bg-blue-500', text: 'text-blue-700' },
    low: { dot: 'bg-gray-400', text: 'text-gray-600' },
  };

  const mappableBins = bins.filter(isMappableBin);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left Panel */}
      <div className="w-[420px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            Intelligence
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Weekly plan & AI alerts</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setTab('alerts'); setSelectedDay(null); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              tab === 'alerts'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            AI Alerts
            {pendingCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setTab('week'); setHoveredRecId(null); }}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              tab === 'week'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            This Week
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'alerts' ? (
            /* AI Alerts Tab */
            <div className="p-3 space-y-2">
              {recommendations.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No pending alerts</p>
                  <p className="text-xs text-gray-400 mt-1">AI agent checks every 30 min</p>
                </div>
              ) : (
                recommendations.map(rec => {
                  const sev = severityStyle[rec.severity] || severityStyle.medium;
                  const isExpanded = expandedRecId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      onMouseEnter={() => setHoveredRecId(rec.id)}
                      onMouseLeave={() => setHoveredRecId(null)}
                      className={`rounded-lg border border-gray-200 p-3 transition-all cursor-pointer ${
                        hoveredRecId === rec.id ? 'ring-2 ring-indigo-200 bg-indigo-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Severity + Title */}
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold uppercase ${sev.text}`}>
                              {rec.severity}
                            </span>
                            <span className="text-[10px] text-gray-400">{timeAgo(rec.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 leading-snug">{rec.title}</p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{rec.description}</p>

                          {rec.recommended_action && (
                            <p className="text-xs text-indigo-700 mt-1.5 font-medium">{rec.recommended_action}</p>
                          )}

                          {/* Reasoning toggle */}
                          {rec.reasoning && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedRecId(isExpanded ? null : rec.id); }}
                                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 mt-1.5"
                              >
                                <Sparkles className="w-3 h-3" />
                                AI Reasoning
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              {isExpanded && (
                                <p className="mt-1.5 text-[11px] text-gray-500 bg-gray-50 rounded p-2 border border-gray-100">
                                  {rec.reasoning}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-2.5 pl-4">
                        {actingOnId === rec.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleAccept(rec.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <Check className="w-3 h-3" /> Accept
                            </button>
                            <button
                              onClick={() => handleSnooze(rec.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <Clock className="w-3 h-3" /> Snooze
                            </button>
                            <button
                              onClick={() => handleDismiss(rec.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition-colors"
                            >
                              <X className="w-3 h-3" /> Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* This Week Tab */
            <div className="p-3 space-y-1">
              {weeklyPlan.map((day, i) => {
                const isSelected = selectedDay === i;
                const hasRoutes = day.routes.length > 0;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSelected ? null : i)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      day.isPast ? 'opacity-50' : ''
                    } ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                        : hasRoutes
                          ? 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                          : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{day.dayName}</span>
                        <span className="text-xs text-gray-400">{day.dayShort}</span>
                        {day.isToday && (
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                            TODAY
                          </span>
                        )}
                      </div>
                      {hasRoutes && (
                        <span className="text-[10px] font-medium text-gray-500">
                          {day.routes.length} route{day.routes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Routes */}
                    {hasRoutes ? (
                      <div className="space-y-1.5 mt-2">
                        {day.routes.map((r, j) => (
                          <div
                            key={j}
                            className={`rounded-md border-l-[3px] px-2.5 py-1.5 ${urgencyStyle[r.urgency]}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-900 truncate">
                                {r.route.name?.split('—')[0]?.trim() || r.route.geographic_area}
                              </span>
                              <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                                {r.route.bin_count} bins
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">{r.reason}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400">No routes scheduled</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative">
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <GoogleMap
            mapId="intelligence-map"
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
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-500">
                  <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
              </AdvancedMarker>
            )}

            {/* Bin markers */}
            {mappableBins.map(bin => {
              const isHighlighted = highlightedBinIds.has(bin.id);
              const fill = bin.fill_percentage ?? 0;
              const isCritical = fill >= 80;

              return (
                <AdvancedMarker
                  key={bin.id}
                  position={{ lat: bin.latitude, lng: bin.longitude }}
                  zIndex={isHighlighted ? 15 : 10}
                >
                  <div
                    className={`rounded-full border-2 shadow-lg flex items-center justify-center transition-all duration-300 ${
                      isHighlighted
                        ? `w-9 h-9 border-white ring-4 ${isCritical ? 'ring-red-400/50 animate-pulse' : 'ring-indigo-400/40'}`
                        : highlightedBinIds.size > 0
                          ? 'w-6 h-6 border-white/60 opacity-30'
                          : 'w-7 h-7 border-white'
                    }`}
                    style={{ backgroundColor: getBinMarkerColor(fill, bin.status) }}
                    title={`Bin #${bin.bin_number} — ${fill}%`}
                  >
                    {(isHighlighted || highlightedBinIds.size === 0) && (
                      <span className={`font-bold text-white ${isHighlighted ? 'text-[11px]' : 'text-[9px]'}`}>
                        {bin.bin_number}
                      </span>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}
          </GoogleMap>
        </APIProvider>

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 flex items-center gap-3 text-[10px] text-gray-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
        </div>
      </div>
    </div>
  );
}
