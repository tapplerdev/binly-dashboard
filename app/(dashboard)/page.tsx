'use client';

import { KpiCard } from '@/components/binly/kpi-card';
import { IntelligenceCard } from '@/components/binly/intelligence-card';
import { TacticalMap } from '@/components/binly/tactical-map';
import { FieldFeedItem } from '@/components/binly/field-feed-item';
import { SearchBar } from '@/components/binly/search-bar';
import { AIAssistantPanel } from '@/components/binly/ai-assistant-panel';
import { MiniTrendChart } from '@/components/binly/mini-trend-chart';
import { MiniBarChart, SegmentedBarChart } from '@/components/binly/mini-bar-chart';
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

export default function PulsePage() {
  // Sample data for charts (in production, this would come from API)
  const harvestTrend = [850, 920, 1050, 980, 1100, 1150, 1240];

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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tactical Overview - Spans 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Live Snapshot
              </h2>
              <TacticalMap />
            </div>

            {/* Field Friction Feed */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Field Friction Feed
              </h2>
              <Card className="divide-y">
                <FieldFeedItem
                  title="Driver Omar uploaded a photo of Bin #202 (Vandalized)"
                  icon={<Camera className="w-5 h-5 text-red-500" />}
                  onClick={() => console.log('Open field report')}
                />
                <FieldFeedItem
                  title="Landlord at Plaza Mall requested a bin relocation"
                  icon={<MapPin className="w-5 h-5 text-blue-500" />}
                  onClick={() => console.log('Open move request')}
                />
                <FieldFeedItem
                  title="Scalemaster confirmed 450kg for Route 4"
                  icon={<TrendingUp className="w-5 h-5 text-green-500" />}
                  onClick={() => console.log('View route details')}
                />
              </Card>
            </div>
          </div>

          {/* AI Assistant - Right Column */}
          <div>
            <AIAssistantPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
