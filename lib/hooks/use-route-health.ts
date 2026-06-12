import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBinAnalytics, BinPerformance } from '@/lib/api/bin-analytics';
import { Route } from '@/lib/types/route';

export type RouteHealthStatus = 'critical' | 'attention' | 'healthy';

export interface RouteHealth {
  avgFill: number;
  criticalBins: number;
  highBins: number;
  avgDailyRate: number;
  daysToFull: number;
  status: RouteHealthStatus;
  matchedBins: number;
}

export function useRouteHealth(routes: Route[]) {
  const { data: analyticsData } = useQuery({
    queryKey: ['bin-analytics'],
    queryFn: fetchBinAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const healthMap = useMemo(() => {
    const map = new Map<string, RouteHealth>();
    if (!analyticsData) return map;

    const bins = analyticsData.bins;
    // Index bins by ID for fast lookup
    const binById = new Map<string, BinPerformance>();
    bins.forEach(b => binById.set(b.id, b));

    routes.forEach(route => {
      const routeBins = (route.bin_ids || [])
        .map(id => binById.get(id))
        .filter((b): b is BinPerformance => b !== undefined);

      if (routeBins.length === 0) {
        map.set(route.id, {
          avgFill: 0, criticalBins: 0, highBins: 0,
          avgDailyRate: 0, daysToFull: 999,
          status: 'healthy', matchedBins: 0,
        });
        return;
      }

      const avgFill = routeBins.reduce((s, b) => s + b.estimated_current_fill, 0) / routeBins.length;
      const avgDailyRate = routeBins.reduce((s, b) => s + b.avg_daily_fill_rate, 0) / routeBins.length;
      const criticalBins = routeBins.filter(b => b.estimated_current_fill >= 80).length;
      const highBins = routeBins.filter(b => b.estimated_current_fill >= 50 && b.estimated_current_fill < 80).length;
      const daysToFull = avgDailyRate > 0 ? Math.max(0, (80 - avgFill) / avgDailyRate) : 999;

      let status: RouteHealthStatus = 'healthy';
      if (criticalBins >= 2 || avgFill >= 70) {
        status = 'critical';
      } else if (criticalBins >= 1 || avgFill >= 45 || daysToFull <= 3) {
        status = 'attention';
      }

      map.set(route.id, {
        avgFill: Math.round(avgFill),
        criticalBins,
        highBins,
        avgDailyRate: Math.round(avgDailyRate * 10) / 10,
        daysToFull: Math.round(daysToFull * 10) / 10,
        status,
        matchedBins: routeBins.length,
      });
    });

    return map;
  }, [analyticsData, routes]);

  return { healthMap, isLoaded: !!analyticsData };
}
