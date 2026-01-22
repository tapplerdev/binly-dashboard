'use client';

import { KpiCard } from '@/components/binly/kpi-card';
import { IntelligenceCard } from '@/components/binly/intelligence-card';
import { TacticalMap } from '@/components/binly/tactical-map';
import { FieldFeedItem } from '@/components/binly/field-feed-item';
import { FieldFeedChecklist } from '@/components/binly/field-feed-checklist';
import { MiniTrendChart } from '@/components/binly/mini-trend-chart';
import { MiniBarChart, SegmentedBarChart } from '@/components/binly/mini-bar-chart';
import { ActiveRoutesTable } from '@/components/binly/active-routes-table';
import { TopDriversCard } from '@/components/binly/top-drivers-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Truck,
  Trash2,
  AlertTriangle,
  Sparkles,
  Route,
  Award,
  Camera,
  MapPin,
} from 'lucide-react';
import { Shift } from '@/lib/types/shift';

export default function PulsePage() {
  // Sample data for charts (in production, this would come from API)
  const harvestTrend = [850, 920, 1050, 980, 1100, 1150, 1240];

  // Sample active shifts data (in production, this would come from API with React Query)
  const activeShifts: Shift[] = [
    {
      id: '1',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '16:00',
      driverId: 'driver-1',
      driverName: 'Omar Hassan',
      route: 'Route 4 - North Sector',
      binCount: 12,
      binsCollected: 6,
      status: 'active',
      estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    },
    {
      id: '2',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:30',
      endTime: '16:30',
      driverId: 'driver-2',
      driverName: 'Ariel Rodriguez',
      route: 'Route 3 - East Side',
      binCount: 15,
      binsCollected: 9,
      status: 'active',
      estimatedCompletion: new Date(Date.now() + 2.25 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      driverId: 'driver-3',
      driverName: 'Sarah Chen',
      route: 'Route 1 - Central',
      binCount: 10,
      binsCollected: 8,
      status: 'active',
      estimatedCompletion: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      date: new Date().toISOString().split('T')[0],
      startTime: '07:30',
      endTime: '15:30',
      driverId: 'driver-4',
      driverName: 'Mike Johnson',
      route: 'Route 2 - West End',
      binCount: 14,
      binsCollected: 3,
      status: 'active',
      estimatedCompletion: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-2.5">
          <KpiCard
            title="Total customers"
            value="567,899"
            icon={<TrendingUp className="w-4 h-4 text-green-600" />}
            iconBgColor="bg-green-50"
            trend="up"
            trendValue="2.6%"
            onClick={() => console.log('Navigate to Analytics')}
          />
          <KpiCard
            title="Total revenue"
            value="$3,465 M"
            icon={<TrendingUp className="w-4 h-4 text-green-600" />}
            iconBgColor="bg-green-50"
            trend="up"
            trendValue="0.5%"
            onClick={() => console.log('Navigate to Revenue')}
          />
          <KpiCard
            title="Total orders"
            value="1,136 M"
            icon={<Truck className="w-4 h-4 text-red-600" />}
            iconBgColor="bg-red-50"
            trend="down"
            trendValue="0.2%"
            onClick={() => console.log('Navigate to Orders')}
          />
          <KpiCard
            title="Total returns"
            value="1,789"
            icon={<Trash2 className="w-4 h-4 text-green-600" />}
            iconBgColor="bg-green-50"
            trend="up"
            trendValue="0.12%"
            onClick={() => console.log('Navigate to Returns')}
          />

          {/* Add Data Card - Hidden on mobile */}
          <Card className="hidden lg:flex p-3 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-200 bg-white border-2 border-dashed border-gray-300 hover:border-primary">
            <div className="flex flex-col items-center justify-center text-center h-full space-y-1.5">
              <div className="p-1.5 rounded-md bg-gray-100 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-[11px] text-gray-600 font-medium">Add data</p>
            </div>
          </Card>
        </div>

        {/* Main Content - Map + Right Sidebar */}
        <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-stretch">
          {/* Map Section - Flexible Width */}
          <div className="flex-1 min-w-0 h-[400px] lg:min-h-[600px] lg:h-auto">
            <TacticalMap />
          </div>

          {/* Right Sidebar - Fixed 320px on desktop, full width on mobile */}
          <div className="w-full lg:w-[320px] shrink-0 space-y-3 md:space-y-4 flex flex-col">
            {/* Field Feed */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
              <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Field Feed</h3>
              </div>
              <div className="p-3">
                <FieldFeedChecklist />
              </div>
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                <button className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  View all activity →
                </button>
              </div>
            </div>

            {/* Top Drivers */}
            <TopDriversCard />
          </div>
        </div>

        {/* Active Routes Table */}
        <ActiveRoutesTable
          shifts={activeShifts}
          onTrackRoute={(shiftId) => console.log('Track route:', shiftId)}
          onCallDriver={(shiftId) => console.log('Call driver:', shiftId)}
          onRerouteDriver={(shiftId) => console.log('Reroute driver:', shiftId)}
        />
      </div>
    </div>
  );
}
