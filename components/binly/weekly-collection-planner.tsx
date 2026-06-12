'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Route, AlertTriangle, Clock, MapPin, Sparkles, Loader2, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { fetchBinAnalytics, BinPerformance } from '@/lib/api/bin-analytics';

interface RouteTemplate {
  id: string;
  name: string;
  bin_count: number;
  geographic_area: string;
  estimated_duration_hours: number;
  schedule_pattern?: string;
  bins?: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ropacal-backend-production.up.railway.app';

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem('binly-auth-storage') || '{}')?.state?.token;
    return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
}

async function fetchRoutes(): Promise<RouteTemplate[]> {
  const resp = await fetch(`${API_URL}/api/routes`, { headers: getAuthHeaders() });
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : data.data || data.routes || [];
}

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayNamesFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface DayPlan {
  date: Date;
  dayName: string;
  routes: Array<{
    route: RouteTemplate;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    criticalBins: number;
    avgFill: number;
    reason: string;
  }>;
  isToday: boolean;
  isPast: boolean;
}

export function WeeklyCollectionPlanner() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
    staleTime: 5 * 60 * 1000,
  });

  // Generate AI-suggested weekly plan
  const weeklyPlan = useMemo((): DayPlan[] => {
    if (!analyticsData || routes.length === 0) {
      return weekDates.map((date, i) => ({
        date,
        dayName: dayNames[i],
        routes: [],
        isToday: date.toDateString() === new Date().toDateString(),
        isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
      }));
    }

    const bins = analyticsData.bins;
    const avgFleetRate = analyticsData.summary.avg_fill_rate;

    // Score each route by urgency of its bins
    const routeScores = routes.map(route => {
      const routeBinIDs = new Set(route.bins || []);
      const routeBins = bins.filter(b => routeBinIDs.has(b.id));

      if (routeBins.length === 0) {
        // No bin data — use estimated fill from check count
        return { route, score: 0, criticalBins: 0, avgFill: 0, daysToFull: 999 };
      }

      const avgFill = routeBins.reduce((s, b) => s + b.estimated_current_fill, 0) / routeBins.length;
      const avgRate = routeBins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / routeBins.length;
      const criticalBins = routeBins.filter(b => b.estimated_current_fill >= 80).length;
      const daysToFull = avgRate > 0 ? (80 - avgFill) / avgRate : 999;

      // Score: higher = more urgent
      const score = criticalBins * 10 + avgFill * 0.5 + (avgRate > avgFleetRate * 2 ? 20 : 0);

      return { route, score, criticalBins, avgFill: Math.round(avgFill), daysToFull };
    }).sort((a, b) => b.score - a.score);

    // Assign routes to days — spread across the week based on urgency
    const plan: DayPlan[] = weekDates.map((date, i) => ({
      date,
      dayName: dayNames[i],
      routes: [],
      isToday: date.toDateString() === new Date().toDateString(),
      isPast: date < new Date(new Date().setHours(0, 0, 0, 0)),
    }));

    // High urgency routes → earlier in the week, spread out
    const workDays = [0, 1, 2, 3, 4]; // Mon-Fri
    routeScores.forEach((rs, idx) => {
      if (rs.score <= 0) return;

      // Determine urgency level
      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
      let reason = 'Routine collection';
      if (rs.criticalBins >= 3 || rs.daysToFull <= 1) {
        urgency = 'critical';
        reason = `${rs.criticalBins} bins at critical fill — collect ASAP`;
      } else if (rs.criticalBins >= 1 || rs.daysToFull <= 3) {
        urgency = 'high';
        reason = `${rs.criticalBins} critical bin${rs.criticalBins !== 1 ? 's' : ''}, avg ${rs.avgFill}% fill`;
      } else if (rs.avgFill >= 50) {
        urgency = 'medium';
        reason = `Avg fill ${rs.avgFill}% — approaching collection threshold`;
      } else {
        reason = `Low urgency — avg fill ${rs.avgFill}%`;
      }

      // Assign to day: critical → today/tomorrow, high → this week, medium → later
      let targetDay: number;
      if (urgency === 'critical') {
        targetDay = workDays[0]; // Monday (or first available)
      } else if (urgency === 'high') {
        targetDay = workDays[Math.min(idx, workDays.length - 1)];
      } else {
        targetDay = workDays[Math.min(idx + 2, workDays.length - 1)];
      }

      // Don't assign to past days
      while (targetDay < workDays.length && plan[targetDay].isPast) {
        targetDay++;
      }
      if (targetDay >= 7) return;

      plan[targetDay].routes.push({
        route: rs.route,
        urgency,
        criticalBins: rs.criticalBins,
        avgFill: rs.avgFill,
        reason,
      });
    });

    return plan;
  }, [analyticsData, routes, weekDates]);

  const totalRoutes = weeklyPlan.reduce((s, d) => s + d.routes.length, 0);
  const criticalCount = weeklyPlan.reduce((s, d) => s + d.routes.filter(r => r.urgency === 'critical').length, 0);

  const isLoading = loadingAnalytics || loadingRoutes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Weekly Collection Plan
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">AI-suggested route schedule based on fill rate projections</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => setWeekOffset(0)} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1">
            This Week
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Routes This Week</p>
          <p className="text-xl font-bold text-gray-900">{totalRoutes}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3">
          <p className="text-xs text-gray-500">Critical Routes</p>
          <p className="text-xl font-bold text-red-600">{criticalCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Active Templates</p>
          <p className="text-xl font-bold text-gray-900">{routes.length}</p>
        </div>
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weeklyPlan.map((day, i) => (
            <div
              key={i}
              className={`rounded-lg border min-h-[200px] ${
                day.isToday
                  ? 'border-blue-300 bg-blue-50/30'
                  : day.isPast
                    ? 'border-gray-100 bg-gray-50/50 opacity-60'
                    : 'border-gray-200 bg-white'
              }`}
            >
              {/* Day Header */}
              <div className={`px-2.5 py-2 border-b ${day.isToday ? 'border-blue-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${day.isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                    {day.dayName}
                  </span>
                  {day.isToday && <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">TODAY</span>}
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(day.date)}</p>
              </div>

              {/* Routes */}
              <div className="p-1.5 space-y-1.5">
                {day.routes.length === 0 ? (
                  <p className="text-[10px] text-gray-300 text-center py-4">No routes</p>
                ) : (
                  day.routes.map((r, j) => {
                    const urgencyColors = {
                      critical: 'bg-red-50 border-red-200 text-red-800',
                      high: 'bg-orange-50 border-orange-200 text-orange-800',
                      medium: 'bg-blue-50 border-blue-200 text-blue-800',
                      low: 'bg-gray-50 border-gray-200 text-gray-700',
                    };
                    return (
                      <div key={j} className={`rounded-md border p-2 ${urgencyColors[r.urgency]}`}>
                        <div className="flex items-center gap-1 mb-1">
                          <Route className="w-3 h-3" />
                          <span className="text-[10px] font-semibold truncate">{r.route.name?.split('—')[0]?.trim() || 'Route'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] opacity-75">
                          <span>{r.route.bin_count} bins</span>
                          {r.route.estimated_duration_hours > 0 && (
                            <span>{r.route.estimated_duration_hours.toFixed(1)}h</span>
                          )}
                        </div>
                        {r.criticalBins > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span className="text-[9px] font-medium">{r.criticalBins} critical</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Critical — collect today</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> High — collect this week</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Medium — approaching threshold</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> Low — routine</span>
      </div>
    </div>
  );
}
