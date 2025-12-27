'use client';

import { KpiCard } from '@/components/binly/kpi-card';
import { IntelligenceCard } from '@/components/binly/intelligence-card';
import { TacticalMap } from '@/components/binly/tactical-map';
import { FieldFeedItem } from '@/components/binly/field-feed-item';
import { SearchBar } from '@/components/binly/search-bar';
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
            onClick={() => console.log('Navigate to Analytics')}
          />
          <KpiCard
            title="Active Drivers"
            value="8/10 Active"
            icon={<Truck className="w-6 h-6 text-blue-600" />}
            iconBgColor="bg-blue-50"
            onClick={() => console.log('Navigate to Live Map')}
          />
          <KpiCard
            title="Full Bins"
            value="12 Bins"
            icon={<Trash2 className="w-6 h-6 text-red-600" />}
            iconBgColor="bg-red-50"
            onClick={() => console.log('Navigate to Inventory filtered')}
          />
          <KpiCard
            title="Issues"
            value="3 Alerts"
            icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
            iconBgColor="bg-orange-50"
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

          {/* Intelligence Highlights - Right Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Intelligence Highlights
              </h2>
              <Badge variant="default" className="gap-1">
                <Sparkles className="w-3 h-3" />
                AI
              </Badge>
            </div>

            <div className="space-y-3">
              <IntelligenceCard
                title="AI predicts 5 bins in the North Sector will hit 100% within 4 hours"
                description="Predicted fill level based on historical patterns"
                timestamp="4 hours ago"
                icon={<Sparkles className="w-5 h-5 text-purple-500" />}
                onClick={() => console.log('Open predictive insights')}
              />

              <IntelligenceCard
                title="Rerouting Driver Ariel could save 12 miles to replacing your bins browniea..."
                description="Smart-Path optimization available"
                timestamp="2 hours ago"
                icon={<Route className="w-5 h-5 text-blue-500" />}
                onClick={() => console.log('Open route optimization')}
              />

              <IntelligenceCard
                title="Top Performer"
                description="Driver • days ago"
                icon={<Award className="w-5 h-5 text-yellow-500" />}
                onClick={() => console.log('View leaders panel')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
