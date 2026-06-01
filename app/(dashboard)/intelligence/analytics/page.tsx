import { BinAnalyticsDashboard } from '@/components/binly/bin-analytics-dashboard';

export const metadata = {
  title: 'Analytics - Binly Dashboard',
  description: 'Bin performance analytics and fill rate insights',
};

export default function AnalyticsPage() {
  return (
    <div className="p-4 md:p-6">
      <BinAnalyticsDashboard />
    </div>
  );
}
