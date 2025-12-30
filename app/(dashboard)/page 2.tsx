'use client';

import { KpiCard } from '@/components/binly/kpi-card';
import { IntelligenceCard } from '@/components/binly/intelligence-card';
import { TacticalMap } from '@/components/binly/tactical-map';
import { FieldFeedItem } from '@/components/binly/field-feed-item';
import { SearchBar } from '@/components/binly/search-bar';
import { AIAssistantPanel } from '@/components/binly/ai-assistant-panel';
import { FloatingFieldFeed } from '@/components/binly/floating-field-feed';
import { MiniTrendChart } from '@/components/binly/mini-trend-chart';
import { MiniBarChart, SegmentedBarChart } from '@/components/binly/mini-bar-chart';
import { ActiveRoutesTable } from '@/components/binly/active-routes-table';
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header with Search */}
        <div className="flex justify-center">
          <SearchBar className="w-full max-w-2xl" />
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Weight"
            value="1,240 KG"
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            iconBgColor="bg-green-50"
            trend="up"
            trendValue="14%"
            subtitle="Target: 1,500 KG (83%)"
            chart={<MiniTrendChart data={harvestTrend} color="#16a34a" />}
            onClick={() => console.log('Navigate to Analytics')}
          />
          <KpiCard
            title="Active Drivers"
            value="8/10"
            icon={<Truck className="w-6 h-6 text-blue-600" />}
            iconBgColor="bg-blue-50"
            subtitle="2 drivers on break"
            chart={<MiniBarChart filled={8} total={10} color="#2563eb" />}
            onClick={() => console.log('Navigate to Live Map')}
          />
          <KpiCard
            title="Critical Bins"
            value="12 Bins"
            icon={<Trash2 className="w-6 h-6 text-red-600" />}
            iconBgColor="bg-red-50"
            trend="down"
            trendValue="3"
            subtitle=">80% capacity"
            chart={
              <SegmentedBarChart
                segments={[
                  { value: 12, color: '#dc2626', label: 'Critical (>80%)' },
                  { value: 25, color: '#f59e0b', label: 'Warning (60-80%)' },
                  { value: 63, color: '#22c55e', label: 'OK (<60%)' },
                ]}
              />
            }
            onClick={() => console.log('Navigate to Inventory filtered')}
          />
          <KpiCard
            title="Urgent Issues"
            value="3 Alerts"
            icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
            iconBgColor="bg-orange-50"
            subtitle="2 require immediate action"
            onClick={() => console.log('Navigate to Field Reports')}
          />
        </div>

        {/* Main Content - Flexible Layout with Fixed Sidebar */}
        <div className="flex gap-6 items-start">
          {/* Map Section - Takes Up Remaining Space */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Live Snapshot
              </h2>
              <div className="relative">
                <TacticalMap />
                {/* Floating Field Feed overlays the map */}
                <FloatingFieldFeed />
              </div>
            </div>
          </div>

          {/* AI Assistant - Fixed Sidebar */}
          <div className="w-[380px] shrink-0">
            <AIAssistantPanel />
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
