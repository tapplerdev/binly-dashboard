import { AnalyticsTabs } from '@/components/binly/analytics-tabs';

export const metadata = {
  title: 'Analytics - Binly Dashboard',
  description: 'Network health trends and bin performance analytics',
};

export default function AnalyticsPage() {
  return (
    <div className="p-4 md:p-6">
      <AnalyticsTabs />
    </div>
  );
}
